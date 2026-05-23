import * as Sentry from '@sentry/cloudflare';

interface Env {
  AURORA_COLONY_PUB_KV: KVNamespace;
  RATE_LIMITER: RateLimit;
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
    async fetch(request, env, _ctx): Promise<Response> {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return new Response('Too Many Requests', { status: 429 });
      }
      return new Response('OK', { status: 200 });
    }
  } satisfies ExportedHandler<Env>
);
