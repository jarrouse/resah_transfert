# Spec: Idempotent WordPress resource publisher

## Goal

Provide a small JavaScript command-line tool that publishes selected current
resources from the local WordPress instance to a production WordPress instance
through the REST API. Running the same migration repeatedly must update the
same target resources rather than creating duplicates.

The tool is intended for controlled local-to-public publishing. It is not a
full database synchronizer and must not require an agent to perform changes.

## Scope

- Source: the local WordPress REST API configured by `WP_SITE_URL`,
   `WP_USERNAME`, and `APPLICATION_PASSWORD` in `.env`.
- Migration definitions and generated reports: `migrations/`.
- Historical exports from the former public site: `backup/`. They are
   reference material only and must never be treated as publish input.
- Supported resource types: pages, categories, posts, and events (`tribe_events`
   from The Events Calendar).
- Target: the production WordPress REST API configured by
   `PRODUCTION_WP_SITE_URL`, `PRODUCTION_WP_USERNAME`, and
   `PRODUCTION_APPLICATION_PASSWORD` in `.env`. These are separate credentials
   from the source site and both sets must be present before any resource is
   read or written.
- Explicit invocation by a user; no automatic deployment hook in the first
  version.

Media, other custom post types, tags, authors, menus, and Elementor template
relationships are out of scope until their identity and reference-mapping
rules are specified. For events specifically, venue, organizer, ticket, and
category/tag term assignments are cross-site references with unresolved
identity mapping and are never read or written; only the title, description,
slug, status, schedule (`start_date`, `end_date`, `all_day`, `timezone`), and
`cost` fields are synced. Events use The Events Calendar's own
`tribe/events/v1` REST API instead of `wp/v2`, since scheduling fields are not
exposed through the core post-type REST controller.

## Migration manifests

Each publishable release is an explicit JSON manifest under `migrations/`.
Its filename is the release identifier, for example
`migrations/2026-09-08-homepage.json`:

```json
{
   "version": 1,
   "createdAt": "2026-09-08T14:30:00Z",
   "baseRevision": "a1b2c3d4",
   "files": [
      "web/app/mu-plugins/resah-homepage-widgets.php"
   ],
   "resources": [
      {
         "type": "page",
         "localId": 2066,
         "productionId": 2066,
         "expectedProductionModifiedGmt": "2026-09-01T10:15:00"
      },
      {
         "type": "category",
         "localId": 108,
         "productionId": 108,
         "expectedProductionModifiedGmt": "2026-09-02T09:00:00"
      }
   ]
}
```

`files` is the reviewed list of repository files that must be deployed with
the resource release. The publisher records it but does not transfer or modify
those files; normal code deployment remains responsible for them. `resources`
is the only list the publisher may modify through the WordPress REST API.

`localId` and `productionId` are deliberately separate. The original public
exports in `backup/` can help determine the production ID when creating the
first manifest, but they are not input to the publisher. The script must never
resolve a target by title, slug, permalink, or an assumed equal local ID.

`expectedProductionModifiedGmt` is mandatory for updates. It is captured from
production during migration planning and protects edits made directly on the
public site. If it no longer matches, the publisher must refuse that resource
until the manifest is regenerated after a human conflict review.

## Command interface

Create `publish.resources.js` at the repository root. Every operation targets
one manifest path inside `migrations/`:

```bash
# Create an empty release manifest. Refuse when the target file exists.
node --env-file=.env --use-system-ca publish.resources.js --create migrations/2026-09-08-homepage.json

# Add Git-tracked changed files since a reviewed base commit.
node --env-file=.env --use-system-ca publish.resources.js --add-files-from HEAD~1 migrations/2026-09-08-homepage.json

# Add WordPress resources and asynchronously obtain their production revision guards.
node --env-file=.env --use-system-ca publish.resources.js --add page:2066=2066 category:108=108 migrations/2026-09-08-homepage.json

# Show the intended changes. This is the default mode.
node --env-file=.env --use-system-ca publish.resources.js migrations/2026-09-08-homepage.json

# Apply only the resources declared in the reviewed manifest.
node --env-file=.env --use-system-ca publish.resources.js --apply migrations/2026-09-08-homepage.json
```

Rules:

1. Exactly one manifest path is required for every operation. It must be inside
   `migrations/`, have a `.json` extension, and must not traverse outside it.
2. `--create` creates a new valid empty manifest with `version`, `createdAt`,
   an empty `files` array, and an empty `resources` array. It must not overwrite
   an existing manifest.
3. `--add-files-from <revision>` runs `git diff --name-only
   <revision>...HEAD`, validates that the revision resolves, and adds the
   resulting repository-relative file paths to `files`. Store the resolved base
   commit hash as `baseRevision`. Deduplicate and sort paths. Deleted paths are
   retained with a `deleted: true` marker for release review, but are never
   deleted by this publisher.
4. `--add` accepts one or more explicit references in the form
   `<type>:<local-id>=<production-id>`, followed by the manifest path. IDs must
   be positive integers and types are limited to `page`, `category`, `post`,
   and `event`.
5. A missing, malformed, empty, duplicate, or type-mismatched manifest entry is
   an error. A resource may not be inferred from a changed Git file: code-file
   changes and WordPress resource changes have different identities.
