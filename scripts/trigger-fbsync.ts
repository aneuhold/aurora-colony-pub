import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Target the manual sync trigger can be fired against. */
type Target = 'local' | 'remote';

/** Parsed CLI arguments. */
type Args = {
  target: Target;
  /** When true, retry while the server is still booting (used by `dev`). */
  wait: boolean;
};

/** Endpoint each target resolves to. */
const ENDPOINTS: Record<Target, string> = {
  local: 'http://localhost:8789',
  remote: 'https://aurora-fb-feed-sync.agneuhold.workers.dev'
};

/** How long to keep retrying a `--wait` trigger before giving up. */
const WAIT_TIMEOUT_MS = 60_000;

/** Delay between retries while waiting for the dev server to come up. */
const WAIT_INTERVAL_MS = 1_000;

/**
 * Reads the target and flags from argv and validates them.
 */
const getArgs = (): Args => {
  const target = process.argv[2];
  if (target !== 'local' && target !== 'remote') {
    throw new Error(
      `Usage: tsx scripts/trigger-fbsync.ts <local|remote> [--wait] (got: ${target ?? 'nothing'})`
    );
  }
  return { target, wait: process.argv.includes('--wait') };
};

/**
 * Resolves once the dev server stops refusing connections, so the startup
 * sync fires as soon as `wrangler dev` is ready. Gives up after
 * `WAIT_TIMEOUT_MS` so a never-starting server doesn't hang forever.
 *
 * @param endpoint Endpoint to poll
 */
const waitForServer = async (endpoint: string): Promise<void> => {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  for (;;) {
    try {
      // A bare GET is enough to confirm the listener is accepting sockets;
      // we don't care about the status, only that the fetch doesn't throw.
      await fetch(endpoint);
      return;
    } catch (error) {
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for ${endpoint} to come up`, { cause: error });
      }
      await new Promise((res) => setTimeout(res, WAIT_INTERVAL_MS));
    }
  }
};

/**
 * Fires a manual POST against the fb-feed-sync worker using the bearer token
 * from the repo-root .env, then prints the status and body.
 */
const triggerFbSync = async (): Promise<void> => {
  const { target, wait } = getArgs();

  // Pull in the local .env so FB_MANUAL_SYNC_TOKEN is available.
  process.loadEnvFile(resolve(fileURLToPath(import.meta.url), '../../.env'));

  const token = process.env.FB_MANUAL_SYNC_TOKEN;
  if (!token) {
    throw new Error('FB_MANUAL_SYNC_TOKEN is missing from .env');
  }

  const endpoint = ENDPOINTS[target];

  if (wait) {
    console.log(`Waiting for ${endpoint} before seeding fb sync…`);
    await waitForServer(endpoint);
  }

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
