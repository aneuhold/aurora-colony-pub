import { checkIpRateLimit, sentryWorkerOptions } from '@aurora/workers-shared';
import * as Sentry from '@sentry/cloudflare';

interface Env {
  AURORA_COLONY_PUB_KV: KVNamespace;
  RATE_LIMITER: RateLimit;
  FB_MANUAL_SYNC_TOKEN: string;
}

export default Sentry.withSentry(
  (_: Env) =>
    sentryWorkerOptions(
      'https://01566343fcfee8c127d1831be35120d8@o4507319328702464.ingest.us.sentry.io/4511439640854528'
    ),
  {
    async fetch(request, env, _ctx): Promise<Response> {
      if (!(await checkIpRateLimit(request, env))) {
        return new Response('Too Many Requests', { status: 429 });
      }
      if (request.headers.get('Authorization') !== `Bearer ${env.FB_MANUAL_SYNC_TOKEN}`) {
        return new Response('Unauthorized', { status: 401 });
      }
      return new Response('OK', { status: 200 });
    },
    scheduled(_event, _env, _ctx): void {
      // TODO: fetch Facebook feed and write to AURORA_COLONY_PUB_KV.
    }
  } satisfies ExportedHandler<Env>
);
