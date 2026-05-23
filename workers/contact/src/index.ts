import * as Sentry from '@sentry/cloudflare';
import type { Env } from './Env';
import contactService from './services/ContactService';

export default Sentry.withSentry(
  (_: Env) => ({
    dsn: 'https://72514df4060ca87603dc4b5c334d49cf@o4507319328702464.ingest.us.sentry.io/4511439645769728',
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
    tracesSampleRate: 1.0
  }),
  {
    async fetch(request, env, _ctx): Promise<Response> {
      return contactService.handleRequest(request, env);
    }
  } satisfies ExportedHandler<Env>
);
