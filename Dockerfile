# ── Stage 1: Install dependencies (with native build tools for better-sqlite3) ──
FROM node:20-alpine AS deps
WORKDIR /app
# python3, make, g++ — required to compile better-sqlite3's native binding
# libc6-compat — glibc compat layer that some prebuilts need on alpine
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json package-lock.json* ./
# Don't use --ignore-scripts here — better-sqlite3 needs its postinstall to compile.
RUN npm ci

# ── Stage 2: Build the Next.js app ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: Production runner (minimal image + native module) ────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# libc6-compat needed at runtime for the compiled native binding to load.
RUN apk add --no-cache libc6-compat

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# better-sqlite3 is marked as a server external in next.config — Next bundles a
# package.json reference but not the native .node file. Copy the full module so
# the compiled binding ships with the image.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

# Persistent SQLite data directory (mounted as a docker volume in compose).
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DB_PATH=/app/data/portfolio.db

CMD ["node", "server.js"]
