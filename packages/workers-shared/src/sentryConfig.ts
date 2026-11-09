/**
 * Standard Sentry options every Worker uses with `Sentry.withSentry`.
 * Per-Worker call site passes the Worker's DSN:
 *
 * ```ts
 * export default Sentry.withSentry(
 *   () => sentryWorkerOptions('https://…@…ingest.us.sentry.io/…'),
 *   { ... } satisfies ExportedHandler<Env>
 * );
 * ```
 *
 * @param dsn Project DSN (public identifier, not a secret — hard-coding
 *   it inline per Worker is fine)
 */
export const sentryWorkerOptions = (dsn: string) => ({
  dsn,
  /**
   * Disabled under Vitest: `@cloudflare/vitest-plugin` sets
   * `process.env.MODE` to `'test'`. In a deployed Worker, `process.env` doesn't have MODE.
   */
  enabled: process.env.MODE !== 'test',
  tracesSampleRate: 1.0
});
