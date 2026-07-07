import type { FastifyInstance } from "fastify";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

function getAdminIds() {
  return (process.env.ADMIN_SPOTIFY_IDS || "").split(",").filter(Boolean);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKLOG_PATH = join(__dirname, "..", "..", "backlog.json");

interface BacklogItem {
  us: string;
  role: string;
  description: string;
  status: string;
}

const DEFAULT_BACKLOG: BacklogItem[] = [
  { us: "1.0", role: "LOGOUT", description: "Page de présentation (landing)", status: "Done" },
  { us: "2.0", role: "LOGOUT", description: "Login via Spotify", status: "Done" },
  { us: "3.0", role: "LOGOUT", description: "Création de compte via Spotify", status: "Done" },
  { us: "4.0", role: "LOGGED IN", description: "Page d'accueil", status: "Done" },
  { us: "5.0", role: "LOGGED IN", description: "Créer une playlist", status: "Done" },
  { us: "6.0", role: "CREATOR", description: "Partager la playlist via lien", status: "Done" },
  { us: "7.0", role: "CREATOR", description: 'Recherche "nearby"', status: "Hors périmètre" },
  {
    us: "8.0",
    role: "CREATOR",
    description: "Fusion des Saved Tracks (round-robin + dedup)",
    status: "Done",
  },
  { us: "9.0", role: "CREATOR", description: "Lancer la lecture de la playlist", status: "Done" },
  { us: "10.0", role: "INVITE", description: "Rejoindre via lien de partage", status: "Done" },
  { us: "11.0", role: "INVITE", description: "Rejoindre depuis l'app", status: "Done" },
  { us: "12.0", role: "CONTRIBUTOR", description: "Quitter une playlist", status: "Done" },
  { us: "13.0", role: "CONTRIBUTOR", description: "Accéder à l'app", status: "Done" },
  { us: "14.0", role: "CREATOR", description: "Arrêter une playlist", status: "Done" },
  {
    us: "15.0",
    role: "CREATOR",
    description: "Accéder à l'app (gestion playlists)",
    status: "Done",
  },
  { us: "16.0", role: "LOGGED IN", description: "Supprimer mon compte", status: "Done" },
  { us: "17.0", role: "CREATOR", description: "Supprimer un contributor", status: "Done" },
  { us: "18.0", role: "ADMIN", description: "Dashboard admin", status: "Done" },
];

function loadBacklog(): BacklogItem[] {
  if (existsSync(BACKLOG_PATH)) {
    return JSON.parse(readFileSync(BACKLOG_PATH, "utf-8"));
  }
  return DEFAULT_BACKLOG;
}

function saveBacklog(items: BacklogItem[]) {
  writeFileSync(BACKLOG_PATH, JSON.stringify(items, null, 2));
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    const userId = req.cookies.session;
    if (!userId) return reply.status(401).send({ error: "Not authenticated" });

    const { prisma } = await import("@deepfuse/db");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !getAdminIds().includes(user.spotifyId))
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

  app.get("/backlog", async () => {
    return loadBacklog();
  });

  app.patch("/backlog", async (req) => {
    const updates = req.body as { us: string; status: string }[];
    const backlog = loadBacklog();
    for (const update of updates) {
      const item = backlog.find((b) => b.us === update.us);
      if (item) item.status = update.status;
    }
    saveBacklog(backlog);
    return backlog;
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
