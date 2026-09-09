# Spec: Idempotent WordPress resource puller

## Goal

Provide a small JavaScript command-line tool that pulls existing resources from
the production WordPress instance into the local WordPress instance through the
REST API, so an author can work on a real page locally and later publish it
back with [publish.resources.js](../publish.resources.js).

The puller is the inbound counterpart of the
[idempotent resource publisher](idempotent-resource-publisher.md). Running the
same pull repeatedly must refresh the same local resource rather than creating
duplicates, and it must record the local/production ID pairing that the
publisher needs.

## Scope

- Source: the production WordPress REST API configured by
  `PRODUCTION_WP_SITE_URL`, `PRODUCTION_WP_USERNAME`, and
  `PRODUCTION_APPLICATION_PASSWORD` in `.env`.
- Target: the local WordPress REST API configured by `WP_SITE_URL`,
  `WP_USERNAME`, and `APPLICATION_PASSWORD` in `.env`.
- Both credential sets must be present before any resource is read or written.
- Supported resource type in v1: **pages only**. Categories, posts, and events
  reuse the publisher's resource configuration and are added later.
- Manifests and generated reports live in `migrations/`, the same directory the
  publisher reads.
- The historical exports under `backup/` are reference material only and are
  never read or written by this tool.
- Explicit invocation by a user; no automatic scheduled sync.

Media, other custom post types, tags, authors, menus, and Elementor template
relationships are out of scope, exactly as in the publisher. The puller never
writes to production.

## Direction and safety asymmetry

The puller only writes locally. Production is strictly read-only:

- Only `GET` requests are ever sent to the production site.
- Every write (`POST`/`PUT`) targets the local site.
- A `--pull` flag is required for any local write; without it the tool is a dry
  run that reports the intended local changes and exits non-zero when a write
  would be required.

Because local content is disposable, the puller does not need production-side
revision guards. It does need a local-side guard so it never silently discards
unpublished local work: see "Overwrite protection".

## Command interface

Create `pull.resources.js` at the repository root. Every operation targets one
manifest path inside `migrations/`:

```bash
# Show what would be pulled. This is the default mode.
node --env-file=.env --use-system-ca pull.resources.js --add page:2066 migrations/2026-09-08-homepage.json

# Pull the requested production pages into local WordPress and record the mapping.
node --env-file=.env --use-system-ca pull.resources.js --pull --add page:2066 migrations/2026-09-08-homepage.json

# Refresh every page already declared in the manifest from production.
node --env-file=.env --use-system-ca pull.resources.js --pull --refresh migrations/2026-09-08-homepage.json

# Replace an existing local resource instead of creating a new one.
node --env-file=.env --use-system-ca pull.resources.js --pull --add page:2066=2066 migrations/2026-09-08-homepage.json
```

Rules:

1. Exactly one manifest path is required for every operation. It must be inside
   `migrations/`, have a `.json` extension, and must not traverse outside it.
   A missing manifest is created as a valid empty manifest only when `--pull`
   is used; a dry run never creates a file.
2. `--add` accepts one or more references in the form `<type>:<production-id>`
   or `<type>:<production-id>=<local-id>`. IDs must be positive integers. In
   v1 the only accepted type is `page`.
   - Without a local ID, the tool resolves the local target from the manifest;
     if the manifest has no entry, it creates a new local page.
   - With an explicit local ID, that page must already exist locally and be a
     page, otherwise the reference fails.
3. `--refresh` pulls every supported entry already listed in the manifest's
   `resources`, using its recorded `productionId` and `localId`. It never adds
   new entries. `--refresh` and `--add` may be combined.
4. `--pull` is the only flag that permits local writes.
5. Reject unknown flags, conflicting operations, an empty reference list, and
   duplicate references to the same production or local ID within one run.
6. Do not accept an unbounded `all` option, a slug/title search, or a
   "pull whole site" mode.

## Resolving the local target

The puller must never resolve a local target by title, slug, permalink, or an
assumed equal ID. Resolution order for a `page:<productionId>` reference:

1. The manifest entry whose `type` and `productionId` match, using its
   `localId`.
2. The explicit `=<local-id>` given on the command line.
3. Otherwise create a new local page.

When both a manifest entry and an explicit local ID exist and they disagree,
that is an error; the user must edit or regenerate the manifest deliberately.

## Per-resource behavior

Resources are fetched from production concurrently with
`Promise.allSettled()`, then applied locally in deterministic order:

1. Fetch the production resource by `productionId` with `context=edit` and
   validate the expected page shape.
2. Resolve the local target as described above.
3. When a local target exists, fetch it and validate its type. Apply the
   overwrite protection check below.
4. Convert the production record to an allowlisted local payload using the same
   field allowlist as the publisher: `title`, `slug`, `content`, `status`,
   `parent` (mapped, see below), and the approved Elementor meta keys. Never
   copy IDs, GUIDs, links, authors, dates, generated REST links, or unknown
   meta fields.
5. Compare the payload with the existing local resource. Report `unchanged`
   without a write when no allowlisted field differs.
6. Create or update the local resource. The production `status` is copied
   faithfully and also recorded in the manifest entry as `productionStatus`.
   Local status must mirror production so that a later publish of the same
   manifest does not unpublish a live production page as a side effect of the
   pull; the local site is not public, so there is no safety gain in forcing
   `draft` here.
