import { sentryWorkerOptions } from '@aurora/workers-shared';
import * as Sentry from '@sentry/cloudflare';
import type { Env } from './Env';
import contactService from './services/Contact.service';

export default Sentry.withSentry(
  () =>
    sentryWorkerOptions(
      'https://72514df4060ca87603dc4b5c334d49cf@o4507319328702464.ingest.us.sentry.io/4511439645769728'
    ),
  {
    async fetch(request, env): Promise<Response> {
      return contactService.handleRequest(request, env);
    }
  } satisfies ExportedHandler<Env>
);
