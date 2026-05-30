import { createWorkerVitestConfig } from '../vitest.shared';

// Inject test stand-ins for the secrets normally set via `wrangler secret put`.
export default createWorkerVitestConfig({
  bindings: {
    FB_MANUAL_SYNC_TOKEN: 'test-manual-sync-token',
    FB_PAGE_ACCESS_TOKEN: 'test-page-access-token'
  }
});
