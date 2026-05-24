import type { WorkerContactSubmitPayload } from '@aurora/shared';
import { sharedContactFormConstants } from '@aurora/shared';
import {
  checkIpRateLimit,
  corsHeaders,
  isAllowedOrigin,
  jsonResponse
} from '@aurora/workers-shared';
import type { Env } from '../Env';
import contactEmailService from './ContactEmailService';

type ValidationResult =
  | { ok: true; body: WorkerContactSubmitPayload }
  | { ok: false; field: string; error: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CORS_METHODS = ['POST', 'OPTIONS'] as const;

/**
 * Contact form orchestration singleton. Owns the request lifecycle (CORS,
 * method/origin checks, rate limiting, parsing, validation, honeypot) and
 * delegates the two external API calls (Turnstile, Resend) to
 * `ContactEmailService`. Keeps the worker entry point trivial.
 */
class ContactService {
  /**
   * Top-level dispatcher. Runs cheapest defenses first so obviously bad
   * requests bail out before any outbound network call.
   *
   * @param request Incoming request
   * @param env Worker env (secrets + rate limiter binding)
   */
  async handleRequest(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const echoedOrigin = origin && isAllowedOrigin(origin) ? origin : '';
    const cors: Record<string, string> = echoedOrigin
      ? corsHeaders(echoedOrigin, CORS_METHODS)
      : { Vary: 'Origin' };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: 'POST, OPTIONS', ...cors }
      });
    }
    if (!echoedOrigin) {
      return jsonResponse({ error: 'Forbidden origin' }, 403, cors);
    }

    if (!(await checkIpRateLimit(request, env))) {
      return jsonResponse({ error: 'Too Many Requests' }, 429, cors);
    }
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonResponse({ field: 'body', error: 'Malformed JSON' }, 400, cors);
    }

    const validated = this.validateBody(raw);
    if (!validated.ok) {
      return jsonResponse({ field: validated.field, error: validated.error }, 400, cors);
    }
    const { body } = validated;

    if (body.website.length > 0) {
      // Honeypot tripped — silently 200 so bots don't learn anything.
      return jsonResponse({ ok: true }, 200, cors);
    }

    const turnstileOk = await contactEmailService.verifyTurnstileToken(
      body.turnstileToken,
      env.CLOUDFLARE_TURNSTILE_SECRET_KEY,
      ip
    );
    if (!turnstileOk) {
      return jsonResponse(
        { field: 'turnstileToken', error: 'Captcha verification failed' },
        400,
        cors
      );
    }

    const sent = await contactEmailService.sendContactEmail(
      { name: body.name, email: body.email, message: body.message },
      ip,
      env.RESEND_API_KEY
    );
    if (!sent) {
      return jsonResponse({ error: 'Failed to send message' }, 502, cors);
    }
    return jsonResponse({ ok: true }, 200, cors);
  }

  private validateBody(raw: unknown): ValidationResult {
    if (typeof raw !== 'object' || raw === null) {
      return { ok: false, field: 'body', error: 'Body must be a JSON object' };
    }
    const name = 'name' in raw ? raw.name : undefined;
    const email = 'email' in raw ? raw.email : undefined;
    const message = 'message' in raw ? raw.message : undefined;
    const turnstileToken = 'turnstileToken' in raw ? raw.turnstileToken : undefined;
    const website = 'website' in raw ? raw.website : '';

    if (
      typeof name !== 'string' ||
      name.length < sharedContactFormConstants.minNameLength ||
      name.length > sharedContactFormConstants.maxNameLength
    ) {
      return {
        ok: false,
        field: 'name',
        error: `Name must be ${sharedContactFormConstants.minNameLength}-${sharedContactFormConstants.maxNameLength} characters`
      };
    }
    if (
      typeof email !== 'string' ||
      email.length < sharedContactFormConstants.minEmailLength ||
      email.length > sharedContactFormConstants.maxEmailLength ||
      !EMAIL_REGEX.test(email)
    ) {
      return { ok: false, field: 'email', error: 'Email is invalid' };
    }
    if (
      typeof message !== 'string' ||
      message.length < sharedContactFormConstants.minMessageLength ||
      message.length > sharedContactFormConstants.maxMessageLength
    ) {
      return {
        ok: false,
        field: 'message',
        error: `Message must be ${sharedContactFormConstants.minMessageLength}-${sharedContactFormConstants.maxMessageLength} characters`
      };
    }
    if (typeof turnstileToken !== 'string' || turnstileToken.length === 0) {
      return {
        ok: false,
        field: 'turnstileToken',
        error: 'Turnstile token is required'
      };
    }
    if (typeof website !== 'string') {
      return { ok: false, field: 'website', error: 'Honeypot must be a string' };
    }
    return { ok: true, body: { name, email, message, website, turnstileToken } };
  }
}

export default new ContactService();
