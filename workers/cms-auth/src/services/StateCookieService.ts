const COOKIE_NAME = 'aurora_cms_oauth_state';
const COOKIE_ATTRS = 'Path=/; HttpOnly; Secure; SameSite=Lax';

/**
 * Stateless helper for the signed `state` cookie used in the GitHub OAuth
 * round-trip. The cookie carries the random state token plus an HMAC over
 * it, so `/callback` can verify the cookie was issued by us without needing
 * any backend storage.
 */
class StateCookieService {
  readonly cookieName = COOKIE_NAME;

  /**
   * Generates a random URL-safe state token suitable for CSRF protection.
   */
  generateState(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return this.toBase64Url(bytes);
  }

  /**
   * Builds the full `Set-Cookie` header value for the signed state cookie.
   * `Max-Age` is short (10 min) because the OAuth round-trip is interactive.
   *
   * @param state The state token to sign and persist
   * @param secret HMAC key (the OAuth client secret)
   */
  async buildSetCookieHeader(state: string, secret: string): Promise<string> {
    const signature = await this.hmacSign(state, secret);
    return `${COOKIE_NAME}=${state}.${signature}; ${COOKIE_ATTRS}; Max-Age=600`;
  }

  /**
   * Returns the `Set-Cookie` header value that clears the state cookie.
   */
  buildClearCookieHeader(): string {
    return `${COOKIE_NAME}=; ${COOKIE_ATTRS}; Max-Age=0`;
  }

  /**
   * Reads the state cookie from a request and verifies its HMAC signature.
   * Returns the embedded state token on success, or null if the cookie is
   * missing, malformed, or has an invalid signature.
   *
   * @param request Incoming request to read the cookie from
   * @param secret HMAC key (the OAuth client secret)
   */
  async readVerifiedState(request: Request, secret: string): Promise<string | null> {
    const cookieValue = this.readCookie(request, COOKIE_NAME);
    if (!cookieValue) return null;
    const [state, signature] = cookieValue.split('.');
    if (!state || !signature) return null;
    const expectedSignature = await this.hmacSign(state, secret);
    if (!this.constantTimeEqual(signature, expectedSignature)) return null;
    return state;
  }

  /**
   * Constant-time string equality, useful for comparing state tokens between
   * the cookie and the URL query without leaking timing information.
   *
   * @param a First string
   * @param b Second string
   */
  constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }

  /**
   * Signs the given payload with HMAC-SHA256 using the provided secret.
   *
   * @param payload The string to sign
   * @param secret HMAC key
   */
  private async hmacSign(payload: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    return this.toBase64Url(new Uint8Array(signature));
  }

  /**
   * URL-safe base64 encoder for arbitrary byte arrays.
   *
   * @param bytes The bytes to encode
   */
  private toBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  }

  /**
   * Reads a single cookie value from a request's `Cookie` header.
   *
   * @param request Incoming request
   * @param name Cookie name to extract
   */
  private readCookie(request: Request, name: string): string | null {
    const header = request.headers.get('Cookie');
    if (!header) return null;
    for (const part of header.split(';')) {
      const trimmed = part.trim();
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      if (trimmed.slice(0, eq) === name) {
        return trimmed.slice(eq + 1);
      }
    }
    return null;
  }
}

const stateCookieService = new StateCookieService();
export default stateCookieService;
