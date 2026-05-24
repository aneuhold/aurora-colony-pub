import { describe, expect, it } from 'vitest';
import { corsHeaders } from './cors';

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
