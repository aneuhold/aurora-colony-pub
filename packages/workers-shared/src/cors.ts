/** HTTP methods a single Worker advertises in its CORS headers. */
export type CorsMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

/**
 * Standard CORS response headers for an allowed origin. The caller has
 * already decided the origin is on the allowlist — this just shapes the
 * headers.
 *
 * @param origin Allowed origin to echo back
 * @param methods Methods this Worker advertises (always include `OPTIONS`
 *   when the Worker handles preflight)
 */
export const corsHeaders = (
  origin: string,
  methods: readonly CorsMethod[]
): Record<string, string> => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': methods.join(', '),
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin'
});
