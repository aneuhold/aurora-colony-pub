import { sentryWorkerOptions } from '@aurora/workers-shared';
import * as Sentry from '@sentry/cloudflare';
import type { Env } from './Env';
import fbFeedReadService from './services/FbFeedReadService';

export default Sentry.withSentry(
  (_: Env) =>
    sentryWorkerOptions(
      'https://c53313a84dd42d99313a4a930b2bfa26@o4507319328702464.ingest.us.sentry.io/4511439630106624'
    ),
  {
    async fetch(request, env, _ctx): Promise<Response> {
      return fbFeedReadService.handleRequest(request, env);
    }
  } satisfies ExportedHandler<Env>
);
