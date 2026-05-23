import * as Sentry from '@sentry/cloudflare';
import type { Env } from './Env';
import authService from './services/AuthService';

/**
 * All of the code for this worker comes from here: https://github.com/sveltia/sveltia-cms-auth/blob/main/src/index.js
 *
 * It was just refactored to be cleaner.
 */
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
      return authService.handleRequest(request, env);
    }
  } satisfies ExportedHandler<Env>
);
