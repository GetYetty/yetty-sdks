import { describe, it, expect } from 'vitest';
import { FakeOAuthClient } from '../../src/testing/fake-oauth-client.js';
import { buildOrganization } from '../../src/testing/builders.js';

describe('FakeOAuthClient', () => {
  it('returns default auth URL', () => {
    const fake = new FakeOAuthClient();
    expect(fake.getAuthorizationUrl('state')).toContain('fake=true');
  });

  it('returns default token result', async () => {
    const fake = new FakeOAuthClient();
    const result = await fake.exchangeCodeForTokens('code');
    expect(result.accessToken).toBe('fake-access-token');
    expect(result.region).toBe('eu');
  });

  it('returns seeded organizations', async () => {
    const org = buildOrganization({ name: 'Test Org' });
    const fake = new FakeOAuthClient().seedOrganizations([org]);
    const result = await fake.listOrganizations('token', 'https://api.zoho.eu');
    expect(result).toEqual([org]);
  });

  it('records calls', async () => {
    const fake = new FakeOAuthClient();
    fake.getAuthorizationUrl('state', 'com');
    await fake.exchangeCodeForTokens('code', 'eu');
    await fake.listOrganizations('token', 'https://api.zoho.eu');
    expect(fake.calls).toHaveLength(3);
    expect(fake.calls[0]).toEqual({ method: 'getAuthorizationUrl', args: ['state', 'com'] });
  });

  it('throws on failNext then recovers', async () => {
    const fake = new FakeOAuthClient().failNext(new Error('fail'));
    await expect(fake.exchangeCodeForTokens('code')).rejects.toThrow('fail');
    const result = await fake.exchangeCodeForTokens('code');
    expect(result.accessToken).toBe('fake-access-token');
  });

  it('resets state', async () => {
    const fake = new FakeOAuthClient();
    fake.getAuthorizationUrl('s');
    fake.reset();
    expect(fake.calls).toHaveLength(0);
  });
});