6. `--apply` is the only flag that permits writes. Without it, exit non-zero
   when a write would be required so it can be used as a review/CI gate.
7. Reject unknown flags and conflicting operations. Do not accept an unbounded
   `all` option.

## Adding WordPress resources

`--add` may run after `--create`, independently of the final publish command.
It fetches every requested local resource and its declared production resource
concurrently using `Promise.allSettled()`. This asynchronous discovery must not
write to WordPress.

For each successful resource, the tool writes or refreshes a manifest entry
containing its type, `localId`, `productionId`, and the production resource's
current `modified_gmt` as `expectedProductionModifiedGmt`. It must first verify
that both resources exist and match the declared type. A missing target, bad
credentials, or unexpected REST response leaves the manifest unchanged and
returns a non-zero exit code; do not write a partially populated manifest.

The manifest write must be atomic: build the complete revised JSON in memory,
write a temporary file alongside the manifest, then rename it over the target
only when every requested lookup succeeds. Existing unrelated entries remain
unchanged. Re-adding the same type/local/production tuple refreshes its
`expectedProductionModifiedGmt`; an attempt to reuse a local or production ID
for a different entry is an error.

## Per-resource behavior

For each resource, in deterministic order:

1. Fetch the local resource by `localId` and validate the expected resource
   shape.
2. Fetch the production resource by `productionId`; a missing target is a hard
   error. The publisher must not create production resources in v1.
3. Compare the target `modified_gmt` with `expectedProductionModifiedGmt`.
   Refuse an update when they differ.
4. Convert the local record to an allowlisted target payload. Preserve fields
   relevant to the resource, including title/name, slug, content/description,
   status, parent mapping where supported, and approved custom meta. Never send
   source-only IDs, GUIDs, links, authors, dates, generated REST
   links, or unknown meta fields.
5. Compare the allowlisted local payload with the production resource. Report
   `unchanged` without a write when no fields differ.
6. Update a changed resource with `POST` or `PUT` to its declared
   `productionId`.
7. Re-fetch the target record and verify its allowlisted fields. Report its
   target ID, action (`updated` or `unchanged`), and manifest reference.

For parent pages and categories, process parents before children. A child entry
must declare the production parent ID where the parent differs from local.
Never copy a local numeric parent ID to production. Fail a child whose selected
parent does not exist on production. Posts and events are not hierarchical and
have no parent mapping.

## Backup before apply

When `--apply` is used, the publisher first fetches and validates every
manifest resource (steps 1-3 above) without writing anything, then writes a
single backup file capturing the full raw production representation of each
successfully validated resource, before performing any update. The backup is
written to `migrations/backups/<manifest-name>/<capturedAt-timestamp>.json`
and includes the manifest path, capture time, and each resource's `type`,
`localId`, `productionId`, and raw pre-update production payload.

The backup is scoped to only the resources targeted by the manifest, is
written atomically like a manifest, and is only produced during `--apply`; a
dry run never creates one. This provides a restore point for manual rollback
if an applied migration needs to be reverted; the publisher does not itself
provide a rollback command in this version.

## Safety and failure behavior

- Use HTTP Basic authentication with the configured application password.
- Require HTTPS unless an explicit local-development override is added later.
- Print a concise per-resource plan in dry-run mode, including the source
  reference, intended action, target ID when found, and changed fields.
- Do not log credentials or Authorization headers.
- Continue processing independent resources after an error, then exit non-zero
  and summarize successes and failures.
- Stop before writes when preflight discovers an unavailable REST endpoint,
  invalid credentials, a missing declared production resource, or a production
  revision conflict.
- Do not modify resources outside the selected references.

## Git-assisted workflow

An agent may inspect a previous commit and suggest a targeted
`--add-files-from` or `--add` command, but the user runs and approves the
command. The agent must not use production credentials or invoke `--apply`
itself.

Recommended release sequence:

1. Create a named migration manifest with `--create`.
2. Add the release's Git-tracked files using `--add-files-from
   <last-deployed-revision>`.
3. Add each resource intentionally with `--add`, which captures its production
   revision guard asynchronously.
4. Commit the reviewed manifest and supporting Bedrock code.
5. Run the manifest without `--apply` and review the exact resources and
   actions.
6. Deploy required code.
7. Run the same command with `--apply` using production credentials.
8. Keep the command output with the deployment record.

## Acceptance criteria

- A repeated `--apply` of the same manifest updates only its declared target
   resource and never creates a duplicate page, category, post, or event.
- A changed production `modified_gmt` causes a clear conflict error and no
   write for that resource.
- A dry run performs no POST, PUT, or DELETE request.
- `--create` refuses to overwrite an existing migration manifest.
- `--add-files-from` adds only paths changed in the supplied Git revision
   range, and records the resolved base revision.
- `--add` discovers multiple declared local/production resource pairs
   concurrently, records their production revision guards, and leaves the
   manifest unchanged when any requested pair cannot be resolved.
- The tool can update an existing target resource when its numeric ID differs
   from its local source ID.
- Resources outside the manifest are never read for update or modified.
- `--apply` writes a backup file with the pre-update production state of every
   targeted resource before making any write, and a dry run never writes one.