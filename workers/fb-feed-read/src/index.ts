import * as Sentry from '@sentry/cloudflare';

interface Env {
  AURORA_COLONY_PUB_KV: KVNamespace;
}

export default Sentry.withSentry(
  (_: Env) => ({
    dsn: 'https://c53313a84dd42d99313a4a930b2bfa26@o4507319328702464.ingest.us.sentry.io/4511439630106624',
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
    tracesSampleRate: 1.0
  }),
  {
    fetch(_request, _env, _ctx): Response {
      return new Response('OK', { status: 200 });
    }
  } satisfies ExportedHandler<Env>
);
