import { vi } from 'vitest';

const SENTRY_INGEST_PATTERN = /^https:\/\/[^/]*\.ingest\.[^/]*sentry\.io\//;

/**
 * Resolves the URL of a `fetch`-style input the same way the runtime
 * does. Exported so test fetch mocks can hand it off without re-deriving.
 *
 * @param input `RequestInfo | URL` value handed to a `fetch` shim
 */
export const fetchInputUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
};

/**
 * Returns a fetch-mock impl that intercepts Sentry ingest URLs and lets
 * the caller-supplied `delegate` handle anything else. Workers wrap each
 * `fetch` handler with `Sentry.withSentry`, which fire-and-forgets to
 * `*.ingest.*sentry.io` — without this interceptor those outbound calls
 * trip strict "unexpected outbound fetch" guards in tests.
 *
 * @param delegate Handler for non-Sentry URLs. Typically rejects with
 *   "Unexpected outbound fetch" so the test suite catches surprises.
 */
export const sentryIngestAwareFetch =
  (delegate: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) =>
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = fetchInputUrl(input);
    if (SENTRY_INGEST_PATTERN.test(url)) {
      return Promise.resolve(new Response(null, { status: 200 }));
    }
    return delegate(input, init);
  };

/**
 * Installs a `globalThis.fetch` spy that swallows Sentry ingest fetches
 * and rejects everything else with `Unexpected outbound fetch in test`.
 * Use when your test exercises a Worker that doesn't otherwise call
 * external services (so the only outbound fetches you expect are from the
 * Sentry SDK).
 */
export const installSentryOnlyFetchMock = (): void => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    sentryIngestAwareFetch((input) =>
      Promise.reject(new Error(`Unexpected outbound fetch in test: ${fetchInputUrl(input)}`))
    )
  );
};

/**
 * Returns a generator that yields fresh, deterministic IP strings on each
 * call — `203.0.113.1`, `203.0.113.2`, ... Each Worker integration test
 * needs distinct IPs so the rate-limit binding's per-IP counter does not
 * cross-pollute between cases.
 */
export const createTestIpGenerator = (): (() => string) => {
  let counter = 0;
  return () => {
    counter += 1;
    return `203.0.113.${counter}`;
  };
};
