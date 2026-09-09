#!/usr/bin/env node
// Idempotent WordPress resource puller. See specs/idempotent-resource-puller.md.

import fs from 'node:fs/promises';
import path from 'node:path';

import config from './config.js';

const {
  WP_SITE_URL,
  WP_USERNAME,
  APPLICATION_PASSWORD,
  PRODUCTION_WP_SITE_URL,
  PRODUCTION_WP_USERNAME,
  PRODUCTION_APPLICATION_PASSWORD,
} = config;

const SITES = {
  local: { siteUrl: WP_SITE_URL, username: WP_USERNAME, applicationPassword: APPLICATION_PASSWORD },
  production: {
    siteUrl: PRODUCTION_WP_SITE_URL,
    username: PRODUCTION_WP_USERNAME,
    applicationPassword: PRODUCTION_APPLICATION_PASSWORD,
  },
};

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

const MAX_PARENT_DEPTH = 10;

const RESOURCE_CONFIGS = {
  page: {
    endpoint: 'pages',
    metaAllowlist: [
      '_elementor_data',
      '_elementor_edit_mode',
      '_elementor_template_type',
      '_elementor_version',
      '_elementor_page_settings',
    ],
    validateShape(resource) {
      return resource && typeof resource.id === 'number' && typeof resource.slug === 'string' && resource.title != null;
    },
    buildPayload(production, parentLocalId, metaAllowlist) {
      return {
        title: production.title?.raw ?? '',
        slug: production.slug ?? '',
        content: production.content?.raw ?? '',
        status: production.status,
        parent: parentLocalId,
        meta: pickAllowedMeta(production.meta, metaAllowlist),
      };
    },
    buildComparable(local, metaAllowlist) {
      return {
        title: local.title?.raw ?? '',
        slug: local.slug ?? '',
        content: local.content?.raw ?? '',
        status: local.status,
        parent: local.parent ?? 0,
        meta: pickAllowedMeta(local.meta, metaAllowlist),
      };
    },
  },
};

const RESOURCE_TYPES = Object.keys(RESOURCE_CONFIGS);

function pickAllowedMeta(meta, allowlist) {
  const result = {};
  if (!meta || !allowlist) return result;
  for (const key of allowlist) {
    if (Object.prototype.hasOwnProperty.call(meta, key)) {
      result[key] = meta[key];
    }
  }
  return result;
}

