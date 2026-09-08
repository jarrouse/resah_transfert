#!/usr/bin/env node
// Idempotent WordPress resource publisher. See specs/idempotent-resource-publisher.md.

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import config from './config.js';

const execFileAsync = promisify(execFile);

const { WP_SITE_URL, WP_USERNAME, APPLICATION_PASSWORD } = config;

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

const RESOURCE_TYPES = ['page', 'category', 'post', 'event'];

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
    buildPayload(local, parentProductionId, metaAllowlist) {
      return {
        title: local.title?.raw ?? '',
        slug: local.slug ?? '',
        content: local.content?.raw ?? '',
        status: local.status,
        parent: parentProductionId,
        meta: pickAllowedMeta(local.meta, metaAllowlist),
      };
    },
    buildComparable(production, metaAllowlist) {
      return {
        title: production.title?.raw ?? '',
        slug: production.slug ?? '',
        content: production.content?.raw ?? '',
        status: production.status,
        parent: production.parent ?? 0,
        meta: pickAllowedMeta(production.meta, metaAllowlist),
      };
    },
  },
  category: {
    endpoint: 'categories',
    metaAllowlist: [],
    validateShape(resource) {
      return resource && typeof resource.id === 'number' && typeof resource.slug === 'string' && resource.taxonomy === 'category';
    },
    buildPayload(local, parentProductionId, metaAllowlist) {
      return {
        name: local.name ?? '',
        slug: local.slug ?? '',
        description: local.description ?? '',
        parent: parentProductionId,
        meta: pickAllowedMeta(local.meta, metaAllowlist),
      };
    },
    buildComparable(production, metaAllowlist) {
      return {
        name: production.name ?? '',
        slug: production.slug ?? '',
        description: production.description ?? '',
        parent: production.parent ?? 0,
        meta: pickAllowedMeta(production.meta, metaAllowlist),
      };
    },
  },
  post: {
    endpoint: 'posts',
    metaAllowlist: [],
    validateShape(resource) {
      return resource && typeof resource.id === 'number' && typeof resource.slug === 'string' && resource.title != null;
    },
    buildPayload(local, _parentProductionId, metaAllowlist) {
      return {
        title: local.title?.raw ?? '',
        slug: local.slug ?? '',
        content: local.content?.raw ?? '',
        status: local.status,
        meta: pickAllowedMeta(local.meta, metaAllowlist),
      };
    },
    buildComparable(production, metaAllowlist) {
      return {
        title: production.title?.raw ?? '',
        slug: production.slug ?? '',
        content: production.content?.raw ?? '',
        status: production.status,
        meta: pickAllowedMeta(production.meta, metaAllowlist),
      };
    },
  },
  // Uses the dedicated The Events Calendar v1 API (not wp/v2): it is the only
  // interface that exposes event scheduling fields. Venue, organizer, and
  // category/tag term assignments are cross-site references with unresolved
  // identity mapping, so they are intentionally never synced (see spec scope).
  event: {
    apiPath: (id) => `tribe/events/v1/events/${id}`,
    metaAllowlist: [],
    getModifiedGmt(data) {
      return data.modified_utc;
    },
    validateShape(resource) {
      return resource && typeof resource.id === 'number' && typeof resource.slug === 'string' && resource.title != null;
    },
    buildPayload(local) {
      return {
        title: local.title ?? '',
        slug: local.slug ?? '',
        description: local.description ?? '',
        status: local.status,
        start_date: local.start_date,
        end_date: local.end_date,
        all_day: !!local.all_day,
        timezone: local.timezone,
        cost: local.cost ?? '',
      };
    },
    buildComparable(production) {
      return {
        title: production.title ?? '',
        slug: production.slug ?? '',
        description: production.description ?? '',
        status: production.status,
        start_date: production.start_date,
        end_date: production.end_date,
        all_day: !!production.all_day,
        timezone: production.timezone,
        cost: production.cost ?? '',
      };
    },
  },
};

function getModifiedGmt(type, data) {
  const getter = RESOURCE_CONFIGS[type].getModifiedGmt;
  return getter ? getter(data) : data.modified_gmt;
}

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

