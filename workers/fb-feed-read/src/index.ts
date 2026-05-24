import * as Sentry from '@sentry/cloudflare';
import type { Env } from './Env';
import fbFeedReadService from './services/FbFeedReadService';

export default Sentry.withSentry(
  (_: Env) => ({
    dsn: 'https://c53313a84dd42d99313a4a930b2bfa26@o4507319328702464.ingest.us.sentry.io/4511439630106624',
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
    tracesSampleRate: 1.0
  }),
  {
    async fetch(request, env, _ctx): Promise<Response> {
      return fbFeedReadService.handleRequest(request, env);
    }
  } satisfies ExportedHandler<Env>
);
