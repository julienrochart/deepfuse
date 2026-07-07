import type { FastifyInstance } from "fastify";

const ADMIN_SPOTIFY_IDS = (process.env.ADMIN_SPOTIFY_IDS || "").split(",").filter(Boolean);

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    const userId = req.cookies.session;
    if (!userId) return reply.status(401).send({ error: "Not authenticated" });

    const { prisma } = await import("@deepfuse/db");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !ADMIN_SPOTIFY_IDS.includes(user.spotifyId))
      return reply.status(403).send({ error: "Admin access required" });
  });

  app.get("/stats", async () => {
    const { prisma } = await import("@deepfuse/db");

    const [userCount, playlistCount, trackCount, activePlaylistCount] = await Promise.all([
      prisma.user.count(),
      prisma.playlist.count(),
      prisma.playlistTrack.count(),
      prisma.playlist.count({ where: { isActive: true } }),
    ]);

    return { userCount, playlistCount, trackCount, activePlaylistCount };
  });

  app.get("/users", async () => {
    const { prisma } = await import("@deepfuse/db");

    return prisma.user.findMany({
      select: {
        id: true,
        spotifyId: true,
        displayName: true,
        profileImageUrl: true,
        isPremium: true,
        createdAt: true,
        _count: { select: { createdPlaylists: true, participations: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  });

  app.get("/playlists", async () => {
    const { prisma } = await import("@deepfuse/db");

    return prisma.playlist.findMany({
      select: {
        id: true,
        name: true,
        shareCode: true,
        isActive: true,
        createdAt: true,
        creator: { select: { displayName: true } },
        _count: { select: { participants: true, tracks: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  });
}
