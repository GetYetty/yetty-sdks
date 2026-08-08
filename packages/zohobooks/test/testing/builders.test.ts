import { describe, expect, it } from 'vitest';
import { buildOrganization, buildTokenResponse } from '../../src/testing/builders.js';

describe('buildOrganization', () => {
  it('should return an organization with sensible defaults', () => {
    const org = buildOrganization();

    expect(org.organization_id).toBe('org-001');
    expect(org.name).toBe('ACME Corp');
    expect(org.currency_code).toBe('EUR');
  });

  it('should allow overrides', () => {
    const org = buildOrganization({ name: 'Custom Corp', currency_code: 'USD' });

    expect(org.name).toBe('Custom Corp');
    expect(org.currency_code).toBe('USD');
    expect(org.organization_id).toBe('org-001');
  });
});

describe('buildTokenResponse', () => {
  it('should return a token response with sensible defaults', () => {
    const token = buildTokenResponse();

    expect(token.access_token).toBe('access-token-123');
    expect(token.token_type).toBe('Bearer');
    expect(token.expires_in).toBe(3600);
  });

  it('should allow overrides', () => {
    const token = buildTokenResponse({ expires_in: 7200 });

    expect(token.expires_in).toBe(7200);
    expect(token.access_token).toBe('access-token-123');
  });
});
