import * as Sentry from '@sentry/cloudflare';

interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

export default Sentry.withSentry(
  (_: Env) => ({
    dsn: 'https://d1b5a6eb0f2eeb49e18a88529e016ff0@o4507319328702464.ingest.us.sentry.io/4511439647735808',
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
