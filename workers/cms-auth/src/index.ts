import { checkIpRateLimit, sentryWorkerOptions } from '@aurora/workers-shared';
import * as Sentry from '@sentry/cloudflare';
import type { Env } from './Env';
import authService from './services/AuthService';

/**
 * All of the code for this worker comes from here: https://github.com/sveltia/sveltia-cms-auth/blob/main/src/index.js
 *
 * It was just refactored to be cleaner.
 */
export default Sentry.withSentry(
  (_: Env) =>
    sentryWorkerOptions(
      'https://d1b5a6eb0f2eeb49e18a88529e016ff0@o4507319328702464.ingest.us.sentry.io/4511439647735808'
    ),
  {
    async fetch(request, env, _ctx): Promise<Response> {
      if (!(await checkIpRateLimit(request, env))) {
        return new Response('Too Many Requests', { status: 429 });
      }
      return authService.handleRequest(request, env);
    }
  } satisfies ExportedHandler<Env>
);
