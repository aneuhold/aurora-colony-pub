/**
 * JSON-stringifies `body` and returns a `Response` with the standard
 * `Content-Type` plus any caller-supplied headers (CORS, Cache-Control,
 * etc.). All worker handlers should produce JSON via this helper so the
 * `Content-Type` never drifts.
 *
 * @param body Value to serialize — must be JSON-safe
 * @param status HTTP status code
 * @param extraHeaders Additional response headers (CORS, Cache-Control,
 *   ...). The `Content-Type` set here always wins.
 */
export const jsonResponse = (
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {}
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
