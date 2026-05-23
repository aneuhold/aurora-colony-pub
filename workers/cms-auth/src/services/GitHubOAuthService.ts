/**
 * Thin wrapper around the GitHub OAuth endpoints the CMS auth flow uses.
 * Centralizes URL construction, response parsing, and error normalization
 * so the route handlers stay focused on HTTP semantics.
 */
class GitHubOAuthService {
  /**
   * Builds the GitHub OAuth authorize URL for the CMS app.
   *
   * @param clientId GitHub OAuth app client ID
   * @param state Opaque state token round-tripped through the OAuth flow
   */
  buildAuthorizeUrl(clientId: string, state: string): string {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', 'repo,user');
    url.searchParams.set('state', state);
    return url.toString();
  }

  /**
   * Exchanges an OAuth authorization code for an access token. Returns null
   * if GitHub rejects the request or the response shape is unexpected.
   *
   * @param code The authorization code returned from GitHub's authorize step
   * @param clientId GitHub OAuth app client ID
   * @param clientSecret GitHub OAuth app client secret
   */
  async exchangeCodeForToken(
    code: string,
    clientId: string,
    clientSecret: string
  ): Promise<string | null> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
    });
    if (!response.ok) return null;
    const body = await response.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('access_token' in body) ||
      typeof body.access_token !== 'string'
    ) {
      return null;
    }
    return body.access_token;
  }

  /**
   * Fetches the authenticated user's GitHub login. Returns null on failure
   * or if the response is missing the expected shape.
   *
   * @param token GitHub OAuth access token
   */
  async fetchUserLogin(token: string): Promise<string | null> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'aurora-cms-auth'
      }
    });
    if (!response.ok) return null;
    const body = await response.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('login' in body) ||
      typeof body.login !== 'string'
    ) {
      return null;
    }
    return body.login;
  }
}

export default new GitHubOAuthService();
