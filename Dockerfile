# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — builder
#   Install dependencies, generate Prisma client, build Next.js standalone.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Native build tools needed by some npm packages (e.g. better-sqlite3)
RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .

# Generate Prisma client (reads schema.prisma — no DB connection needed)
RUN npx prisma generate

# Build Next.js (output: standalone)
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — runner (final image)
#   Following the official Prisma Docker guide:
#   https://www.prisma.io/docs/guides/deployment/docker
#   Copy the full node_modules so Prisma CLI has everything it needs at startup.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# ── Application files ─────────────────────────────────────────────────────────
COPY --from=builder /app/public                                    ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone    ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static        ./.next/static

# ── Full node_modules + package.json (required by Prisma CLI at startup) ─────
COPY --from=builder --chown=nextjs:nodejs /app/node_modules        ./node_modules
COPY --from=builder /app/package.json                              ./package.json

# ── Prisma schema & config ────────────────────────────────────────────────────
COPY --from=builder /app/prisma           ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# ── Persistent data directory for SQLite ─────────────────────────────────────
# Must be created before switching to the non-root user so chown works.
# The named volume (docker-compose.yml) is mounted at /app/prisma/data.
RUN mkdir -p /app/prisma/data && chown -R nextjs:nodejs /app/prisma/data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 1. Apply schema to the (possibly fresh) SQLite file.
# 2. Start the Next.js standalone server.
CMD ["sh", "-c", "npx prisma db push && node server.js"]