function usageError(message) {
  const error = new Error(message);
  error.isUsageError = true;
  return error;
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function resolveManifestPath(manifestArg) {
  if (!manifestArg || manifestArg.startsWith('--')) {
    throw usageError('A manifest path inside migrations/ is required as the last argument.');
  }
  if (path.extname(manifestArg) !== '.json') {
    throw usageError(`Manifest path must have a .json extension: ${manifestArg}`);
  }
  const resolved = path.resolve(process.cwd(), manifestArg);
  const rel = path.relative(MIGRATIONS_DIR, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw usageError(`Manifest path must be inside migrations/: ${manifestArg}`);
  }
  return resolved;
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function emptyManifest() {
  return { version: 1, createdAt: new Date().toISOString(), files: [], resources: [] };
}

async function readOrInitManifest(manifestPath) {
  if (!(await pathExists(manifestPath))) {
    return emptyManifest();
  }
  const raw = await fs.readFile(manifestPath, 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    throw usageError(`Manifest is not valid JSON: ${manifestPath} (${error.message})`);
  }
  if (!Array.isArray(manifest.files)) manifest.files = [];
  if (!Array.isArray(manifest.resources)) manifest.resources = [];
  return manifest;
}

async function writeJsonAtomic(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  await fs.writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(tmpPath, filePath);
}

// One backup file per --pull run, capturing the pre-overwrite local state of
// every resource the run is about to replace.
function backupPath(manifestPath) {
  const manifestName = path.basename(manifestPath, '.json');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(MIGRATIONS_DIR, 'backups', manifestName, `pull-${timestamp}.json`);
}

function requireSiteConfig(site) {
  const { siteUrl, username, applicationPassword } = SITES[site];
  const envNames =
    site === 'production'
      ? 'PRODUCTION_WP_SITE_URL/PRODUCTION_WP_USERNAME/PRODUCTION_APPLICATION_PASSWORD'
      : 'WP_SITE_URL/WP_USERNAME/APPLICATION_PASSWORD';
  if (!siteUrl || !username || !applicationPassword) {
    throw usageError(`Missing ${site} site credentials: set ${envNames} in .env.`);
  }
  if (!siteUrl.startsWith('https://')) {
    // Only the local site may be plain HTTP, and only with an explicit override.
    if (site === 'production' || process.env.WP_ALLOW_INSECURE_HTTP !== '1') {
      throw usageError(
        `${site === 'production' ? 'PRODUCTION_WP_SITE_URL' : 'WP_SITE_URL'} must use HTTPS${
          site === 'production' ? '' : ' (set WP_ALLOW_INSECURE_HTTP=1 to override for local development)'
        }.`
      );
    }
  }
}

function requireSiteCredentials() {
  requireSiteConfig('local');
  requireSiteConfig('production');
}

function authHeader(site) {
  const { username, applicationPassword } = SITES[site];
  return `Basic ${Buffer.from(`${username}:${applicationPassword}`).toString('base64')}`;
}

function collectionUrl(site, type) {
  return `${SITES[site].siteUrl}/wp-json/wp/v2/${RESOURCE_CONFIGS[type].endpoint}`;
}

async function fetchResource(site, type, id) {
  const response = await fetch(`${collectionUrl(site, type)}/${id}?context=edit`, {
    headers: { Authorization: authHeader(site) },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${site} ${type} ${id}: HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!RESOURCE_CONFIGS[type].validateShape(data)) {
    throw new Error(`Unexpected response shape for ${site} ${type} ${id}`);
  }
  return data;
}

// Every write goes to the local site; production is strictly read-only here.
async function writeLocalResource(type, id, payload) {
  const url = id ? `${collectionUrl('local', type)}/${id}` : collectionUrl('local', type);
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader('local'), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(`Failed to write local ${type} ${id ?? '(new)'}: HTTP ${response.status} ${data.message ?? ''}`.trim());
  }
  return response.json();
}

function parsePullRef(ref) {
  const match = new RegExp(`^(${RESOURCE_TYPES.join('|')}):(\\d+)(?:=(\\d+))?$`).exec(ref);
  if (!match) {
    throw usageError(`Invalid --add reference: ${ref} (expected <type>:<production-id>[=<local-id>])`);
  }
  const [, type, productionId, localId] = match;
  if (Number(productionId) <= 0 || (localId !== undefined && Number(localId) <= 0)) {
    throw usageError(`--add IDs must be positive integers: ${ref}`);
  }
  return {
    type,
    productionId: Number(productionId),
    explicitLocalId: localId === undefined ? null : Number(localId),
    requested: true,
  };
}

function checkDuplicateRefs(refs) {
  const seenProduction = new Set();
  const seenLocal = new Set();
  for (const ref of refs) {
    const productionKey = `${ref.type}:${ref.productionId}`;
    if (seenProduction.has(productionKey)) {
      throw usageError(`Duplicate reference to the same production resource: ${productionKey}`);
    }
    seenProduction.add(productionKey);
    if (ref.explicitLocalId !== null) {
      const localKey = `${ref.type}:${ref.explicitLocalId}`;
      if (seenLocal.has(localKey)) {
        throw usageError(`Duplicate reference to the same local resource: ${localKey}`);
      }
      seenLocal.add(localKey);
    }
  }
}

function nodeKey(type, productionId) {
  return `${type}:${productionId}`;
}

function findManifestEntry(manifest, type, productionId) {
  return manifest.resources.find((entry) => entry.type === type && entry.productionId === productionId);
}

// Fetches every requested production resource concurrently, then walks up the
// page hierarchy so parents can be mapped or pulled within the same run.
async function collectProductionNodes(refs) {
  const nodes = new Map();
  const failures = [];
  let frontier = refs;
  let depth = 0;

  while (frontier.length > 0) {
    if (depth > MAX_PARENT_DEPTH) {
      throw new Error(`Parent chain exceeds the maximum depth of ${MAX_PARENT_DEPTH}.`);
    }
    // A parent discovered from a child must not displace the same page when it
    // was also requested explicitly with its own local mapping.
    frontier = frontier.filter((ref) => !nodes.has(nodeKey(ref.type, ref.productionId)));
    if (frontier.length === 0) break;
    const settled = await Promise.allSettled(frontier.map((ref) => fetchResource('production', ref.type, ref.productionId)));
    const next = [];
    settled.forEach((result, index) => {
      const ref = frontier[index];
      const key = nodeKey(ref.type, ref.productionId);
      if (result.status === 'rejected') {
        failures.push({ key, message: result.reason.message });
        return;
      }
      const production = result.value;
      nodes.set(key, { ...ref, production, depth });
      const parentId = production.parent || 0;
      if (parentId && !nodes.has(nodeKey(ref.type, parentId)) && !next.some((n) => n.productionId === parentId)) {
        next.push({ type: ref.type, productionId: parentId, explicitLocalId: null, requested: false });
      }
    });
    frontier = next;
    depth += 1;
  }

  return { nodes, failures };
}

function resolveLocalTarget(node, manifest) {  const entry = findManifestEntry(manifest, node.type, node.productionId);
  if (entry && node.explicitLocalId !== null && entry.localId !== node.explicitLocalId) {
    throw new Error(
      `manifest maps production ${node.productionId} to local ${entry.localId}, but local ${node.explicitLocalId} was requested; edit the manifest deliberately`
    );
  }
  return { entry, localId: entry ? entry.localId : node.explicitLocalId };
}

async function prepareNode(node, manifest, resolvedLocalIds, force) {
  const type = node.type;
  const resourceConfig = RESOURCE_CONFIGS[type];
  const { entry, localId } = resolveLocalTarget(node, manifest);

  const local = localId ? await fetchResource('local', type, localId) : null;

  const parentProductionId = node.production.parent || 0;
  let parentLocalId = 0;
  let parentPending = false;
  if (parentProductionId) {
    if (!resolvedLocalIds.has(nodeKey(type, parentProductionId))) {
      throw new Error(`production parent ${parentProductionId} could not be resolved`);
    }
    parentLocalId = resolvedLocalIds.get(nodeKey(type, parentProductionId)) ?? 0;
    parentPending = parentLocalId === 0;
  }

  const payload = resourceConfig.buildPayload(node.production, parentLocalId, resourceConfig.metaAllowlist);

  let changedFields;
  if (!local) {
    changedFields = Object.keys(payload);
  } else {
    const comparable = resourceConfig.buildComparable(local, resourceConfig.metaAllowlist);
    changedFields = Object.keys(payload).filter((key) => !deepEqual(payload[key], comparable[key]));
    if (parentPending && !changedFields.includes('parent')) changedFields.push('parent');
  }

  // Only an actual overwrite can destroy local work, so guard writes only.
  if (local && changedFields.length > 0 && !force) {
    if (!entry?.pulledLocalModifiedGmt) {
      throw new Error(
        `local ${type} ${localId} has no recorded pull guard; it was not created by this tool. Use --force-local-overwrite to overwrite it`
      );
    }
    if (entry.pulledLocalModifiedGmt !== local.modified_gmt) {
      throw new Error(
        `local ${type} ${localId} was modified since the last pull (expected ${entry.pulledLocalModifiedGmt}, found ${local.modified_gmt}). Use --force-local-overwrite to discard the local edits`
      );
    }
  }

  return { node, type, resourceConfig, entry, localId, local, parentProductionId, changedFields };
}

async function applyNode(prepared, resolvedLocalIds) {
  const { node, type, resourceConfig, localId, changedFields } = prepared;
  const reference = `${type}:${node.production.id}`;

  if (localId && changedFields.length === 0) {
    return { reference, localId, action: 'unchanged', changedFields: [], production: node.production };
  }

  const parentLocalId = prepared.parentProductionId ? resolvedLocalIds.get(nodeKey(type, prepared.parentProductionId)) ?? 0 : 0;
  if (prepared.parentProductionId && !parentLocalId) {
    throw new Error(`${reference}: local parent for production ${prepared.parentProductionId} is unavailable`);
  }
  const payload = resourceConfig.buildPayload(node.production, parentLocalId, resourceConfig.metaAllowlist);

  const written = await writeLocalResource(type, localId, payload);
  const verified = await fetchResource('local', type, written.id);
  const verifiedComparable = resourceConfig.buildComparable(verified, resourceConfig.metaAllowlist);
  if (!deepEqual(payload, verifiedComparable)) {
    throw new Error(`${reference}: post-write verification failed, local resource does not match the pulled payload`);
  }

  return {
    reference,
    localId: verified.id,
    action: localId ? 'updated' : 'created',
    changedFields,
    production: node.production,
    localModifiedGmt: verified.modified_gmt,
  };
}

function manifestEntryFor(node, result, existingEntry) {
  return {
    ...existingEntry,
    type: node.type,
    localId: result.localId,
    productionId: node.production.id,
    productionStatus: node.production.status,
    pulledAt: new Date().toISOString(),
    pulledLocalModifiedGmt: result.localModifiedGmt ?? existingEntry?.pulledLocalModifiedGmt,
    expectedProductionModifiedGmt: node.production.modified_gmt,
  };
}

function mergeResourceEntries(existingResources, newEntries) {
  const merged = [...existingResources];
  for (const entry of newEntries) {
    const index = merged.findIndex((candidate) => candidate.type === entry.type && candidate.productionId === entry.productionId);
    if (index === -1) merged.push(entry);
    else merged[index] = entry;
  }
  return merged;
}

function orderParentsFirst(nodes) {
  const chainDepth = (node, seen = new Set()) => {
    const key = nodeKey(node.type, node.production.id);
    if (seen.has(key)) return 0; // cycle guard
    seen.add(key);
    const parent = nodes.get(nodeKey(node.type, node.production.parent || 0));
    return parent ? 1 + chainDepth(parent, seen) : 0;
  };
  return [...nodes.values()]
    .map((node) => ({ node, depth: chainDepth(node) }))
    .sort((a, b) => a.depth - b.depth || a.node.production.id - b.node.production.id)
    .map((item) => item.node);
}

async function run(options) {
  const manifest = await readOrInitManifest(options.manifestPath);

  const refs = options.refs.map(parsePullRef);
  if (options.refresh) {
    for (const entry of manifest.resources) {
      if (!RESOURCE_TYPES.includes(entry.type)) continue;
      if (refs.some((ref) => ref.type === entry.type && ref.productionId === entry.productionId)) continue;
      refs.push({ type: entry.type, productionId: entry.productionId, explicitLocalId: null, requested: true });
    }
  }
  if (refs.length === 0) {
    throw usageError('Nothing to pull: provide --add references or use --refresh on a manifest with resources.');
  }
  checkDuplicateRefs(refs);

  requireSiteCredentials();

  const { nodes, failures } = await collectProductionNodes(refs);

  const results = failures.map((failure) => ({ reference: failure.key, action: 'error', message: failure.message }));
  const ordered = orderParentsFirst(nodes);

  // Known local IDs up front; a node still to be created maps to 0 until applied.
  const resolvedLocalIds = new Map();
  for (const node of ordered) {
    const entry = findManifestEntry(manifest, node.type, node.productionId);
    resolvedLocalIds.set(nodeKey(node.type, node.productionId), entry ? entry.localId : node.explicitLocalId ?? 0);
  }

  const prepared = [];
  for (const node of ordered) {
    try {
      prepared.push(await prepareNode(node, manifest, resolvedLocalIds, options.force));
    } catch (error) {
      results.push({ reference: nodeKey(node.type, node.productionId), action: 'error', message: error.message });
      resolvedLocalIds.delete(nodeKey(node.type, node.productionId));
    }
  }

  if (!options.pull) {
    for (const item of prepared) {
      const action = !item.localId ? 'would-create' : item.changedFields.length === 0 ? 'unchanged' : 'would-update';
      results.push({
        reference: nodeKey(item.type, item.node.production.id),
        localId: item.localId,
        action,
        changedFields: item.changedFields,
      });
    }
    return report(results, options.pull);
  }

  // Snapshot every local resource that is about to be replaced, before any write.
  const overwritten = prepared.filter((item) => item.local && item.changedFields.length > 0);
  if (overwritten.length > 0) {
    const backupFile = backupPath(options.manifestPath);
    await writeJsonAtomic(backupFile, {
      manifest: options.manifestPath,
      capturedAt: new Date().toISOString(),
      direction: 'pull',
      resources: overwritten.map((item) => ({
        type: item.type,
        localId: item.localId,
        productionId: item.node.production.id,
        local: item.local,
      })),
    });
    console.log(`Backed up ${overwritten.length} local resource(s) to ${backupFile}`);
  }

  const newEntries = [];
  for (const item of prepared) {
    try {
      const result = await applyNode(item, resolvedLocalIds);
      resolvedLocalIds.set(nodeKey(item.type, item.node.production.id), result.localId);
      newEntries.push(manifestEntryFor(item.node, result, item.entry));
      results.push(result);
    } catch (error) {
      results.push({ reference: nodeKey(item.type, item.node.production.id), action: 'error', message: error.message });
      resolvedLocalIds.delete(nodeKey(item.type, item.node.production.id));
    }
  }

  if (newEntries.length > 0) {
    manifest.resources = mergeResourceEntries(manifest.resources, newEntries);
    await writeJsonAtomic(options.manifestPath, manifest);
    console.log(`Recorded ${newEntries.length} resource(s) in ${options.manifestPath}`);
  }

  return report(results, options.pull);
}

function report(results, pull) {
  for (const result of results) {
    if (result.action === 'error') {
      console.log(`✗ ${result.reference}: ${result.message}`);
      continue;
    }
    const fields = result.changedFields?.length ? ` [${result.changedFields.join(', ')}]` : '';
    const target = result.localId ? ` local=${result.localId}` : '';
    const marker = result.action === 'unchanged' ? '•' : '✓';
    console.log(`${marker} ${result.reference}${target} action=${result.action}${fields}`);
  }

  const failed = results.filter((result) => result.action === 'error').length;
  console.log(`\n${results.length - failed} succeeded, ${failed} failed.`);

  const pendingWrites = !pull && results.some((result) => result.action === 'would-create' || result.action === 'would-update');
  if (failed > 0 || pendingWrites) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const options = { pull: false, refresh: false, force: false, refs: [] };
  const args = [...argv];
  const manifestArg = args.pop();
  options.manifestPath = resolveManifestPath(manifestArg);

  let index = 0;
  while (index < args.length) {
    const arg = args[index];
    if (arg === '--pull') {
      options.pull = true;
      index += 1;
    } else if (arg === '--refresh') {
      options.refresh = true;
      index += 1;
    } else if (arg === '--force-local-overwrite') {
      options.force = true;
      index += 1;
    } else if (arg === '--add') {
      index += 1;
      const start = index;
      while (index < args.length && !args[index].startsWith('--')) {
        options.refs.push(args[index]);
        index += 1;
      }
      if (index === start) throw usageError('--add requires at least one <type>:<production-id>[=<local-id>] reference.');
    } else {
      throw usageError(`Unknown flag: ${arg}`);
    }
  }

  if (options.force && !options.pull) {
    throw usageError('--force-local-overwrite requires --pull.');
  }
  if (options.refs.length === 0 && !options.refresh) {
    throw usageError('Provide --add references or --refresh.');
  }
  return options;
}

function printUsage() {
  console.log(`Usage:
  node --env-file=.env --use-system-ca pull.resources.js --add <type:production[=local]...> <migrations/file.json>
  node --env-file=.env --use-system-ca pull.resources.js --pull --add <type:production[=local]...> <migrations/file.json>
  node --env-file=.env --use-system-ca pull.resources.js --pull --refresh <migrations/file.json>

Flags:
  --add <refs...>            Production resources to pull (type is 'page' in v1).
  --refresh                  Also pull every supported resource already in the manifest.
  --pull                     Apply the pull; without it the run is a dry run.
  --force-local-overwrite    Overwrite local resources that changed since the last pull.`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  await run(parseArgs(argv));
}

main().catch((error) => {
  if (error.isUsageError) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error(`Fatal error: ${error.message}`);
  }
  process.exitCode = 1;
});
