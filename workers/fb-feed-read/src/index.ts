import * as Sentry from '@sentry/cloudflare';

interface Env {
  FB_FEED: KVNamespace;
  SENTRY_DSN: string;
}

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 1.0
  }),
  {
    fetch(_request, _env, _ctx): Response {
      return new Response('OK', { status: 200 });
    }
  } satisfies ExportedHandler<Env>
);
