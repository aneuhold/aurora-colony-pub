import { exports } from 'cloudflare:workers';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { contactWorkerConstants } from './util/contactWorkerConstants';

const ORIGIN = contactWorkerConstants.allowedOrigins[0];
const FORBIDDEN_ORIGIN = 'https://evil.example.com';

interface ResendCall {
  url: string;
  init: RequestInit;
}

interface FetchMockOptions {
  turnstileSuccess?: boolean;
  resendStatus?: number;
}

const requestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
};

const setupFetchMock = (options: FetchMockOptions = {}): { resendCalls: ResendCall[] } => {
  const { turnstileSuccess = true, resendStatus = 200 } = options;
  const resendCalls: ResendCall[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = requestUrl(input);
      if (url.startsWith('https://challenges.cloudflare.com/turnstile/v0/siteverify')) {
        return Promise.resolve(
          new Response(JSON.stringify({ success: turnstileSuccess }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }
      if (url.startsWith('https://api.resend.com/emails')) {
        resendCalls.push({ url, init: init ?? {} });
        return Promise.resolve(
          new Response(JSON.stringify({ id: 'fake' }), {
            status: resendStatus,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }
      // Hosts Sentry's transport posts trace / error envelopes to. Allowlisted so
      // the SDK's fire-and-forget fetches don't blow up the test, while still
      // letting us throw on any *other* unexpected outbound call.
      const SENTRY_INGEST_PATTERN = /^https:\/\/[^/]*\.ingest\.[^/]*sentry\.io\//;
      if (SENTRY_INGEST_PATTERN.test(url)) {
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected outbound fetch in test: ${url}`));
    }
  );
  return { resendCalls };
};

let ipCounter = 0;
const nextIp = (): string => {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
};

const validBody = {
  name: 'Alice Example',
  email: 'alice@example.com',
  message: 'Hello there, I would like to book a table.',
  website: '',
  turnstileToken: 'fake-token'
};

const postContact = (
  body: unknown,
  init: { origin?: string | null; method?: string } = {}
): Promise<Response> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'CF-Connecting-IP': nextIp()
  };
  if (init.origin !== null) {
    headers.Origin = init.origin ?? ORIGIN;
  }
  return exports.default.fetch('https://contact.example.com/', {
    method: init.method ?? 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
};

describe('contact worker', () => {
  // First call into the Worker spins up miniflare's pool — ~4-5s in CI cold-start.
  // Pay that cost here so the first real test doesn't blow past the 5s default timeout.
  beforeAll(async () => {
    setupFetchMock();
    const response = await exports.default.fetch('https://contact.example.com/', {
      method: 'GET'
    });
    await response.text();
    vi.restoreAllMocks();
  }, 30_000);

  beforeEach(() => {
    setupFetchMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('responds 204 with CORS headers on OPTIONS preflight', async () => {
    const response = await exports.default.fetch('https://contact.example.com/', {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN }
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('returns 405 on GET', async () => {
    const response = await exports.default.fetch('https://contact.example.com/', {
      method: 'GET',
      headers: { Origin: ORIGIN }
    });
    expect(response.status).toBe(405);
  });

  it('returns 403 on POST with a forbidden Origin', async () => {
    const response = await postContact(validBody, { origin: FORBIDDEN_ORIGIN });
    expect(response.status).toBe(403);
  });

  it('returns 403 on POST with a missing Origin', async () => {
    const response = await postContact(validBody, { origin: null });
    expect(response.status).toBe(403);
  });

  it('silently returns 200 when the honeypot is filled and does not call Resend', async () => {
    const { resendCalls } = setupFetchMock();
    const response = await postContact({ ...validBody, website: 'http://spam.example' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(resendCalls).toHaveLength(0);
  });

  it('returns 400 when email is missing', async () => {
    const { email: _email, ...withoutEmail } = validBody;
    const response = await postContact(withoutEmail);
    expect(response.status).toBe(400);
    const json = await response.json<{ field: string }>();
    expect(json.field).toBe('email');
  });

  it('returns 400 when malformed JSON is sent', async () => {
    const response = await postContact('{not json', {});
    expect(response.status).toBe(400);
  });

  it('returns 400 when Turnstile verification fails', async () => {
    setupFetchMock({ turnstileSuccess: false });
    const response = await postContact(validBody);
    expect(response.status).toBe(400);
    const json = await response.json<{ field: string }>();
    expect(json.field).toBe('turnstileToken');
  });

  it('returns 200 and posts the expected payload to Resend on success', async () => {
    const { resendCalls } = setupFetchMock();
    const response = await postContact(validBody);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(resendCalls).toHaveLength(1);
    const rawBody = resendCalls[0].init.body;
    if (typeof rawBody !== 'string') {
      throw new Error('Expected Resend request body to be a JSON string');
    }
    const sent: unknown = JSON.parse(rawBody);
    if (typeof sent !== 'object' || sent === null) {
      throw new Error('Expected Resend body to parse to an object');
    }
    expect(sent).toMatchObject({
      to: [contactWorkerConstants.ownerEmail],
      from: contactWorkerConstants.fromEmail,
      reply_to: validBody.email
    });
    expect('subject' in sent && typeof sent.subject === 'string').toBe(true);
    if ('subject' in sent && typeof sent.subject === 'string') {
      expect(sent.subject).toContain(validBody.name);
    }
  });

  it('returns 502 when Resend responds with an error', async () => {
    setupFetchMock({ resendStatus: 500 });
    const response = await postContact(validBody);
    expect(response.status).toBe(502);
  });
});
