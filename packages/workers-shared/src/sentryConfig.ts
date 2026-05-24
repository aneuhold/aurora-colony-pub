/**
 * Standard Sentry options every Worker uses with `Sentry.withSentry`.
 * Per-Worker call site passes the Worker's DSN and spreads the rest:
 *
 * ```ts
 * Sentry.withSentry(
 *   (_: Env) => sentryWorkerOptions('https://…@…ingest.us.sentry.io/…'),
 *   { ... } satisfies ExportedHandler<Env>
 * );
 * ```
 *
 * @param dsn Project DSN (public identifier, not a secret — hard-coding
 *   it inline per Worker is fine)
 */
export const sentryWorkerOptions = (dsn: string) => ({
  dsn,
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  tracesSampleRate: 1.0
});
