import { sentryWorkerOptions } from '@aurora/workers-shared';
import * as Sentry from '@sentry/cloudflare';
import type { Env } from './Env';
import fbFeedSyncService from './services/FbFeedSyncService';

export default Sentry.withSentry(
  (_: Env) =>
    sentryWorkerOptions(
      'https://01566343fcfee8c127d1831be35120d8@o4507319328702464.ingest.us.sentry.io/4511439640854528'
    ),
  {
    async fetch(request, env, _ctx): Promise<Response> {
      return fbFeedSyncService.handleRequest(request, env);
    },
    async scheduled(_event, env, _ctx): Promise<void> {
      // Let errors bubble so Sentry captures them and the next cron tick retries.
      await fbFeedSyncService.syncFeed(env);
    }
  } satisfies ExportedHandler<Env>
);
