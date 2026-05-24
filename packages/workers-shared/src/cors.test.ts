import { describe, expect, it } from 'vitest';
import { allowedOrigins, isAllowedOrigin } from './allowedOrigins';
import { corsHeaders } from './cors';

describe('isAllowedOrigin', () => {
  it('returns true for an entry on the allowlist', () => {
    expect(isAllowedOrigin(allowedOrigins[0])).toBe(true);
  });

  it('returns false for an entry that is not on the allowlist', () => {
    expect(isAllowedOrigin('https://evil.example.com')).toBe(false);
  });

  it('is case-sensitive on the host portion', () => {
    expect(isAllowedOrigin('https://AURORACOLONYPUB.com')).toBe(false);
  });
});

describe('corsHeaders', () => {
  it('echoes the origin, joins the methods, and stamps the standard headers', () => {
    const headers = corsHeaders('https://auroracolonypub.com', ['GET', 'OPTIONS']);
    expect(headers).toEqual({
      'Access-Control-Allow-Origin': 'https://auroracolonypub.com',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin'
    });
  });
});
