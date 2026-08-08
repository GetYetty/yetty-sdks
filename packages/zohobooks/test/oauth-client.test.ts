import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZohoBooksOAuthClient } from '../src/oauth-client.js';

const defaultOptions = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  callbackUrl: 'https://app.test/callback',
  scopes: 'ZohoBooks.fullaccess.all',
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
};

describe('ZohoBooksOAuthClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAuthorizationUrl', () => {
    it('should build an EU authorization URL by default', () => {
      const client = new ZohoBooksOAuthClient(defaultOptions);
      const url = client.getAuthorizationUrl('random-state');

      expect(url).toContain('https://accounts.zoho.eu/oauth/v2/auth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('state=random-state');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
    });

    it('should use the specified region', () => {
      const client = new ZohoBooksOAuthClient(defaultOptions);
      const url = client.getAuthorizationUrl('state', 'com');

      expect(url).toContain('https://accounts.zoho.com/oauth/v2/auth');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange code for tokens', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'access-123',
            refresh_token: 'refresh-456',
            api_domain: 'https://www.zohoapis.eu',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );

      const client = new ZohoBooksOAuthClient(defaultOptions);
      const result = await client.exchangeCodeForTokens('auth-code');

      expect(result).toEqual({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        apiDomain: 'https://www.zohoapis.eu',
        region: 'eu',
      });
    });

    it('should throw when access_token is missing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            api_domain: 'https://www.zohoapis.eu',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );

      const client = new ZohoBooksOAuthClient(defaultOptions);
      await expect(client.exchangeCodeForTokens('code')).rejects.toThrow('missing access_token');
    });

    it('should throw when refresh_token is missing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'access-123',
            api_domain: 'https://www.zohoapis.eu',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      );

      const client = new ZohoBooksOAuthClient(defaultOptions);
      await expect(client.exchangeCodeForTokens('code')).rejects.toThrow('missing refresh_token');
    });

    it('should throw on HTTP error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Bad Request', { status: 400 }),
      );

      const client = new ZohoBooksOAuthClient(defaultOptions);
      await expect(client.exchangeCodeForTokens('code')).rejects.toThrow('token exchange failed');
    });
  });

  describe('listOrganizations', () => {
    it('should return organizations', async () => {
      const orgs = [
        {
          organization_id: 'org-1',
          name: 'Test Org',
          is_default_org: true,
          country_code: 'FR',
          currency_code: 'EUR',
          fiscal_year_start_month: 1,
          time_zone: 'Europe/Paris',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ organizations: orgs }), { status: 200 }),
      );

      const client = new ZohoBooksOAuthClient(defaultOptions);
      const result = await client.listOrganizations('token', 'https://www.zohoapis.eu');

      expect(result).toEqual(orgs);
    });

    it('should throw on HTTP error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Forbidden', { status: 403 }),
      );

      const client = new ZohoBooksOAuthClient(defaultOptions);
      await expect(client.listOrganizations('token', 'https://www.zohoapis.eu')).rejects.toThrow(
        'list organizations failed',
      );
    });
  });
});
