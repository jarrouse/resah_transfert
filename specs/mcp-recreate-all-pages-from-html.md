# Spec: Recreate all WordPress pages from scraped HTML via the MCP server

## Goal

Migrate every scraped page snapshot under [backup/html/](../backup/html/)
to the local WordPress site. The migration must use only the `wordpress` MCP
server tools for WordPress changes; it must not use direct REST calls,
`provision.page.js`, or bulk-import scripts.

This is the batch counterpart to
[mcp-recreate-page-from-html.md](mcp-recreate-page-from-html.md). Apply the
same content-extraction and Gutenberg-conversion rules to every source page.

## Source discovery

1. Recursively find every `index.html` below `backup/html/`.
2. Treat the directory containing each file as that page's source path. For
   example, `backup/html/centre-de-ressources-et-d-expertise/appui/index.html`
   maps to the relative source path
   `centre-de-ressources-et-d-expertise/appui`.
3. Process pages ordered by path depth, then alphabetically. This creates
   parent paths before their children.
4. Do not process files outside `backup/html/` and do not use the JSON exports
   in `backup/pages/`.
5. Do not query, create, update, or configure a WordPress front/home page.
   Only create pages represented by a discovered
   `backup/html/**/index.html` snapshot.

## Per-page process

For each discovered `index.html`:

1. Read the raw HTML and pre-trim it before further analysis with
   [src/mcp-utils.js](../src/mcp-utils.js):
   `stripHeadAndStyles()`, followed by `stripSiteDomain()`.
2. Extract the actual page-content region from the trimmed HTML with
   `cleanHtml()`. It targets the Elementor `wp-page`/`single-page` root and
   retains every top-level section.
3. Convert the extracted main content to valid, simplified Gutenberg block
   markup. Preserve visible headings, paragraphs, lists, and links. Do not
   recreate Elementor data, site navigation, header, footer, tracking code,
   inline styles/scripts, or media uploads.
    - Gutenberg links are standard HTML `<a>` tags inside the relevant block;
       do not use a separate link format.
    - Preserve cleaned internal destinations as site-relative paths, such as
       `/centre-de-ressources-et-d-expertise/appui/`, and retain external
       destinations as absolute `https://` URLs.
    - Preserve an original `target="_blank"` when present and include
       `rel="noopener"` on every link that opens in a new tab.
4. Derive the title from the source document's `<title>`, `<h1>`, or
   breadcrumb, in that order. Derive the slug from the final source-path
   segment.
5. Search with `wp_pages_search` for the expected page before creating it.
   If it already exists, record it as `skipped-existing` and do not create a
   duplicate. Do not overwrite an existing page in this migration run.
6. Create a missing page with `wp_add_page`, using the derived title, slug,
   Gutenberg content, and `draft` status.
7. For nested paths, associate the page with the WordPress page created for
   its immediate parent source path when the MCP create tool supports a parent
   field. If parent assignment is unavailable, record `parent-not-set` for
   later manual correction while still creating the page.
8. Search again with `wp_pages_search` to verify the newly created page has
   the expected title, slug, and draft status. Record its WordPress ID.

## Failure handling and migration log

Maintain a migration log for the entire run. For each source path, record:

- source path
- derived title and slug
- result: `created`, `skipped-existing`, `failed`, or `parent-not-set`
- WordPress page ID when available
- concise error or review note when applicable

If one page cannot be extracted, converted, created, or verified, record the
failure and continue with the remaining pages. At the end, report the complete
log and a count for each result. Do not silently omit a discovered `index.html`.

## Completion criteria

- Every discovered `backup/html/**/index.html` has exactly one log entry.
- Every newly created page is a draft and was created only through MCP tool
  calls.
- Each created page is confirmed through `wp_pages_search`.
- Visible source content is represented as simplified Gutenberg blocks; media
  and theme chrome remain out of scope.
- Existing WordPress pages are never duplicated or modified by this run.