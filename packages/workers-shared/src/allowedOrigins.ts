/**
 * Origins permitted to call any of the public Worker endpoints. Single
 * source of truth — every Worker that does CORS allowlisting imports this
 * instead of redeclaring it.
 *
 * Adding a new deployment? Add its origin here. Do not duplicate this list
 * inside an individual Worker.
 */
export const allowedOrigins: readonly string[] = [
  'https://aurora-colony-pub-frontend.pages.dev',
  'https://auroracolonypub.com',
  'https://www.auroracolonypub.com',
  'http://localhost:4321'
];

/**
 * True when `origin` is on the {@link allowedOrigins} allowlist. Pass the
 * raw `Origin` header value — case-sensitive scheme + host comparison.
 *
 * @param origin Raw `Origin` request header value
 */
export const isAllowedOrigin = (origin: string): boolean => allowedOrigins.includes(origin);
