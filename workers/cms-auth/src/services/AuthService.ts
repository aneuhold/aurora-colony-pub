import type { Env } from '../Env';
import gitHubOAuthService from './GitHubOAuthService';
import stateCookieService from './StateCookieService';

/**
 * CMS auth orchestration singleton. Routes requests to the OAuth start/
 * callback handlers and enforces the GitHub username allowlist. Keeps the
 * worker entry point trivial — it just delegates to `handleRequest`.
 */
class AuthService {
  /**
   * Routes incoming requests to the OAuth start/callback handlers, returning
   * 404 for anything else.
   *
   * @param request Incoming request
   * @param env Worker env (OAuth credentials + allowlist)
   */
  async handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/auth') {
      return this.startOAuth(env);
    }
    if (request.method === 'GET' && url.pathname === '/callback') {
      return this.completeOAuth(request, env);
    }
    return new Response('Not Found', { status: 404 });
  }

  /**
   * Returns true if the given GitHub username is permitted to complete the
   * CMS auth flow. Call this after the OAuth callback exchanges the code for
   * a token and fetches the user.
   *
   * @param username GitHub login (e.g. `octocat`)
   */
  isUserAllowed(username: string): boolean {
    const allowedUsers = ['aneuhold'];
    return allowedUsers.includes(username);
  }

  /**
   * Starts the GitHub OAuth flow — issues a signed state cookie and
   * redirects the browser to GitHub's authorize endpoint.
   *
   * @param env Worker env containing the OAuth client credentials
   */
  private async startOAuth(env: Env): Promise<Response> {
    const state = stateCookieService.generateState();
    const setCookie = await stateCookieService.buildSetCookieHeader(
      state,
      env.GITHUB_CLIENT_SECRET
    );
    return new Response(null, {
      status: 302,
      headers: {
        Location: gitHubOAuthService.buildAuthorizeUrl(env.GITHUB_CLIENT_ID, state),
        'Set-Cookie': setCookie
      }
    });
  }

  /**
   * Completes the GitHub OAuth flow — verifies state, exchanges the code
   * for a token, enforces the GitHub username allowlist, and returns the
   * postMessage HTML Sveltia listens for.
   *
   * @param request Incoming callback request
   * @param env Worker env (OAuth credentials + allowlist)
   */
  private async completeOAuth(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    if (!code || !stateParam) {
      return new Response('Missing code or state', { status: 400 });
    }

    const cookieState = await stateCookieService.readVerifiedState(
      request,
      env.GITHUB_CLIENT_SECRET
    );
    if (!cookieState || !stateCookieService.constantTimeEqual(cookieState, stateParam)) {
      return new Response('State mismatch', { status: 400 });
    }

    const token = await gitHubOAuthService.exchangeCodeForToken(
      code,
      env.GITHUB_CLIENT_ID,
      env.GITHUB_CLIENT_SECRET
    );
    if (!token) {
      return new Response('Token exchange failed', { status: 502 });
    }

    const login = await gitHubOAuthService.fetchUserLogin(token);
    if (!login || !this.isUserAllowed(login)) {
      return new Response('Forbidden', { status: 403 });
    }

    return new Response(this.renderSuccessHtml(token), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': stateCookieService.buildClearCookieHeader()
      }
    });
  }

  /**
   * Render a tiny HTML page that immediately postMessages the given token back to the opener and closes itself.
   *
   * Remember all of the code that is here is based on this: https://github.com/sveltia/sveltia-cms-auth/blob/main/src/index.js
   *
   * @param token GitHub OAuth access token to hand back to the editor
   */
  private renderSuccessHtml(token: string): string {
    const message = `authorization:github:success:${JSON.stringify({ token, provider: 'github' })}`;
    return `<!doctype html><html><head><meta charset="utf-8"><title>Authorizing…</title></head><body><script>(function(){var msg=${JSON.stringify(
      message
    )};if(window.opener){window.opener.postMessage(msg,'*');}window.close();})();</script></body></html>`;
  }
}

export default new AuthService();
