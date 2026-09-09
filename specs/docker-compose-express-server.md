# Spec: Docker Compose config for the Express resource server

## Goal

Provide a Docker Compose configuration that runs the existing `server.js`
Express application (see [server.js](../server.js)) so the recovered/local
resource tree can be served over HTTP without requiring a locally installed
Node.js toolchain.

No custom image is built: the target/remote system already receives the full
repository (deployed by whatever process copies this repo there), so Compose
runs the official `node` image directly against the application files
bind-mounted individually from the host/deploy path. There is no `Dockerfile`
and no image registry step to keep in sync with the source tree.

## Scope

- One service, `web`, using the official `image: node:<lts>-alpine` (pinned
  major version, not `latest`) — no `build:` section.
- Only the files the server needs are bind-mounted read-only into the
  container's working directory (e.g. `/app`): `server.js`, `src/`,
  `public/`, and `node_modules/` (installed dependencies). The rest of the
  repository (`backup/`, `vendor/`, `web/`, `migrations/`, etc.) is not
  mounted, so the container only has access to what it actually runs.
- The container runs `node --use-system-ca server.js <ROOT> <INDEX_PATH>`,
  matching the current invocation documented in [README.md](../README.md).
- `ROOT` (the directory served, e.g. a `backup/html/...` wayback capture) and
  `INDEX_PATH` (the specific `index.html` file read by `handleIndex`, see
  [index.js](../src/sever/routes/index.js)) are each mounted into the
  container as their own read-only bind mount, distinct from the application
  file mounts, so any local capture under `backup/` can be served by
  changing the Compose volume mapping alone.
- The `public/` directory (static fallback assets) is bind-mounted
  explicitly alongside `server.js` and `src/`.
- Container listens on port 3000 (matching `server.listen(3000, ...)` in
  [server.js](../server.js)) and Compose publishes it to a configurable host
  port via an environment variable (default `3000:3000`).
- Out of scope: the migration/publisher/puller CLI scripts
  (`publish.resources.js`, `pull.resources.js`, `provision.*.js`) and the
  WordPress/DDEV stack itself (`web/`, `wp-cli.yml`). Those already run
  outside Docker via DDEV/Composer per [AGENTS.md](../AGENTS.md) and are not
  part of this Compose file.

## Non-goals

- This Compose file does not replace DDEV for the Bedrock/WordPress site. It
  only containerizes the standalone Express static server.
- No production orchestration (scaling, TLS termination, reverse proxy) is
  specified. TLS/reverse proxy, if needed, is left to whatever fronts this
  container in a given environment.
- No image build, push, or registry is part of this spec, and Compose has no
  native "run once at container creation" hook. Dependency installation is
  instead handled by an idempotent entrypoint (see below): it only runs
  `npm ci` when `node_modules/` is missing its install marker, storing the
  result in a container-scoped named volume rather than on the host, so a
  fresh deploy installs dependencies on first start while subsequent
  restarts skip straight to serving.

## docker-compose.yml

- `services.web.image: node:<lts>-alpine` (no `build:` section).
- `working_dir: /app`. No `user:` override — the container runs as its
  default root user because the named `node_modules` volume is created
  root-owned by Docker and there is no `Dockerfile` build step available to
  `chown` it to a non-root user before `npm ci` writes to it. Revisit this if
  a `Dockerfile` is introduced later (it could pre-create and own the
  directory as a non-root user).
- `volumes`:
  - Bind-mount `./server.js`, `./src`, `./public`, `./package.json`, and
    `./package-lock.json` read-only to their matching paths under `/app`
    (e.g. `./server.js:/app/server.js:ro`, `./src:/app/src:ro`,
    `./public:/app/public:ro`), so only the files the server actually needs
    are exposed to the container.
  - Mount a named volume, `node_modules`, at `/app/node_modules` (declared
    under the top-level `volumes:` key). Unlike the other mounts, this is a
    Docker-managed volume, not a host bind mount, so packages installed by
    `npm ci` live only inside Docker's storage and are never written to, or
    read from, the host filesystem. It persists across container
    recreations (until the volume is explicitly removed), so the install
    only happens once per volume lifetime, and there is no host-container
    UID/permission mismatch to account for since the volume isn't backed by
    a host directory.
  - Bind-mount the host path referenced by `${SERVE_ROOT}` into the
    container at a separate fixed path (e.g. `/data/site:ro`), and pass that
    fixed in-container path as the `ROOT` argument. Mount read-only since the
    server only serves static files and must not be able to mutate recovered
    data.
  - Bind-mount the host file referenced by `${SERVE_INDEX_PATH}` into the
    container at its own fixed path (e.g. `/data/index.html:ro`), and pass
    that fixed in-container path as the `INDEX_PATH` argument. It is mounted
    separately from `ROOT` because `INDEX_PATH` is read directly by
    filesystem path rather than resolved under `ROOT` (see
    [index.js](../src/sever/routes/index.js)) and may point outside the
    `ROOT` directory tree.
