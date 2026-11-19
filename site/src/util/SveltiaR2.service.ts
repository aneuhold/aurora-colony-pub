interface CredentialsResponse {
  secretAccessKey: string;
}

/**
 * Client-side helper that wires `@sveltia/cms` up to R2 uploads. Using the
 * GitHub token Sveltia saved at sign-in, fetches the bucket-scoped R2 secret
 * from the `cms-auth` Worker's `/r2-credentials` endpoint and writes it into
 * the `sveltia-cms.prefs` localStorage entry. Sveltia copies that entry into
 * memory once, when its module is first evaluated, so this must run before
 * `@sveltia/cms` is imported. After the first sign-in in a browser there is
 * no saved token yet, so uploads work from the next page load on.
 */
class SveltiaR2Service {
  // These keys are internal to @sveltia/cms. They're the localStorage
  // entries Sveltia writes the GitHub OAuth result and the user prefs to.
  // If image uploads stop working after a Sveltia upgrade, check that the
  // names below still match what Sveltia reads — see
  // node_modules/@sveltia/cms/dist/sveltia-cms.mjs (the `pS` storage
  // helper plus the `cloudflare_r2` apiKey lookup).
  static readonly #USER_KEY = 'sveltia-cms.user';
  static readonly #PREFS_KEY = 'sveltia-cms.prefs';
  static readonly #R2_SERVICE_ID = 'cloudflare_r2';

  readonly #authBaseUrl = import.meta.env.DEV
    ? 'http://localhost:8790'
    : 'https://aurora-cms-auth.agneuhold.workers.dev';

  /**
   * Fetches and stores the R2 secret if a cached GitHub token is available
   * (or if we're in dev, where the Worker accepts unauthenticated calls).
   * Caller should `await` this before importing `@sveltia/cms` so the secret
   * is in place by the time Sveltia reads its prefs.
   */
  async start(): Promise<void> {
    const user = this.#readJson(SveltiaR2Service.#USER_KEY);
    const cachedToken = user?.token;
    const token = typeof cachedToken === 'string' ? cachedToken : null;
    // In dev the Worker accepts unauthenticated calls, so fetch even
    // without a cached GitHub token. In prod skip when there's no token.
    if (token || import.meta.env.DEV) {
      await this.#fetchAndStoreR2Secret(token);
    }
  }

  /**
   * Fetches the R2 secret from the `cms-auth` Worker and stores it where
   * Sveltia expects to find it. Silently no-ops on network errors so a
   * previously-working session keeps working offline.
   *
   * @param ghToken GitHub OAuth token, or `null` when leaning on the
   *   dev-only `ALLOW_NO_AUTH_FOR_R2_KEY` escape hatch
   */
  async #fetchAndStoreR2Secret(ghToken: string | null): Promise<void> {
    const headers: Record<string, string> = ghToken ? { Authorization: `Bearer ${ghToken}` } : {};
    let response: Response;
    try {
      response = await fetch(`${this.#authBaseUrl}/r2-credentials`, { headers });
    } catch {
      // Network failure — leave any cached secret in place so a
      // previously-working session keeps working offline.
      return;
    }
    if (response.status === 401 || response.status === 403) {
      // The GitHub token Sveltia is holding is no longer valid for our
      // allowlist. Wipe any stale R2 secret so Sveltia re-prompts after
      // the next sign-in.
      this.#clearR2Secret();
      return;
    }
    if (!response.ok) return;
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return;
    }
    if (this.#isCredentialsResponse(body)) {
      this.#populateR2Secret(body.secretAccessKey);
    }
  }

  /**
   * Removes our cached R2 secret from Sveltia's prefs blob. Leaves any
   * other service entries in `apiKeys` untouched.
   */
  #clearR2Secret(): void {
    const prefs = this.#readJson(SveltiaR2Service.#PREFS_KEY);
    if (!prefs) return;
    const apiKeys = prefs.apiKeys;
    if (this.#isRecord(apiKeys)) {
      delete apiKeys[SveltiaR2Service.#R2_SERVICE_ID];
      this.#writeJson(SveltiaR2Service.#PREFS_KEY, prefs);
    }
  }

  /**
   * Writes the R2 secret into Sveltia's prefs blob under the
   * `cloudflare_r2` apiKey slot, preserving any other prefs.
   *
   * @param secretAccessKey R2 bucket-scoped secret access key
   */
  #populateR2Secret(secretAccessKey: string): void {
    const prefs: Record<string, unknown> = this.#readJson(SveltiaR2Service.#PREFS_KEY) ?? {};
    const existing = prefs.apiKeys;
    const apiKeys: Record<string, unknown> = this.#isRecord(existing) ? existing : {};
    apiKeys[SveltiaR2Service.#R2_SERVICE_ID] = secretAccessKey;
    prefs.apiKeys = apiKeys;
    this.#writeJson(SveltiaR2Service.#PREFS_KEY, prefs);
  }

  /**
   * Reads and JSON-parses a `localStorage` entry, returning `null` for
   * missing entries, parse failures, or non-object payloads. Sveltia's
   * storage shape can shift across versions, so callers do their own
   * field-level narrowing.
   *
   * @param storageKey `localStorage` key
   */
  #readJson(storageKey: string): Record<string, unknown> | null {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return this.#isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  /**
   * JSON-serializes and writes a `localStorage` entry. Quota and
   * private-mode failures are swallowed: Sveltia falls back to prompting
   * the user for the secret.
   *
   * @param storageKey `localStorage` key
   * @param value Plain object to serialize
   */
  #writeJson(storageKey: string, value: Record<string, unknown>): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // localStorage write failures (quota, private mode) are non-fatal.
    }
  }

  /**
   * Type guard for a plain non-array object that can be indexed by string.
   *
   * @param value Value of unknown shape
   */
  #isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Narrows the JSON body returned by `/r2-credentials` to its expected
   * shape.
   *
   * @param body Parsed JSON body
   */
  #isCredentialsResponse(body: unknown): body is CredentialsResponse {
    return (
      this.#isRecord(body) && 'secretAccessKey' in body && typeof body.secretAccessKey === 'string'
    );
  }
}

const sveltiaR2Service = new SveltiaR2Service();
export default sveltiaR2Service;
