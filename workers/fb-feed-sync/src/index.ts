import * as Sentry from '@sentry/cloudflare';

interface Env {
  AURORA_COLONY_PUB_KV: KVNamespace;
}

export default Sentry.withSentry(
  (_: Env) => ({
    dsn: 'https://01566343fcfee8c127d1831be35120d8@o4507319328702464.ingest.us.sentry.io/4511439640854528',
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
    tracesSampleRate: 1.0
  }),
  {
    fetch(_request, _env, _ctx): Response {
      return new Response('OK', { status: 200 });
    },
    scheduled(_event, _env, _ctx): void {
      // TODO: fetch Facebook feed and write to AURORA_COLONY_PUB_KV.
    }
  } satisfies ExportedHandler<Env>
);
