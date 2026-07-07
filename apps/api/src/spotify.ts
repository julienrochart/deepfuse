import { prisma } from "@deepfuse/db";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

export async function getValidToken(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.tokenExpiresAt && user.tokenExpiresAt > new Date()) {
    return user.spotifyToken!;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: user.spotifyRefresh!,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("Spotify token refresh error:", res.status, errBody);
    throw new Error(`Failed to refresh Spotify token: ${res.status} ${errBody}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  await prisma.user.update({
    where: { id: userId },
    data: {
      spotifyToken: data.access_token,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      ...(data.refresh_token ? { spotifyRefresh: data.refresh_token } : {}),
    },
  });

  return data.access_token;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
  preview_url: string | null;
  uri: string;
}

export async function getSavedTracks(userId: string, limit = 50): Promise<SpotifyTrack[]> {
  const token = await getValidToken(userId);
  const tracks: SpotifyTrack[] = [];
  let url: string | null = `${API_BASE}/me/tracks?limit=${Math.min(limit, 50)}`;

  while (url && tracks.length < limit) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) break;

    const data = (await res.json()) as {
      items: { track: SpotifyTrack }[];
      next: string | null;
    };

    tracks.push(...data.items.map((i) => i.track));
    url = tracks.length < limit ? data.next : null;
  }

  return tracks.slice(0, limit);
}

export async function createSpotifyPlaylist(
  userId: string,
  name: string,
  description?: string
): Promise<string> {
  const token = await getValidToken(userId);

  const res = await fetch(`${API_BASE}/me/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description: description || "Created with DeepFuse",
      public: false,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("Spotify create playlist error:", res.status, errBody);
    throw new Error(`Failed to create Spotify playlist: ${res.status} ${errBody}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function addTracksToSpotifyPlaylist(
  userId: string,
  playlistId: string,
  trackUris: string[]
): Promise<void> {
  const token = await getValidToken(userId);

  // Use PUT /items to replace all tracks (max 100 per request)
  for (let i = 0; i < trackUris.length; i += 100) {
    const batch = trackUris.slice(i, i + 100);
    const isFirst = i === 0;
    const res = await fetch(`${API_BASE}/playlists/${playlistId}/items`, {
      method: isFirst ? "PUT" : "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: batch }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Spotify add tracks error:", res.status, errBody);
      throw new Error(`Failed to add tracks: ${res.status} ${errBody}`);
    }
  }
}

export function fuseTracks(tracksByUser: Map<string, SpotifyTrack[]>): SpotifyTrack[] {
  const seen = new Set<string>();
  const fused: SpotifyTrack[] = [];
  const users = [...tracksByUser.entries()];

  if (users.length === 0) return [];

  const maxLen = Math.max(...users.map(([, tracks]) => tracks.length));

  // Round-robin interleave: take one track from each user in turn
  for (let i = 0; i < maxLen; i++) {
    for (const [, tracks] of users) {
      if (i < tracks.length) {
        const track = tracks[i];
        if (!seen.has(track.id)) {
          seen.add(track.id);
          fused.push(track);
        }
      }
    }
  }

  return fused;
}
