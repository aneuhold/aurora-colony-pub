import { vi } from 'vitest';

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
 * Installs a `globalThis.fetch` spy that rejects every call with
 * `Unexpected outbound fetch in test`. Use when the Worker under test
 * should not reach any external service.
 */
export const installNoOutboundFetchMock = (): void => {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
    Promise.reject(new Error(`Unexpected outbound fetch in test: ${fetchInputUrl(input)}`))
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
