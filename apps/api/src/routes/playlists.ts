import type { FastifyInstance } from "fastify";
import {
  getSavedTracks,
  getValidToken,
  createSpotifyPlaylist,
  addTracksToSpotifyPlaylist,
  fuseTracks,
} from "../spotify.js";

export async function playlistRoutes(app: FastifyInstance) {
  app.get("/", async (req, reply) => {
    const userId = req.cookies.session;
    if (!userId) return reply.status(401).send({ error: "Not authenticated" });

    const { prisma } = await import("@deepfuse/db");
    const playlists = await prisma.playlist.findMany({
      where: {
        OR: [{ creatorId: userId }, { participants: { some: { userId } } }],
      },
      include: {
        creator: { select: { id: true, displayName: true, profileImageUrl: true } },
        participants: {
          include: { user: { select: { id: true, displayName: true, profileImageUrl: true } } },
        },
        _count: { select: { tracks: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Sync: remove playlists no longer in user's Spotify library
    const toCheck = playlists.filter((p) => p.spotifyPlaylistId);
    if (toCheck.length > 0) {
      try {
        const token = await getValidToken(userId);
        const spotifyIds = new Set<string>();
        let url: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";
        while (url) {
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) break;
          const data = (await res.json()) as { items: { id: string }[]; next: string | null };
          data.items.forEach((p) => spotifyIds.add(p.id));
          url = data.next;
        }
        const deleted = toCheck
          .filter((p) => !spotifyIds.has(p.spotifyPlaylistId!))
          .map((p) => p.id);
        if (deleted.length > 0) {
          await prisma.playlist.deleteMany({ where: { id: { in: deleted } } });
          return playlists.filter((p) => !deleted.includes(p.id));
        }
      } catch (err) {
        app.log.warn({ err }, "Spotify sync check failed, returning local list");
      }
    }

    return playlists;
  });

  app.post("/", async (req, reply) => {
    const userId = req.cookies.session;
    if (!userId) return reply.status(401).send({ error: "Not authenticated" });

    const { name, description } = req.body as { name: string; description?: string };
    if (!name) return reply.status(400).send({ error: "Name is required" });

    const { prisma } = await import("@deepfuse/db");
    const playlist = await prisma.playlist.create({
      data: {
        name,
        description,
        creatorId: userId,
        participants: {
          create: { userId, role: "creator" },
        },
      },
    });

    return reply.status(201).send(playlist);
  });

  app.get<{ Params: { shareCode: string } }>("/:shareCode", async (req, reply) => {
    const { shareCode } = req.params;

    const { prisma } = await import("@deepfuse/db");
    const playlist = await prisma.playlist.findUnique({
      where: { shareCode },
      include: {
        creator: { select: { id: true, displayName: true, profileImageUrl: true } },
        participants: {
          include: { user: { select: { id: true, displayName: true, profileImageUrl: true } } },
        },
        tracks: { orderBy: { position: "asc" } },
      },
    });

    if (!playlist) return reply.status(404).send({ error: "Playlist not found" });

    return playlist;
  });

  app.post<{ Params: { shareCode: string } }>("/:shareCode/join", async (req, reply) => {
    const userId = req.cookies.session;
    if (!userId) return reply.status(401).send({ error: "Not authenticated" });

    const { shareCode } = req.params;

    const { prisma } = await import("@deepfuse/db");
    const playlist = await prisma.playlist.findUnique({ where: { shareCode } });
    if (!playlist) return reply.status(404).send({ error: "Playlist not found" });
    if (!playlist.isActive)
      return reply.status(400).send({ error: "Playlist is no longer active" });

    const participant = await prisma.playlistParticipant.upsert({
      where: { playlistId_userId: { playlistId: playlist.id, userId } },
      update: {},
      create: { playlistId: playlist.id, userId, role: "contributor" },
    });

    return reply.status(201).send(participant);
  });

  app.post<{ Params: { shareCode: string } }>("/:shareCode/fuse", async (req, reply) => {
    const userId = req.cookies.session;
    if (!userId) return reply.status(401).send({ error: "Not authenticated" });

    const { shareCode } = req.params;

    const { prisma } = await import("@deepfuse/db");
    const playlist = await prisma.playlist.findUnique({
      where: { shareCode },
      include: { participants: true },
    });

    if (!playlist) return reply.status(404).send({ error: "Playlist not found" });
    if (playlist.creatorId !== userId)
      return reply.status(403).send({ error: "Only the creator can fuse" });

    app.log.info(
      { playlistId: playlist.id, participants: playlist.participants.length },
      "Starting fusion"
    );

    // Fetch saved tracks for each participant
    const tracksByUser = new Map<string, Awaited<ReturnType<typeof getSavedTracks>>>();
    for (const p of playlist.participants) {
      try {
        const tracks = await getSavedTracks(p.userId, 50);
        tracksByUser.set(p.userId, tracks);
        app.log.info({ userId: p.userId, trackCount: tracks.length }, "Fetched saved tracks");
      } catch (err) {
        app.log.error({ userId: p.userId, err }, "Failed to fetch saved tracks");
      }
    }

    // Fuse tracks (round-robin interleave, deduped)
    const fused = fuseTracks(tracksByUser);

    if (fused.length === 0) {
      return reply.status(400).send({ error: "No tracks found from participants" });
    }

    // Sync to Spotify (best-effort — dev mode may block this)
    try {
      let spotifyPlaylistId = playlist.spotifyPlaylistId;
      if (!spotifyPlaylistId) {
        spotifyPlaylistId = await createSpotifyPlaylist(
          userId,
          playlist.name,
          playlist.description || undefined
        );
        await prisma.playlist.update({
          where: { id: playlist.id },
          data: { spotifyPlaylistId },
        });
      }
      const trackUris = fused.map((t) => t.uri);
      await addTracksToSpotifyPlaylist(userId, spotifyPlaylistId, trackUris);
      app.log.info("Spotify sync OK");
    } catch (err) {
      app.log.warn({ err }, "Spotify sync failed (dev mode?) — tracks saved locally");
    }

    // Save tracks in our database
    await prisma.playlistTrack.deleteMany({ where: { playlistId: playlist.id } });

    await prisma.playlistTrack.createMany({
      data: fused.map((track, i) => {
        // Find which user contributed this track
        let addedById = userId;
        for (const [uid, tracks] of tracksByUser) {
          if (tracks.some((t) => t.id === track.id)) {
            addedById = uid;
            break;
          }
        }
        return {
          playlistId: playlist.id,
          spotifyTrackId: track.id,
          name: track.name,
          artist: track.artists.map((a) => a.name).join(", "),
          albumName: track.album.name,
          albumImageUrl: track.album.images?.[0]?.url ?? null,
          durationMs: track.duration_ms,
          previewUrl: track.preview_url,
          position: i,
          addedById,
        };
      }),
    });

    app.log.info({ playlistId: playlist.id, trackCount: fused.length }, "Fusion complete");

    // Return updated playlist
    const updated = await prisma.playlist.findUnique({
      where: { id: playlist.id },
      include: {
        creator: { select: { id: true, displayName: true, profileImageUrl: true } },
        participants: {
          include: { user: { select: { id: true, displayName: true, profileImageUrl: true } } },
        },
        tracks: { orderBy: { position: "asc" } },
      },
    });

    return updated;
  });

  app.delete<{ Params: { shareCode: string } }>("/:shareCode/leave", async (req, reply) => {
    const userId = req.cookies.session;
    if (!userId) return reply.status(401).send({ error: "Not authenticated" });

    const { shareCode } = req.params;

    const { prisma } = await import("@deepfuse/db");
    const playlist = await prisma.playlist.findUnique({ where: { shareCode } });
    if (!playlist) return reply.status(404).send({ error: "Playlist not found" });

    await prisma.playlistParticipant.deleteMany({
      where: { playlistId: playlist.id, userId },
    });

    await prisma.playlistTrack.deleteMany({
      where: { playlistId: playlist.id, addedById: userId },
    });

    return { ok: true };
  });

  app.patch<{ Params: { shareCode: string } }>("/:shareCode/stop", async (req, reply) => {
    const userId = req.cookies.session;
    if (!userId) return reply.status(401).send({ error: "Not authenticated" });

    const { shareCode } = req.params;

    const { prisma } = await import("@deepfuse/db");
    const playlist = await prisma.playlist.findUnique({ where: { shareCode } });
    if (!playlist) return reply.status(404).send({ error: "Playlist not found" });
    if (playlist.creatorId !== userId)
      return reply.status(403).send({ error: "Only the creator can stop" });

    await prisma.playlist.update({
      where: { id: playlist.id },
      data: { isActive: false },
    });

    return { ok: true };
  });

  app.delete<{ Params: { shareCode: string } }>("/:shareCode", async (req, reply) => {
    const userId = req.cookies.session;
    if (!userId) return reply.status(401).send({ error: "Not authenticated" });

    const { shareCode } = req.params;

    const { prisma } = await import("@deepfuse/db");
    const playlist = await prisma.playlist.findUnique({ where: { shareCode } });
    if (!playlist) return reply.status(404).send({ error: "Playlist not found" });
    if (playlist.creatorId !== userId)
      return reply.status(403).send({ error: "Only the creator can delete" });

    await prisma.playlist.delete({ where: { id: playlist.id } });

    return { ok: true };
  });
}
