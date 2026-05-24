/**
 * Minimal env shape `checkIpRateLimit` reads from. Each Worker's full
 * `Env` interface will be a superset of this.
 */
interface RateLimitedEnv {
  RATE_LIMITER: RateLimit;
}

/**
 * Calls the Cloudflare `RATE_LIMITER` binding keyed by `CF-Connecting-IP`.
 * Returns `true` when the request is allowed, `false` when it should be
 * rejected. Caller produces the actual 429 response (plain-text vs JSON +
 * CORS varies by Worker). Per-Worker `limit` / `period` lives in each
 * `wrangler.jsonc`.
 *
 * @param request Incoming request
 * @param env Worker env containing the `RATE_LIMITER` binding
 */
export const checkIpRateLimit = async (request: Request, env: RateLimitedEnv): Promise<boolean> => {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.RATE_LIMITER.limit({ key: ip });
  return success;
};
