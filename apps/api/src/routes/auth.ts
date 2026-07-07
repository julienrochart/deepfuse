import type { FastifyInstance } from "fastify";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_ME_URL = "https://api.spotify.com/v1/me";

const SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-library-read",
  "playlist-modify-public",
  "playlist-modify-private",
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

export async function authRoutes(app: FastifyInstance) {
  app.get("/login", async (req, reply) => {
    const { redirect } = req.query as { redirect?: string };
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.SPOTIFY_CLIENT_ID || "",
      scope: SCOPES,
      redirect_uri: `${process.env.API_URL || "http://127.0.0.1:3001"}/auth/callback`,
      show_dialog: "true",
      ...(redirect ? { state: redirect } : {}),
    });

    return reply.redirect(`${SPOTIFY_AUTH_URL}?${params}`);
  });

  app.get("/callback", async (req, reply) => {
    const { code } = req.query as { code?: string };
    if (!code) {
      return reply.status(400).send({ error: "Missing authorization code" });
    }

    const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.API_URL || "http://127.0.0.1:3001"}/auth/callback`,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      app.log.error({ err }, "Spotify token exchange failed");
      return reply.status(401).send({ error: "Spotify authentication failed" });
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const profileRes = await fetch(SPOTIFY_ME_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileRes.ok) {
      const err = await profileRes.text();
      app.log.error({ err }, "Spotify profile fetch failed");
      return reply.status(401).send({ error: "Failed to fetch Spotify profile" });
    }

    const profile = (await profileRes.json()) as {
      id: string;
      display_name: string;
      images: { url: string }[];
      product: string;
    };

    const { prisma } = await import("@deepfuse/db");

    const user = await prisma.user.upsert({
      where: { spotifyId: profile.id },
      update: {
        displayName: profile.display_name,
        profileImageUrl: profile.images?.[0]?.url ?? null,
        spotifyToken: tokens.access_token,
        spotifyRefresh: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        isPremium: profile.product === "premium",
      },
      create: {
        spotifyId: profile.id,
        displayName: profile.display_name,
        profileImageUrl: profile.images?.[0]?.url ?? null,
        spotifyToken: tokens.access_token,
        spotifyRefresh: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        isPremium: profile.product === "premium",
      },
    });

    const isProd = process.env.NODE_ENV === "production";
    reply.setCookie("session", user.id, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    const webUrl = process.env.WEB_URL || "http://127.0.0.1:3000";
    const { state } = req.query as { state?: string };
    const redirectPath = state && state.startsWith("/") ? state : "/home";
    return reply.redirect(`${webUrl}${redirectPath}`);
  });

  app.get("/me", async (req, reply) => {
    const userId = req.cookies.session;
    if (!userId) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    const { prisma } = await import("@deepfuse/db");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        spotifyId: true,
        displayName: true,
        profileImageUrl: true,
        isPremium: true,
      },
    });

    if (!user) {
      return reply.status(401).send({ error: "User not found" });
    }

    return user;
  });

  app.get("/token", async (req, reply) => {
    const userId = req.cookies.session;
    if (!userId) return reply.status(401).send({ error: "Not authenticated" });

    const { getValidToken } = await import("../spotify.js");
    const token = await getValidToken(userId);
    return { token };
  });

  app.delete("/account", async (req, reply) => {
    const userId = req.cookies.session;
    if (!userId) return reply.status(401).send({ error: "Not authenticated" });

    const { prisma } = await import("@deepfuse/db");
    await prisma.user.delete({ where: { id: userId } });
    const isProdDel = process.env.NODE_ENV === "production";
    reply.clearCookie("session", {
      path: "/",
      secure: isProdDel,
      sameSite: isProdDel ? "none" : "lax",
    });
    return { ok: true };
  });

  app.post("/logout", async (_req, reply) => {
    const isProdLogout = process.env.NODE_ENV === "production";
    reply.clearCookie("session", {
      path: "/",
      secure: isProdLogout,
      sameSite: isProdLogout ? "none" : "lax",
    });
    return { ok: true };
  });
}
