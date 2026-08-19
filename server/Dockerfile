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

# Install from the lockfile in its own layer so `npm ci` is only re-run when
# dependencies actually change, not on every source edit. server/package.json
# has no devDependencies (see server/README.md) so there is nothing to
# --omit=dev here, but the flag documents the intent if that ever changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY db ./db
COPY scripts ./scripts
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3001

# Plain node, not `npm start`, so `docker compose run ... node scripts/migrate.mjs`
# style overrides don't pay an extra npm-exec fork.
CMD ["node", "src/server.mjs"]
