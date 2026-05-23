import * as Sentry from '@sentry/cloudflare';

interface Env {
  TURNSTILE_SECRET: string;
  RESEND_API_KEY: string;
}

export default Sentry.withSentry(
  (_: Env) => ({
    dsn: 'https://72514df4060ca87603dc4b5c334d49cf@o4507319328702464.ingest.us.sentry.io/4511439645769728',
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
