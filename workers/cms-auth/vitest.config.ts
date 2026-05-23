import { createWorkerVitestConfig } from '../vitest.shared';

// Inject a test stand-in for GITHUB_CLIENT_SECRET so Web Crypto's HMAC can
// import a non-zero-length key when signing/verifying the OAuth state cookie.
export default createWorkerVitestConfig({
  bindings: { GITHUB_CLIENT_SECRET: 'test-client-secret', GITHUB_CLIENT_ID: 'test-client-id' }
});
