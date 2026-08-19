# Auth API image (THEA-84d). One image, two roles: the default CMD runs the
# long-lived API (src/server.mjs); docker-compose.yml overrides `command` to
# `node scripts/migrate.mjs` for the one-shot migration job instead of
# maintaining a second Dockerfile that would drift from this one.
#
# node:20-bookworm-slim, not -alpine (THEA-114 re-diagnosis): argon2 ships
# N-API prebuilds for both glibc and musl linux-x64/arm64
# (node_modules/argon2/prebuilds), so either libc works in principle. But
# alpine's musl prebuild (argon2.musl.node) dlopens libstdc++.so.6 (which
# pulls in libgcc_s.so.1), and node:20-alpine ships neither — installing just
# libstdc++ via apk (the first fix attempt, e0e09e29) still segfaulted (exit
# 139) on api startup, so the musl prebuild itself is bad on this base image,
# not merely missing a runtime lib. Moving to a glibc base makes node-gyp-build
# resolve the far-better-exercised argon2.glibc.node instead, with no apk/
# build-toolchain step needed.
FROM node:20-bookworm-slim

WORKDIR /app

# Deps are vendored, not installed: node_modules is git-tracked and complete
# (THEA-112), so the build needs no npm-registry egress. argon2 — the only
# native dep — ships an N-API prebuild covering linux-x64/arm64 glibc
# (node_modules/argon2/prebuilds); the prebuild needs no compile step and,
# on this glibc base, no extra OS packages either (see header comment above).
# package.json is still copied for metadata/resolution.
COPY package.json package-lock.json ./
COPY node_modules ./node_modules

COPY db ./db
COPY scripts ./scripts
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3001

# Plain node, not `npm start`, so `docker compose run ... node scripts/migrate.mjs`
# style overrides don't pay an extra npm-exec fork.
CMD ["node", "src/server.mjs"]
