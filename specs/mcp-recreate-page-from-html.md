# Spec: Recreate a WordPress page from scraped HTML via the MCP server

## Goal

Validate that Copilot, acting only through the `wordpress` MCP server tools (no
custom scripts), can read a scraped static HTML page and recreate it as a real
page on the local WordPress site.

## First milestone

Recreate **exactly one page** end-to-end. Do not attempt a batch/bulk import
yet — this is a feasibility test for the workflow, not a migration run.

## Source data

Use the raw scraped HTML tree under [backup/html/](../backup/html/),
**not** [backup/pages/](../backup/pages/) (that folder holds
pre-extracted WP REST API JSON exports and is out of scope here).

Each folder under `backup/html/` mirrors a URL path from the original
`resah.fr` site and contains a full `index.html` snapshot (complete document:
`<head>`, tracking scripts, Elementor/Astra markup, nav, footer, etc.).

Candidate target for the first attempt: `backup/html/centre-de-ressources-et-d-expertise/appui/index.html`
(a small leaf page). Pick a different leaf page if this one turns out to be
too complex once inspected.

## Out of scope for this first milestone

- Recreating the original Elementor builder structure/JSON (`_elementor_data`).
  The target page just needs to render the same visible content using plain
  Gutenberg blocks.
- Images/media re-upload — text/structure only for now, note any images found
  but don't upload them.
- Navigation, header, footer, tracking scripts, inline `<style>`/`<script>` —
  strip all of it, keep only the actual page content region.
- Bulk/looped processing of multiple pages.

## Process

0. **Pre-trim** the raw scraped file *before* it ever enters the model's
   context — run it through [src/mcp-utils.js](../src/mcp-utils.js)'s:
   - `stripHeadAndStyles()` (uses the project's existing `cheerio` dependency)
     to remove the entire `<head>` and any `<style>` tags anywhere in the
     document. This alone strips most of the tracking scripts/CSS noise seen
     in the raw files and meaningfully shrinks what needs to be read.
   - `stripSiteDomain()` to remove any reference to the old site's domain
     (`resah.fr` / `www.resah.fr`, any scheme or protocol-relative), turning
     absolute URLs back into on-site relative/absolute paths, and remapping
     `/wp-content/uploads` to Bedrock's `/app/uploads`.
1. Read the trimmed HTML (not the original raw file).
2. Extract the main content region using [src/mcp-utils.js](../src/mcp-utils.js)'s
   `cleanHtml()` helper — an MCP-specific variant of the original
   [src/utils.js](../src/utils.js) helper of the same name, fixed to target
   the actual page-content Elementor root (`data-elementor-type="wp-page"`,
   not the header/footer, which are also `.elementor` containers appearing
   earlier in the DOM) and to keep **all** top-level content sections instead
   of only the first one.
3. Convert the extracted content into valid Gutenberg block markup (headings,
   paragraphs, lists, links) — simplified, not a pixel-perfect Elementor clone.
4. Use the MCP tool `wp_add_page` to create the page with:
   - `title`: derived from the page's `<title>`/`<h1>`/breadcrumb.
   - `content`: the converted Gutenberg block markup.
   - `slug`: derived from the source folder path segment (e.g. `appui`).
   - `status`: `draft` (do not publish automatically for this test).
5. Use `wp_pages_search` to confirm the page now exists with the expected
   slug/title/status.
6. Manually open the created page in `wp-admin` to visually compare against
   the original scraped HTML.

## Tools available (via `wordpress-mcp` plugin, already enabled)

- `wp_add_page` — create the page (create tools are enabled).
- `wp_pages_search` — verify the result.
- `wp_update_page` — available if a follow-up correction pass is needed.

Delete tools and the experimental generic REST CRUD tools are intentionally
disabled — this test should not need them.

## Success criteria

- Exactly one new WordPress page exists, created solely via MCP tool calls
  (no direct REST calls, no `provision.page.js`).
- The page's visible text content (headings, paragraphs, links) matches the
  source HTML's main content region.
- The page is left in `draft` status for manual review.

## Open questions / risks to observe during the test

- How well does the model strip Elementor/Astra noise vs. keeping actual
  content — may need a second pass with more explicit extraction instructions.
- Whether `wp_add_page`'s Gutenberg content is accepted as-is by WordPress
  (block validation) or needs `raw`/`classic` fallback.
- Large scraped HTML files may exceed practical context size — may need to
  pre-trim the file (e.g. grep out `<head>`) before handing it to the model.
