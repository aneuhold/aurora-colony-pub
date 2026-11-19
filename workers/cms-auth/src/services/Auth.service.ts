import { allowedOrigins, jsonResponse, resolveCors } from '@aurora/workers-shared';
import { SveltiaAuthErrorCode } from '../types/SveltiaAuthErrorCode';
import gitHubOAuthService from './GitHubOAuth.service';
import stateCookieService from './StateCookie.service';

/**
 * CMS auth orchestration singleton. Routes requests to the OAuth start/
 * callback handlers, the R2-credentials handoff, and enforces the GitHub
 * username allowlist. Keeps the worker entry point trivial — it just
 * delegates to `handleRequest`.
 */
class AuthService {
  /**
   * Fallback text Sveltia shows when it has no translation for the code.
   * Wording for the shared codes matches sveltia-cms-auth's `errorMessages`.
   */
  static readonly #OAUTH_ERROR_MESSAGES: Record<SveltiaAuthErrorCode, string> = {
    [SveltiaAuthErrorCode.AuthCodeRequestFailed]:
      'Failed to receive an authorization code. Please try again later.',
    [SveltiaAuthErrorCode.CsrfDetected]:
      'Potential CSRF attack detected. Authentication flow aborted.',
    [SveltiaAuthErrorCode.TokenRequestFailed]:
      'Failed to request an access token. Please try again later.',
    [SveltiaAuthErrorCode.UserNotAllowed]: 'This GitHub account is not allowed to edit this site.'
  };

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
      return this.#startOAuth(env);
    }
    if (request.method === 'GET' && url.pathname === '/callback') {
      return this.#completeOAuth(request, env);
    }
    if (url.pathname === '/r2-credentials') {
      return this.#handleR2Credentials(request, env);
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
    const allowedUsers = ['aneuhold', 'coreyebarton-maker'];
    return allowedUsers.includes(username);
  }

  /**
   * Starts the GitHub OAuth flow — issues a signed state cookie and
   * redirects the browser to GitHub's authorize endpoint.
   *
   * @param env Worker env containing the OAuth client credentials
   */
  async #startOAuth(env: Env): Promise<Response> {
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
   * postMessage HTML Sveltia listens for. Failures report back through the
   * same page so Sveltia shows the error instead of waiting on the popup.
   *
   * @param request Incoming callback request
   * @param env Worker env (OAuth credentials + allowlist)
   */
  async #completeOAuth(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    if (!code || !stateParam) {
      return this.#oauthErrorResponse(SveltiaAuthErrorCode.AuthCodeRequestFailed, 400);
    }

    const cookieState = await stateCookieService.readVerifiedState(
      request,
      env.GITHUB_CMS_CLIENT_SECRET
    );
    if (!cookieState || !stateCookieService.constantTimeEqual(cookieState, stateParam)) {
      return this.#oauthErrorResponse(SveltiaAuthErrorCode.CsrfDetected, 400);
    }

    const token = await gitHubOAuthService.exchangeCodeForToken(
      code,
      env.GITHUB_CMS_CLIENT_ID,
      env.GITHUB_CMS_CLIENT_SECRET
    );
    if (!token) {
      return this.#oauthErrorResponse(SveltiaAuthErrorCode.TokenRequestFailed, 502);
    }

    const login = await gitHubOAuthService.fetchUserLogin(token);
    if (!login || !this.isUserAllowed(login)) {
      return this.#oauthErrorResponse(SveltiaAuthErrorCode.UserNotAllowed, 403);
    }

    return this.#oauthPopupResponse('success', { token }, 200);
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
  async #handleR2Credentials(request: Request, env: Env): Promise<Response> {
    const { headers, response: corsResponse } = resolveCors(
      request,
      ['GET'],
      'Authorization, Content-Type'
    );
    if (corsResponse) return corsResponse;
    const cors = { ...headers, 'Cache-Control': 'no-store' };

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
   * Callback page that reports a failed sign-in to Sveltia. Mirrors
   * `outputError` in sveltia-cms-auth.
   *
   * @param errorCode Code Sveltia uses to pick its translated message
   * @param status HTTP status code
   */
  #oauthErrorResponse(errorCode: SveltiaAuthErrorCode, status: number): Response {
    const error = AuthService.#OAUTH_ERROR_MESSAGES[errorCode];
    return this.#oauthPopupResponse('error', { error, errorCode }, status);
  }

  /**
   * Callback page: a tiny HTML page that postMessages
   * `authorization:github:<outcome>:<content JSON>` to the opener (the
   * format Sveltia listens for) and closes itself. Also clears the
   * single-use state cookie. Mirrors `outputHTML` in sveltia-cms-auth:
   * https://github.com/sveltia/sveltia-cms-auth/blob/main/src/index.js
   *
   * The message is posted once per entry in `allowedOrigins`. The browser
   * only delivers a message whose target origin matches the opener exactly,
   * so a page on any other origin that opens `/auth` never receives the
   * token:
   * https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#targetorigin
   *
   * @param outcome `success` with a token, `error` with an error + code
   * @param content Message payload
   * @param status HTTP status code
   */
  #oauthPopupResponse(
    outcome: 'success' | 'error',
    content: Record<string, string>,
    status: number
  ): Response {
    const message = `authorization:github:${outcome}:${JSON.stringify({ provider: 'github', ...content })}`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Authorizing…</title></head><body><script>(function(){var msg=${JSON.stringify(
      message
    )};var origins=${JSON.stringify(allowedOrigins)};if(window.opener){origins.forEach(function(origin){window.opener.postMessage(msg,origin);});}window.close();})();</script></body></html>`;
    return new Response(html, {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': stateCookieService.buildClearCookieHeader()
      }
    });
  }
}

const authService = new AuthService();
export default authService;
