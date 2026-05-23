import { createWorkerVitestConfig } from '../vitest.shared';

// Inject test stand-ins for the secrets normally set via `wrangler secret put`.
export default createWorkerVitestConfig({
  bindings: {
    CLOUDFLARE_TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
    RESEND_API_KEY: 'test-resend-key'
  }
});