7. Re-fetch the local record and verify its allowlisted fields.
8. Report the production ID, resulting local ID, action (`created`, `updated`,
   or `unchanged`), and changed field names.

### Parent mapping

Pages are hierarchical. A pulled page whose production `parent` is non-zero
must map that parent to a local page ID through the manifest. If the parent is
not yet mapped, the puller pulls the parent first within the same run
(recursively, depth-limited and cycle-guarded) and records it as its own
manifest entry. A parent that cannot be resolved fails the child; a numeric
production parent ID is never written to a local page.

## Overwrite protection

Pulling replaces local content, which may destroy in-progress local edits. The
puller records `pulledLocalModifiedGmt` in the manifest entry after each
successful write: the local resource's `modified_gmt` as it stood immediately
after the pull.

Before overwriting an existing local resource, the puller compares the current
local `modified_gmt` with `pulledLocalModifiedGmt`:

- Equal: the local copy has not been edited since the last pull; overwrite it.
- Different or missing: the local copy contains work that did not come from
  this tool. Refuse the resource and report a conflict, unless
  `--force-local-overwrite` is given.

`--force-local-overwrite` requires `--pull` and applies only to the references
of the current run.

## Local backup before overwrite

When `--pull` would overwrite an existing local resource, the puller first
writes a single backup file capturing the full raw local representation of each
resource it is about to overwrite, before performing any write. It is written
to `migrations/backups/<manifest-name>/pull-<capturedAt-timestamp>.json` and
includes the manifest path, capture time, direction (`pull`), and each
resource's `type`, `localId`, `productionId`, and raw pre-overwrite local
payload.

The backup is scoped to the resources targeted by the run, is written
atomically, and is only produced during `--pull`. Newly created local resources
contribute no backup entry. A dry run never writes one.

## Manifest interaction

The puller reads and writes the same manifest format as the publisher, and must
preserve fields it does not own (`version`, `createdAt`, `baseRevision`,
`files`, and unrelated `resources` entries).

For each successfully pulled resource it writes or refreshes an entry:

```json
{
  "type": "page",
  "localId": 2066,
  "productionId": 2066,
  "productionStatus": "publish",
  "pulledAt": "2026-09-09T09:12:00Z",
  "pulledLocalModifiedGmt": "2026-09-09T09:12:01",
  "expectedProductionModifiedGmt": "2026-09-01T10:15:00"
}
```

`expectedProductionModifiedGmt` is set to the production `modified_gmt`
observed during the pull, which is exactly the guard the publisher expects. A
pull therefore leaves the manifest immediately ready for a later
`publish.resources.js` dry run, without a separate `--add` step.

The manifest write must be atomic: build the complete revised JSON in memory,
write a temporary file alongside the manifest, then rename it over the target
only after every local write in the run has been applied and verified. A run in
which some resources fail still records the entries that were pulled
successfully, because those local resources really were modified; the summary
and exit code report the failures.

## Safety and failure behavior

- Use HTTP Basic authentication with the configured application passwords.
- Require HTTPS for the production site. Allow an explicit local-development
  exception only for the local site URL.
- Print a concise per-resource plan in dry-run mode: production reference,
  resolved local target or `create`, intended action, and changed fields.
- Do not log credentials or Authorization headers.
- Continue processing independent resources after an error, then exit non-zero
  and summarize successes and failures.
- Stop before local writes when preflight discovers an unavailable REST
  endpoint, invalid credentials, a missing production resource, or an
  unresolvable declared local target.
- Never send a write request to the production site, and never modify local
  resources outside the selected references and their required parents.

## Round-trip workflow

1. Pull the page(s) to work on:
   `pull.resources.js --pull --add page:2066 migrations/<release>.json`.
2. Edit the page locally in wp-admin/Elementor.
3. Review the intended publish with `publish.resources.js
   migrations/<release>.json` (no `--apply`).
4. Publish with `publish.resources.js --apply migrations/<release>.json`.
5. Optionally re-run the puller with `--refresh` to realign local state and the
   manifest guards with production.

If production changed between step 1 and step 3, the publisher's
`expectedProductionModifiedGmt` guard fails, which is the intended conflict
signal. Resolving it means re-pulling and reapplying the local work, not
editing the guard by hand.

## Acceptance criteria

- A repeated pull of the same production page updates the same local page and
  never creates a duplicate.
- A dry run performs no POST or PUT request to either site.
- No request other than `GET` is ever sent to the production site.
- A local page edited since its last pull is refused with a clear conflict
  error and no write, unless `--force-local-overwrite` is given.
- Pulling a page with a production parent also maps or pulls that parent and
  never writes a production parent ID into a local page.
- A newly created local page mirrors the production status, which is also
  recorded in the manifest as `productionStatus`.
- After a successful pull, running `publish.resources.js` without `--apply`
  against the same manifest reports `unchanged` for the pulled resource with no
  guard conflict.
- An existing local page that is about to be overwritten is captured in a pull
  backup file before any write, and a dry run never writes one.
- Resources outside the selected references and their required parents are
  never modified.
