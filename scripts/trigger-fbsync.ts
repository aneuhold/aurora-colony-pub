import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Target the manual sync trigger can be fired against. */
type Target = 'local' | 'remote';

/** Endpoint each target resolves to. */
const ENDPOINTS: Record<Target, string> = {
  local: 'http://localhost:8789',
  remote: 'https://aurora-fb-feed-sync.agneuhold.workers.dev'
};

/**
 * Reads the target from argv and validates it.
 */
const getTarget = (): Target => {
  const arg = process.argv[2];
  if (arg !== 'local' && arg !== 'remote') {
    throw new Error(
      `Usage: tsx scripts/trigger-fbsync.ts <local|remote> (got: ${arg ?? 'nothing'})`
    );
  }
  return arg;
};

/**
 * Fires a manual POST against the fb-feed-sync worker using the bearer token
 * from the repo-root .env, then prints the status and body.
 */
const triggerFbSync = async (): Promise<void> => {
  const target = getTarget();

  // Pull in the local .env so FB_MANUAL_SYNC_TOKEN is available.
  process.loadEnvFile(resolve(fileURLToPath(import.meta.url), '../../.env'));

  const token = process.env.FB_MANUAL_SYNC_TOKEN;
  if (!token) {
    throw new Error('FB_MANUAL_SYNC_TOKEN is missing from .env');
  }

  const endpoint = ENDPOINTS[target];
  console.log(`Triggering ${target} fb sync → ${endpoint}`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log(`${response.status} ${response.statusText}`);
  console.log(await response.text());

  if (!response.ok) {
    process.exitCode = 1;
  }
};

await triggerFbSync();
