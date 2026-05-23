import * as Sentry from '@sentry/cloudflare';

interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  RATE_LIMITER: RateLimit;
  ALLOWED_GITHUB_USERS: string[];
}

/**
 * Returns true if the given GitHub username is permitted to complete the CMS auth flow.
 * Call this after the OAuth callback exchanges the code for a token and fetches the user.
 *
 * @param username GitHub login (e.g. `octocat`)
 * @param env Worker env containing the allowlist
 */
export const isAllowedGitHubUser = (username: string, env: Env): boolean => {
  return env.ALLOWED_GITHUB_USERS.includes(username);
};

export default Sentry.withSentry(
  (_: Env) => ({
    dsn: 'https://d1b5a6eb0f2eeb49e18a88529e016ff0@o4507319328702464.ingest.us.sentry.io/4511439647735808',
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
    tracesSampleRate: 1.0
  }),
  {
    async fetch(request, env, _ctx): Promise<Response> {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return new Response('Too Many Requests', { status: 429 });
      }
      // TODO: once the sveltia-cms-auth OAuth flow is wired up, fetch the GitHub
      // user from the access token and reject with 403 if
      // `!isAllowedGitHubUser(login, env)`.
      return new Response('OK', { status: 200 });
    }
  } satisfies ExportedHandler<Env>
);