function resolveManifestPath(manifestArg) {
  if (!manifestArg) {
    throw usageError('A manifest path inside migrations/ is required.');
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

async function readManifest(manifestPath) {
  if (!(await pathExists(manifestPath))) {
    throw usageError(`Manifest does not exist: ${manifestPath}`);
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

async function writeManifestAtomic(manifestPath, manifest) {
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  const tmpPath = `${manifestPath}.tmp-${process.pid}`;
  const contents = `${JSON.stringify(manifest, null, 2)}\n`;
  await fs.writeFile(tmpPath, contents, 'utf8');
  await fs.rename(tmpPath, manifestPath);
}

function filePathKey(entry) {
  return typeof entry === 'string' ? entry : entry.path;
}

function mergeFileEntries(existingFiles, changedFiles) {
  const byPath = new Map();
  for (const entry of existingFiles) {
    byPath.set(filePathKey(entry), entry);
  }
  for (const change of changedFiles) {
    const existing = byPath.get(change.path);
    if (change.deleted) {
      byPath.set(change.path, { path: change.path, deleted: true });
    } else if (!existing) {
      byPath.set(change.path, change.path);
    }
  }
  return [...byPath.values()].sort((a, b) => filePathKey(a).localeCompare(filePathKey(b)));
}

async function resolveGitRevision(revision) {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', revision]);
    return stdout.trim();
  } catch {
    throw usageError(`Git revision does not resolve: ${revision}`);
  }
}

async function gitChangedFiles(revision) {
  const { stdout } = await execFileAsync('git', ['diff', '--name-status', `${revision}...HEAD`]);
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split('\t');
      const filePath = rest[rest.length - 1];
      return { path: filePath, deleted: status.startsWith('D') };
    });
}

function requireHttps() {
  const allowInsecure = process.env.WP_ALLOW_INSECURE_HTTP === '1';
  if (!WP_SITE_URL || (!WP_SITE_URL.startsWith('https://') && !allowInsecure)) {
    throw usageError('WP_SITE_URL must use HTTPS (set WP_ALLOW_INSECURE_HTTP=1 to override for local development).');
  }
}

function authHeader() {
  return `Basic ${Buffer.from(`${WP_USERNAME}:${APPLICATION_PASSWORD}`).toString('base64')}`;
}

function resourceUrl(type, id) {
  const resourceConfig = RESOURCE_CONFIGS[type];
  const routePath = resourceConfig.apiPath ? resourceConfig.apiPath(id) : `wp/v2/${resourceConfig.endpoint}/${id}`;
  return `${WP_SITE_URL}/wp-json/${routePath}`;
}

async function fetchResource(type, id) {
  const resourceConfig = RESOURCE_CONFIGS[type];
  const url = resourceConfig.apiPath ? resourceUrl(type, id) : `${resourceUrl(type, id)}?context=edit`;
  const response = await fetch(url, {
    headers: { Authorization: authHeader() },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${type} ${id}: HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!resourceConfig.validateShape(data)) {
    throw new Error(`Unexpected response shape for ${type} ${id}`);
  }
  return data;
}

async function updateResource(type, id, payload) {
  const url = resourceUrl(type, id);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(`Failed to update ${type} ${id}: HTTP ${response.status} ${data.message ?? ''}`.trim());
  }
  return response.json();
}

function parseAddRef(ref) {
  const match = /^(page|category|post|event):(\d+)=(\d+)$/.exec(ref);
  if (!match) {
    throw usageError(`Invalid --add reference: ${ref} (expected <type>:<local-id>=<production-id>)`);
  }
  const [, type, localId, productionId] = match;
  if (Number(localId) <= 0 || Number(productionId) <= 0) {
    throw usageError(`--add IDs must be positive integers: ${ref}`);
  }
  return { type, localId: Number(localId), productionId: Number(productionId) };
}

function checkIdConflicts(refs, existingResources) {
  const seenLocal = new Map();
  const seenProduction = new Map();
  for (const entry of [...existingResources, ...refs]) {
    const localKey = `${entry.type}:${entry.localId}`;
    const productionKey = `${entry.type}:${entry.productionId}`;
    const priorLocal = seenLocal.get(localKey);
    if (priorLocal !== undefined && priorLocal !== entry.productionId) {
      throw usageError(`Local ID reused for a different production ID: ${localKey}`);
    }
    seenLocal.set(localKey, entry.productionId);
    const priorProduction = seenProduction.get(productionKey);
    if (priorProduction !== undefined && priorProduction !== entry.localId) {
      throw usageError(`Production ID reused for a different local ID: ${productionKey}`);
    }
    seenProduction.set(productionKey, entry.localId);
  }
}

function mergeResourceEntries(existingResources, newEntries) {
  const byKey = new Map();
  for (const entry of existingResources) {
    byKey.set(`${entry.type}:${entry.localId}:${entry.productionId}`, entry);
  }
  for (const entry of newEntries) {
    byKey.set(`${entry.type}:${entry.localId}:${entry.productionId}`, entry);
  }
  return [...byKey.values()];
}

function orderResourcesForProcessing(resources) {
  const byTypeAndLocalId = new Map();
  for (const resource of resources) {
    byTypeAndLocalId.set(`${resource.type}:${resource.localId}`, resource);
  }

  function depthOf(resource, seen = new Set()) {
    const key = `${resource.type}:${resource.localId}`;
    if (seen.has(key)) return 0; // cycle guard
    seen.add(key);
    const parentLocalId = resource.__localParentId;
    if (!parentLocalId) return 0;
    const parent = byTypeAndLocalId.get(`${resource.type}:${parentLocalId}`);
    if (!parent) return 0;
    return 1 + depthOf(parent, seen);
  }

  return [...resources]
    .map((resource) => ({ resource, depth: depthOf(resource) }))
    .sort((a, b) => a.depth - b.depth || a.resource.type.localeCompare(b.resource.type) || a.resource.localId - b.resource.localId)
    .map((entry) => entry.resource);
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function processResource(resource, allResources, apply) {
  const reference = `${resource.type}:${resource.localId}=${resource.productionId}`;
  const resourceConfig = RESOURCE_CONFIGS[resource.type];

  const local = await fetchResource(resource.type, resource.localId);
  const production = await fetchResource(resource.type, resource.productionId);

  const productionModifiedGmt = getModifiedGmt(resource.type, production);
  if (productionModifiedGmt !== resource.expectedProductionModifiedGmt) {
    throw new Error(
      `${reference}: production revision conflict (expected ${resource.expectedProductionModifiedGmt}, found ${productionModifiedGmt}). Regenerate the manifest after review.`
    );
  }

  let parentProductionId = 0;
  const localParentId = local.parent || 0;
  resource.__localParentId = localParentId;
  if (localParentId) {
    const parentEntry = allResources.find((entry) => entry.type === resource.type && entry.localId === localParentId);
    if (!parentEntry) {
      throw new Error(`${reference}: local parent ${localParentId} is not declared in the manifest`);
    }
    parentProductionId = parentEntry.productionId;
  }

  const payload = resourceConfig.buildPayload(local, parentProductionId, resourceConfig.metaAllowlist);
  const comparable = resourceConfig.buildComparable(production, resourceConfig.metaAllowlist);

  if (deepEqual(payload, comparable)) {
    return { reference, targetId: resource.productionId, action: 'unchanged', changedFields: [] };
  }

  const changedFields = Object.keys(payload).filter((key) => !deepEqual(payload[key], comparable[key]));

  if (!apply) {
    return { reference, targetId: resource.productionId, action: 'would-update', changedFields };
  }

  await updateResource(resource.type, resource.productionId, payload);
  const verified = await fetchResource(resource.type, resource.productionId);
  const verifiedComparable = resourceConfig.buildComparable(verified, resourceConfig.metaAllowlist);
  if (!deepEqual(payload, verifiedComparable)) {
    throw new Error(`${reference}: post-update verification failed, target does not match the expected payload`);
  }

  return { reference, targetId: resource.productionId, action: 'updated', changedFields };
}

async function runManifest(manifestPath, apply) {
  requireHttps();
  const manifest = await readManifest(manifestPath);
  const ordered = orderResourcesForProcessing(manifest.resources);

  const results = [];
  for (const resource of ordered) {
    try {
      results.push(await processResource(resource, manifest.resources, apply));
    } catch (error) {
      results.push({
        reference: `${resource.type}:${resource.localId}=${resource.productionId}`,
        action: 'error',
        message: error.message,
      });
    }
  }

  for (const result of results) {
    if (result.action === 'error') {
      console.log(`✗ ${result.reference}: ${result.message}`);
    } else {
      const fields = result.changedFields.length ? ` [${result.changedFields.join(', ')}]` : '';
      console.log(`${result.action === 'updated' ? '✓' : '•'} ${result.reference} target=${result.targetId} action=${result.action}${fields}`);
    }
  }

  const hasErrors = results.some((r) => r.action === 'error');
  const hasPendingWrites = !apply && results.some((r) => r.action === 'would-update');

  const succeeded = results.filter((r) => r.action !== 'error').length;
  const failed = results.length - succeeded;
  console.log(`\n${succeeded} succeeded, ${failed} failed.`);

  if (hasErrors || hasPendingWrites) {
    process.exitCode = 1;
  }
}

async function createManifest(manifestPath) {
  if (await pathExists(manifestPath)) {
    throw usageError(`Manifest already exists, refusing to overwrite: ${manifestPath}`);
  }
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    files: [],
    resources: [],
  };
  await writeManifestAtomic(manifestPath, manifest);
  console.log(`Created ${manifestPath}`);
}

async function addFilesFrom(revision, manifestPath) {
  const manifest = await readManifest(manifestPath);
  const baseRevision = await resolveGitRevision(revision);
  const changedFiles = await gitChangedFiles(revision);
  manifest.baseRevision = baseRevision;
  manifest.files = mergeFileEntries(manifest.files, changedFiles);
  await writeManifestAtomic(manifestPath, manifest);
  console.log(`Added ${changedFiles.length} file(s) from ${revision} (base ${baseRevision}) to ${manifestPath}`);
}

async function addResources(refs, manifestPath) {
  requireHttps();
  const manifest = await readManifest(manifestPath);
  const requested = refs.map(parseAddRef);

  checkIdConflicts(requested, manifest.resources);

  const outcomes = await Promise.allSettled(
    requested.map(async (ref) => {
      const [local, production] = await Promise.all([
        fetchResource(ref.type, ref.localId),
        fetchResource(ref.type, ref.productionId),
      ]);
      return {
        type: ref.type,
        localId: ref.localId,
        productionId: ref.productionId,
        expectedProductionModifiedGmt: getModifiedGmt(ref.type, production),
        __local: local,
      };
    })
  );

  const failures = outcomes.filter((o) => o.status === 'rejected');
  if (failures.length > 0) {
    for (const failure of failures) {
      console.log(`✗ ${failure.reason.message}`);
    }
    throw usageError('One or more resource lookups failed; manifest left unchanged.');
  }

  const newEntries = outcomes.map((o) => {
    const { __local, ...entry } = o.value;
    return entry;
  });

  manifest.resources = mergeResourceEntries(manifest.resources, newEntries);
  await writeManifestAtomic(manifestPath, manifest);
  console.log(`Added/refreshed ${newEntries.length} resource(s) in ${manifestPath}`);
}

function printUsage() {
  console.log(`Usage:
  node --env-file=.env --use-system-ca publish.resources.js --create <migrations/file.json>
  node --env-file=.env --use-system-ca publish.resources.js --add-files-from <revision> <migrations/file.json>
  node --env-file=.env --use-system-ca publish.resources.js --add <type:local=production...> <migrations/file.json>
  node --env-file=.env --use-system-ca publish.resources.js <migrations/file.json>
  node --env-file=.env --use-system-ca publish.resources.js --apply <migrations/file.json>`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const manifestArg = argv[argv.length - 1];
  const flagArgs = argv.slice(0, -1);
  const manifestPath = resolveManifestPath(manifestArg);

  if (flagArgs.length === 0) {
    await runManifest(manifestPath, false);
    return;
  }

  const [flag, ...rest] = flagArgs;

  if (flag === '--create' && rest.length === 0) {
    await createManifest(manifestPath);
    return;
  }

  if (flag === '--add-files-from' && rest.length === 1) {
    await addFilesFrom(rest[0], manifestPath);
    return;
  }

  if (flag === '--add' && rest.length >= 1) {
    await addResources(rest, manifestPath);
    return;
  }

  if (flag === '--apply' && rest.length === 0) {
    await runManifest(manifestPath, true);
    return;
  }

  throw usageError(`Unknown or conflicting flags: ${flagArgs.join(' ')}`);
}

main().catch((error) => {
  if (error.isUsageError) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error(`Fatal error: ${error.message}`);
  }
  process.exitCode = 1;
});
