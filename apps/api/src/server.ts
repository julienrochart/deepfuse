import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { authRoutes } from "./routes/auth.js";
import { playlistRoutes } from "./routes/playlists.js";
import { adminRoutes } from "./routes/admin.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.WEB_URL?.includes(",")
    ? process.env.WEB_URL.split(",").map((u) => u.trim())
    : process.env.WEB_URL || "http://127.0.0.1:3000",
  credentials: true,
});

await app.register(cookie);

app.get("/health", async () => ({ status: "ok" }));

await app.register(authRoutes, { prefix: "/auth" });
await app.register(playlistRoutes, { prefix: "/api/playlists" });
await app.register(adminRoutes, { prefix: "/api/admin" });

const port = Number(process.env.PORT) || 3001;

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
