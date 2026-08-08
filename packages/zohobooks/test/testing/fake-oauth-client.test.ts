import { describe, expect, it } from 'vitest';
import { FakeOAuthClient } from '../../src/testing/fake-oauth-client.js';
import { buildOrganization } from '../../src/testing/builders.js';

describe('FakeOAuthClient', () => {
  it('should return the default auth URL', () => {
    const client = new FakeOAuthClient();
    const url = client.getAuthorizationUrl('state');

    expect(url).toBe('https://accounts.zoho.eu/oauth/v2/auth?fake=true');
  });

  it('should return a custom auth URL after setAuthUrl()', () => {
    const client = new FakeOAuthClient();
    client.setAuthUrl('https://custom.url');

    expect(client.getAuthorizationUrl('state')).toBe('https://custom.url');
  });

  it('should return default token result', async () => {
    const client = new FakeOAuthClient();
    const result = await client.exchangeCodeForTokens('code');

    expect(result.accessToken).toBe('fake-access-token');
    expect(result.refreshToken).toBe('fake-refresh-token');
  });

  it('should return seeded organizations', async () => {
    const client = new FakeOAuthClient();
    const org = buildOrganization({ name: 'Test Org' });
    client.seedOrganizations([org]);

    const orgs = await client.listOrganizations('token', 'https://www.zohoapis.eu');
    expect(orgs).toEqual([org]);
  });

  it('should throw pending error for any method', async () => {
    const client = new FakeOAuthClient();
    client.failNext(new Error('network error'));

    expect(() => client.getAuthorizationUrl('state')).toThrow('network error');
    // Should not throw on subsequent call
    expect(client.getAuthorizationUrl('state')).toBe(
      'https://accounts.zoho.eu/oauth/v2/auth?fake=true',
    );
  });

  it('should throw pending error only for specified method', async () => {
    const client = new FakeOAuthClient();
    client.failNext(new Error('exchange failed'), 'exchangeCodeForTokens');

    // Should not throw for a different method
    expect(client.getAuthorizationUrl('state')).toBe(
      'https://accounts.zoho.eu/oauth/v2/auth?fake=true',
    );
    // Should throw for the specified method
    await expect(client.exchangeCodeForTokens('code')).rejects.toThrow('exchange failed');
  });

  it('should record all calls', async () => {
    const client = new FakeOAuthClient();
    client.getAuthorizationUrl('s1', 'eu');
    await client.exchangeCodeForTokens('code1', 'com');
    await client.listOrganizations('token', 'https://api.test');

    expect(client.calls).toEqual([
      { method: 'getAuthorizationUrl', args: ['s1', 'eu'] },
      { method: 'exchangeCodeForTokens', args: ['code1', 'com'] },
      { method: 'listOrganizations', args: ['token', 'https://api.test'] },
    ]);
  });

  it('should reset all state', async () => {
    const client = new FakeOAuthClient();
    client.setAuthUrl('https://custom');
    client.seedOrganizations([buildOrganization()]);
    client.getAuthorizationUrl('state');
    client.reset();

    expect(client.calls).toEqual([]);
    expect(client.getAuthorizationUrl('state')).toBe(
      'https://accounts.zoho.eu/oauth/v2/auth?fake=true',
    );
    expect(await client.listOrganizations('t', 'd')).toEqual([]);
  });
});
