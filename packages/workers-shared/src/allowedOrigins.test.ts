import { describe, expect, it } from 'vitest';
import { allowedOrigins, isAllowedOrigin } from './allowedOrigins';

describe('isAllowedOrigin', () => {
  it('returns true for an entry on the allowlist', () => {
    expect(isAllowedOrigin(allowedOrigins[0])).toBe(true);
  });

  it('returns false for an entry that is not on the allowlist', () => {
    expect(isAllowedOrigin('https://evil.example.com')).toBe(false);
  });

  it('matches case-insensitively on the host portion', () => {
    expect(isAllowedOrigin('https://AURORACOLONYPUB.com')).toBe(true);
    expect(isAllowedOrigin('HTTPS://auroracolonypub.com')).toBe(true);
  });
});
