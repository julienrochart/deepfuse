FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/db/ packages/db/
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/

# Generate Prisma client + build API
RUN pnpm --filter @deepfuse/db generate
RUN pnpm --filter @deepfuse/api build

EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001

CMD ["sh", "-c", "npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma && node apps/api/dist/server.js"]
