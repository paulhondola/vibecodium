FROM oven/bun:1-alpine

WORKDIR /app

# docker CLI is required because the server spawns `docker exec` via Bun.spawn
# for terminal WebSocket sessions (see server/src/index.ts).
RUN apk add --no-cache docker-cli ca-certificates git

# --- Dependency install (cached layer) ---
# Copy workspace manifests first so dep resolution is cache-friendly.
COPY package.json bun.lock turbo.json tsconfig.json ./
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json
COPY client/package.json ./client/package.json

# --ignore-scripts: the root postinstall runs scripts/setup_docker.sh, which
# builds the six sandbox images. Sandbox images are built on the host out-of-band
# during deploy.sh, NOT inside this image.
RUN bun install --frozen-lockfile --ignore-scripts

# --- Source ---
# shared exports TS source directly (see shared/package.json), so Bun loads
# `from "shared"` from source at runtime — no build step needed.
COPY server ./server
COPY shared ./shared

# Placeholder so serveStatic("../client/dist") in index.ts does not crash
# if a stray request hits one of the legacy static routes. The real frontend
# is hosted on Vercel.
RUN mkdir -p ./client/dist

WORKDIR /app/server

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
