import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZohoBooksOAuthClient } from '../src/oauth-client.js';

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const silentLogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

describe('ZohoBooksOAuthClient', () => {
  let client: ZohoBooksOAuthClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new ZohoBooksOAuthClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      callbackUrl: 'https://api.test.com/invoice-providers/zohobooks/oauth/callback',
      scopes: 'ZohoBooks.invoices.READ,ZohoBooks.contacts.READ',
      logger: silentLogger,
    });

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  describe('getAuthorizationUrl()', () => {
    it('builds correct authorization URL with all params', () => {
      const url = client.getAuthorizationUrl('encrypted-state');

      expect(url).toContain('https://accounts.zoho.eu/oauth/v2/auth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('state=encrypted-state');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      expect(url).toContain(
        encodeURIComponent('https://api.test.com/invoice-providers/zohobooks/oauth/callback'),
      );
    });

    it('uses correct accounts domain for non-EU region', () => {
      const url = client.getAuthorizationUrl('state', 'com');
      expect(url).toContain('https://accounts.zoho.com/oauth/v2/auth');
    });
  });

  describe('exchangeCodeForTokens()', () => {
    it('exchanges code and derives region from api_domain', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({
          access_token: 'access-123',
          refresh_token: 'refresh-456',
          api_domain: 'https://www.zohoapis.eu',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      );

      const result = await client.exchangeCodeForTokens('auth-code', 'eu');

      expect(result).toEqual({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        apiDomain: 'https://www.zohoapis.eu',
        region: 'eu',
      });

      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://accounts.zoho.eu/oauth/v2/token');
      expect(options.method).toBe('POST');
      expect(options.body).toContain('grant_type=authorization_code');
      expect(options.body).toContain('code=auth-code');
      expect(options.body).toContain('client_id=test-client-id');
      expect(options.body).toContain('client_secret=test-client-secret');
    });

    it('derives region from api_domain for non-EU datacenter', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({
          access_token: 'access',
          refresh_token: 'refresh',
          api_domain: 'https://www.zohoapis.com.au',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      );

      const result = await client.exchangeCodeForTokens('code', 'com.au');
      expect(result.region).toBe('com.au');
    });

    it('throws when response is not OK', async () => {
      fetchMock.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

      await expect(client.exchangeCodeForTokens('bad-code', 'eu')).rejects.toThrow(
        'ZohoBooks OAuth: token exchange failed',
      );
    });

    it('throws when access_token is missing', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({ error: 'invalid_code' }));

      await expect(client.exchangeCodeForTokens('code', 'eu')).rejects.toThrow(
        'missing access_token',
      );
    });

    it('throws when refresh_token is missing', async () => {
      fetchMock.mockResolvedValueOnce(
        makeJsonResponse({
          access_token: 'token',
          api_domain: 'https://www.zohoapis.eu',
        }),
      );

      await expect(client.exchangeCodeForTokens('code', 'eu')).rejects.toThrow(
        'missing refresh_token',
      );
    });
  });

  describe('listOrganizations()', () => {
    it('fetches organizations from ZohoBooks API', async () => {
      const organizations = [
        {
          organization_id: 'org-1',
          name: 'ACME Corp',
          is_default_org: true,
          country_code: 'FR',
          currency_code: 'EUR',
          fiscal_year_start_month: 1,
          time_zone: 'Europe/Paris',
        },
        {
          organization_id: 'org-2',
          name: 'ACME UK',
          is_default_org: false,
          country_code: 'GB',
          currency_code: 'GBP',
          fiscal_year_start_month: 4,
          time_zone: 'Europe/London',
        },
      ];

      fetchMock.mockResolvedValueOnce(makeJsonResponse({ organizations }));

      const result = await client.listOrganizations(
        'access-token',
        'https://www.zohoapis.eu',
      );

      expect(result).toEqual(organizations);

      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://www.zohoapis.eu/books/v3/organizations');
      expect(options.headers).toEqual(
        expect.objectContaining({
          Authorization: 'Zoho-oauthtoken access-token',
        }),
      );
    });

    it('throws when response is not OK', async () => {
      fetchMock.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));

      await expect(
        client.listOrganizations('bad-token', 'https://www.zohoapis.eu'),
      ).rejects.toThrow('list organizations failed');
    });
  });
});
