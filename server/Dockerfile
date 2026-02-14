# =============================================================================
# Chess Server — Multi-stage Docker build
# Stage 1: Build TypeScript + generate Prisma client
# Stage 2: Production runtime with minimal footprint
# =============================================================================

# --- Build Stage ---
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy Prisma schema + config and generate client
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Production Stage ---
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built output
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY prisma.config.ts ./

# Run migrations then start
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
