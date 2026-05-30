import {
  corsHeaders,
  type CorsMethod,
  isAllowedOrigin,
  jsonResponse
} from '@aurora/workers-shared';
import type { Env } from '../Env';
import gitHubOAuthService from './GitHubOAuthService';
import stateCookieService from './StateCookieService';

/**
 * CMS auth orchestration singleton. Routes requests to the OAuth start/
 * callback handlers, the R2-credentials handoff, and enforces the GitHub
 * username allowlist. Keeps the worker entry point trivial — it just
 * delegates to `handleRequest`.
 */
class AuthService {
  private static readonly R2_CREDENTIALS_CORS_METHODS: readonly CorsMethod[] = ['GET', 'OPTIONS'];

  /**
   * Routes incoming requests to the OAuth start/callback handlers and the
   * R2-credentials handoff, returning 404 for anything else.
   *
   * @param request Incoming request
   * @param env Worker env (OAuth credentials + allowlist + R2 secrets)
   */
  async handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/auth') {
      return this.startOAuth(env);
    }
    if (request.method === 'GET' && url.pathname === '/callback') {
      return this.completeOAuth(request, env);
    }
    if (url.pathname === '/r2-credentials') {
      return this.handleR2Credentials(request, env);
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
      env.GITHUB_CMS_CLIENT_SECRET
    );
    return new Response(null, {
      status: 302,
      headers: {
        Location: gitHubOAuthService.buildAuthorizeUrl(env.GITHUB_CMS_CLIENT_ID, state),
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
      env.GITHUB_CMS_CLIENT_SECRET
    );
    if (!cookieState || !stateCookieService.constantTimeEqual(cookieState, stateParam)) {
      return new Response('State mismatch', { status: 400 });
    }

    const token = await gitHubOAuthService.exchangeCodeForToken(
      code,
      env.GITHUB_CMS_CLIENT_ID,
      env.GITHUB_CMS_CLIENT_SECRET
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
   * Handoff endpoint that hands the bucket-scoped R2 API token to the admin
   * shell after re-verifying the caller's GitHub OAuth token against the
   * allowlist. The secret lives in `localStorage` after this — gated by the
   * same GitHub login Sveltia already requires.
   *
   * @param request Incoming request — `Authorization: Bearer <gh_token>` for
   *   `GET`, or a preflight `OPTIONS`
   * @param env Worker env (carries the R2 secrets + OAuth allowlist)
   */
  private async handleR2Credentials(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const echoedOrigin = origin && isAllowedOrigin(origin) ? origin : '';
    const cors: Record<string, string> = echoedOrigin
      ? corsHeaders(echoedOrigin, AuthService.R2_CREDENTIALS_CORS_METHODS)
      : { Vary: 'Origin' };
    cors['Cache-Control'] = 'no-store';
    cors['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: 'GET, OPTIONS', ...cors }
      });
    }

    // Local-dev escape hatch: when `ALLOW_NO_AUTH_FOR_R2_KEY` is set the
    // admin shell can fetch credentials without Sveltia's GitHub login. Only
    // set in the root `.env` for `wrangler dev`; never in production.
    if (env.ALLOW_NO_AUTH_FOR_R2_KEY !== 'true') {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
      if (!token) {
        return jsonResponse({ error: 'Missing bearer token' }, 401, cors);
      }

      const login = await gitHubOAuthService.fetchUserLogin(token);
      if (!login) {
        return jsonResponse({ error: 'Invalid GitHub token' }, 401, cors);
      }
      if (!this.isUserAllowed(login)) {
        return jsonResponse({ error: 'Forbidden' }, 403, cors);
      }
    }

    return jsonResponse({ secretAccessKey: env.R2_MEDIA_SECRET_ACCESS_KEY }, 200, cors);
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

const authService = new AuthService();
export default authService;
