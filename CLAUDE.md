# DeepFuse

PWA collaborative music playlist app. Users connect via Spotify, create playlists that fuse saved tracks from all participants, and listen together.

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Next.js 15 (App Router) — PWA, Tailwind CSS v4
- **Backend**: Fastify 5, TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: Spotify OAuth2
- **Playback**: Spotify Web Playback SDK (desktop) + Spotify Connect (mobile)

## Structure

```
apps/web      — Next.js PWA (port 3000)
apps/api      — Fastify API (port 3001)
packages/db   — Prisma schema + client
packages/shared — Shared TypeScript types
```

## Commands

```bash
pnpm dev          # Start all apps
pnpm dev:web      # Start web only
pnpm dev:api      # Start API only
pnpm db:generate  # Generate Prisma client
pnpm db:push      # Push schema to database
pnpm db:migrate   # Run migrations
pnpm lint         # ESLint
pnpm lint:fix     # ESLint auto-fix
pnpm format       # Prettier write
pnpm format:check # Prettier check
pnpm type-check   # TypeScript (all packages)
pnpm test         # Vitest run
pnpm test:watch   # Vitest watch mode
```

## Key decisions

- Spotify is the only music provider for MVP
- PWA (not native) — Spotify Connect for mobile playback
- Users with Spotify Free can create playlists but must open Spotify to listen
- Users with Spotify Premium get in-app playback via Spotify Web Playback SDK
- Spotify API dev mode blocks `/playlists/{id}/tracks` — use `/playlists/{id}/items` instead
- All URLs use `127.0.0.1` (not `localhost`) to avoid cross-domain cookie issues
- Spotify sync on home: playlists deleted from Spotify library are auto-removed from DeepFuse

## Backlog

| US   | Rôle        | Description                                   | Statut                                       |
| ---- | ----------- | --------------------------------------------- | -------------------------------------------- |
| 1.0  | LOGOUT      | Page de présentation (landing)                | Done                                         |
| 2.0  | LOGOUT      | Login via Spotify                             | Done                                         |
| 3.0  | LOGOUT      | Création de compte via Spotify                | Done                                         |
| 4.0  | LOGGED IN   | Page d'accueil                                | Done                                         |
| 5.0  | LOGGED IN   | Créer une playlist                            | Done                                         |
| 6.0  | CREATOR     | Partager la playlist via lien                 | Done                                         |
| 7.0  | CREATOR     | Recherche "nearby"                            | Hors périmètre                               |
| 8.0  | CREATOR     | Fusion des Saved Tracks (round-robin + dedup) | Done                                         |
| 9.0  | CREATOR     | Lancer la lecture de la playlist              | Partiel — SDK Spotify + preview 30s fallback |
| 10.0 | INVITE      | Rejoindre via lien de partage                 | Done                                         |
| 11.0 | INVITE      | Rejoindre depuis l'app                        | Partiel — uniquement par lien                |
| 12.0 | CONTRIBUTOR | Quitter une playlist                          | Done                                         |
| 13.0 | CONTRIBUTOR | Accéder à l'app                               | Done                                         |
| 14.0 | CREATOR     | Arrêter une playlist                          | Done                                         |
| 15.0 | CREATOR     | Accéder à l'app (gestion playlists)           | Done                                         |
| 16.0 | LOGGED IN   | Supprimer mon compte                          | TODO                                         |
| 17.0 | CREATOR     | Supprimer un contributor                      | TODO                                         |
| 18.0 | ADMIN       | Dashboard admin                               | TODO                                         |
