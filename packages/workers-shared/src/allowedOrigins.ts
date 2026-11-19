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
 * True when `origin` is on the {@link allowedOrigins} allowlist. Match is
 * case-insensitive (RFC 3986 — scheme and host are case-insensitive); the
 * allowlist itself is lowercase so a `toLowerCase()` on the input is
 * sufficient.
 *
 * @param origin Raw `Origin` request header value
 */
const isAllowedOrigin = (origin: string): boolean => allowedOrigins.includes(origin.toLowerCase());

/**
 * Checks the request's `Origin` against {@link allowedOrigins} and builds the
 * CORS headers to attach to every response. Preflight (`OPTIONS`) and
 * methods outside `methods` get a finished 204 / 405 `response` the
 * handler should return as-is.
 *
 * @param request Incoming request
 * @param methods Methods the endpoint accepts, not counting `OPTIONS`
 * @param allowHeaders Value for `Access-Control-Allow-Headers`
 */
export const resolveCors = (request: Request, methods: string[], allowHeaders = 'Content-Type') => {
  const origin = request.headers.get('Origin');
  const originAllowed = origin !== null && isAllowedOrigin(origin);
  const allowMethods = [...methods, 'OPTIONS'].join(', ');
  const headers: Record<string, string> = originAllowed
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': allowMethods,
        'Access-Control-Allow-Headers': allowHeaders,
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin'
      }
    : { Vary: 'Origin' };

  let response: Response | null = null;
  if (request.method === 'OPTIONS') {
    response = new Response(null, { status: 204, headers });
  } else if (!methods.includes(request.method)) {
    response = new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: allowMethods, ...headers }
    });
  }
  return { headers, originAllowed, response };
};
