# =============================================================================
# DockerFe/Dockerfile — Next.js frontend
#
# Three stages, all based on node:20-alpine (Alpine = a tiny Linux, ~5 MB):
#   deps    → install node_modules
#   builder → run `next build`
#   runner  → the final image: only the standalone server + static files
# =============================================================================

# ---------- Stage 1: deps ----------
FROM node:20-alpine AS deps
WORKDIR /app

# Copy only the package files first, so `npm ci` is cached until they change.
# Editing a .tsx file will NOT trigger a re-install of every package.
COPY package.json package-lock.json ./

# `npm ci` installs exactly what package-lock.json says (reproducible builds).
RUN npm ci


# ---------- Stage 2: builder ----------
FROM node:20-alpine AS builder
WORKDIR /app

# ARG = a variable available only while BUILDING the image.
# next.config.ts reads BACKEND_URL during `next build` to bake in the /api rewrite.
# Default "http://backend:8080" = the backend's service/container name on the Docker
# network. Override with: docker build --build-arg BACKEND_URL=http://other:8080 .
ARG BACKEND_URL=http://backend:8080
ENV BACKEND_URL=$BACKEND_URL

# Turn off Next.js anonymous usage telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

# Take node_modules from the deps stage, then add our source code.
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Produces .next/standalone (because of output: "standalone" in next.config.ts).
RUN npm run build


# ---------- Stage 3: runner (the final image) ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# server.js listens on $PORT and $HOSTNAME. 0.0.0.0 = accept connections from
# outside the container (the default "localhost" would only accept from inside!).
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create a non-root user and group (Alpine uses addgroup/adduser).
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy ONLY what's needed to run. No full node_modules, no source code.
#   standalone/   → server.js + the minimal node_modules it needs
#   .next/static  → JS/CSS bundles for the browser (standalone doesn't include them)
#   public/       → static files like images
# --chown makes the non-root user the owner of the files.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

# Documentation: the app listens on 3000. Publishing it needs `-p 3000:3000`.
EXPOSE 3000

CMD ["node", "server.js"]