- `entrypoint: ["sh", "-c"]` with a `command` script that first checks for
  `node_modules/.package-lock.json` (npm's own install marker) and runs
  `npm ci --omit=dev` only if it is missing, then `exec`s
  `node --use-system-ca server.js /data/site /data/index.html`. `exec` keeps
  the Node process as PID 1 so container signals (`SIGTERM`) still reach it
  for graceful shutdown (see [server.js](../server.js)).
- The actual host paths for `ROOT`/`INDEX_PATH` come from `${SERVE_ROOT}` and
  `${SERVE_INDEX_PATH}` in the Compose volume mapping, read from an untracked
  `.env` file at the repository root (Compose's own `.env`, distinct from the
  Node app's `--env-file`), so the served path is configurable per
  environment without editing the committed Compose file.
- `restart: unless-stopped` for long-running use; omit any `depends_on`
  since this service has no other dependency in this repo.
- `ports: ["${WEB_PORT:-3000}:3000"]` so the host port is configurable and
  defaults sensibly.
- No secrets are required to run this specific server (it serves static
  files and does not call the WordPress REST API), so the Compose file itself
  should declare no `environment:` entries containing credentials. If a
  future change makes this server call the WP REST API, follow the
  credential-handling section below instead of inlining values.

## Credential-handling guidance (for this and future Compose services)

Even though the static file server needs no credentials today, this project
already has WordPress/production credentials (`WP_USERNAME`,
`APPLICATION_PASSWORD`, `PRODUCTION_WP_USERNAME`,
`PRODUCTION_APPLICATION_PASSWORD` in `.env`, per [config.js](../config.js))
that must never leak into an image or a committed file. Recommended practice
for any Compose service that does need them:

1. **Never bake secrets into an image or bind mount.** Since the repository
   itself is bind-mounted into the container, ensure the deployed copy on the
   remote system excludes `.env`/`.env.*` (they are already gitignored, so a
   `git`-based deploy naturally excludes them) and that no other copy step
   re-adds them.
2. **Keep secrets in the untracked `.env`.** The repository already ignores
   `.env` and `.env.*` while allowing `.env.example` (see
   [.gitignore](../.gitignore)). Add a `.env.example` documenting variable
   *names* only, with placeholder or empty values, so onboarding developers
   know what to set without ever committing real secrets.
3. **Pass secrets at runtime, not build time**, via Compose's `env_file:` or
   `environment:` referencing host/`.env` variables
   (`APPLICATION_PASSWORD: ${APPLICATION_PASSWORD}`). This keeps them out of
   the image and out of `docker inspect`-visible build args.
4. **Prefer Docker secrets over plain environment variables where possible**
   (e.g. `docker compose --file compose.secrets.yml` using the `secrets:`
   top-level key backed by files under a local, gitignored directory, or an
   external secrets manager). Environment variables are readable by any
   process in the container and can leak via logs or `/proc`; file-based
   secrets mounted at a known path (e.g. `/run/secrets/wp_app_password`) are
   preferable for anything beyond local development.
5. **Rotate and scope application passwords.** WordPress Application
   Passwords (already used here per `APPLICATION_PASSWORD`) should be
   generated per-consumer (one for local dev, one for CI, one for this
   container) so a leaked value can be revoked without affecting other
   integrations.
6. **Never log secret values.** Ensure any future code added to this server
   does not print environment variables or request headers containing
   credentials.
7. **Restrict file permissions and git history.** Confirm `.env` is not, and
   has never been, committed (`git log --all -- .env`); if it was, rotate the
   exposed credentials rather than relying on history rewriting alone.

## Acceptance criteria

- `docker compose up` starts the official `node` image against the
  bind-mounted repository and serves the directory referenced by
  `SERVE_ROOT` on `http://localhost:${WEB_PORT:-3000}`, reproducing current
  `node server.js <ROOT>` behavior.
- Changing `SERVE_ROOT` in `.env` and restarting the service serves a
  different local directory with no build step involved.
- No credential values appear in the committed `docker-compose.yml`.
- `.env.example` lists any configuration variables (e.g. `SERVE_ROOT`,
  `WEB_PORT`) with no real secret values.
