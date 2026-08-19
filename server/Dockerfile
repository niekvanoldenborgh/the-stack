# Auth API image (THEA-84d). One image, two roles: the default CMD runs the
# long-lived API (src/server.mjs); docker-compose.yml overrides `command` to
# `node scripts/migrate.mjs` for the one-shot migration job instead of
# maintaining a second Dockerfile that would drift from this one.
#
# node:20-alpine (not -slim/-bullseye): argon2's vendored prebuilds
# (node_modules/argon2/prebuilds) ship both glibc and musl `.node` binaries
# for linux-x64/arm64, so alpine's musl libc is covered without a build step.
FROM node:20-alpine

WORKDIR /app

# argon2's musl N-API prebuild (node_modules/argon2/prebuilds/linux-x64/argon2.musl.node)
# is NOT self-contained: it dlopens libstdc++.so.6 (which pulls in libgcc_s.so.1
# as a dependency), and node:20-alpine ships neither. Without this the api
# process segfaults (exit 139) the instant src/lib/password.mjs requires
# argon2 (THEA-114). apk pulls from the alpine CDN at build time — same
# egress the base-image pull already uses, no npm registry involved.
RUN apk add --no-cache libstdc++

# Deps are vendored, not installed: node_modules is git-tracked and complete
# (THEA-112), so the build needs no npm-registry egress. argon2 — the only
# native dep — ships an N-API prebuild covering linux-x64/arm64 musl
# (node_modules/argon2/prebuilds); the prebuild itself needs no compile step,
# but it does need the OS-level libstdc++/libgcc runtime installed above.
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
