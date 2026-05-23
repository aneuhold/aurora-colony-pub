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
    },
    scheduled(_event, _env, _ctx): void {
      // TODO: fetch Facebook feed and write to FB_FEED KV.
    }
  } satisfies ExportedHandler<Env>
);
