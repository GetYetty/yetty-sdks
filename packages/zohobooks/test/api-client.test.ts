import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZohoBooksApiClient } from '../src/api-client.js';
import { AuthenticationError, RateLimitedError, ServerError } from '../src/errors.js';
import type { TokenManager } from '../src/interfaces.js';

vi.mock('bottleneck', () => ({
  default: class MockBottleneck {
    schedule<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    }
  },
}));

vi.mock('p-retry', () => ({
  default: async <T>(
    fn: () => Promise<T>,
    options?: {
      retries?: number;
      onFailedAttempt?: (error: Error & { attemptNumber: number; retriesLeft: number }) => void;
      shouldRetry?: (error: Error & { attemptNumber: number; retriesLeft: number }) => boolean;
    },
  ): Promise<T> => {
    const maxRetries = options?.retries ?? 3;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const failedAttemptError = Object.assign(error as Error, {
          attemptNumber: attempt,
          retriesLeft: maxRetries - attempt + 1,
        });
        if (options?.shouldRetry && !options.shouldRetry(failedAttemptError)) {
          throw error;
        }
        if (attempt <= maxRetries && options?.onFailedAttempt) {
          options.onFailedAttempt(failedAttemptError);
        }
        if (attempt > maxRetries) {
          throw error;
        }
      }
    }
    throw lastError ?? new Error();
  },
}));

const silentLogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ZohoBooksApiClient', () => {
  let client: ZohoBooksApiClient;
  let tokenManager: TokenManager;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tokenManager = {
      getAccessToken: vi.fn().mockResolvedValue('test-access-token'),
      invalidateAccessToken: vi.fn(),
    };

    client = new ZohoBooksApiClient({
      tokenManager,
      organizationId: 'org-123',
      region: 'eu',
      logger: silentLogger,
    });

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  describe('get()', () => {
    it('makes GET request with correct URL, auth header, and organization_id', async () => {
      const responseBody = { invoices: [{ id: '1' }] };
      fetchMock.mockResolvedValueOnce(makeJsonResponse(responseBody));

      const result = await client.get('/invoices');

      expect(result).toEqual(responseBody);
      expect(fetchMock).toHaveBeenCalledOnce();

      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('https://www.zohoapis.eu/books/v3/invoices');
      expect(url).toContain('organization_id=org-123');
      expect(options.method).toBe('GET');
      expect(options.headers).toEqual(
        expect.objectContaining({
          Authorization: 'Zoho-oauthtoken test-access-token',
          Accept: 'application/json',
        }),
      );
    });

    it('appends additional query params', async () => {
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));

      await client.get('/invoices', { page: '2', per_page: '25' });

      const [url] = fetchMock.mock.calls[0] as [string];
      const parsed = new URL(url);
      expect(parsed.searchParams.get('page')).toBe('2');
      expect(parsed.searchParams.get('per_page')).toBe('25');
      expect(parsed.searchParams.get('organization_id')).toBe('org-123');
    });

    it('uses correct API domain for different regions', async () => {
      const comClient = new ZohoBooksApiClient({
        tokenManager,
        organizationId: 'org',
        region: 'com',
        logger: silentLogger,
      });
      fetchMock.mockResolvedValueOnce(makeJsonResponse({}));
      await comClient.get('/invoices');

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('https://www.zohoapis.com/books/v3/invoices');
    });
  });

  describe('error handling', () => {
    it('throws AuthenticationError on 401 and invalidates token', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

      await expect(client.get('/invoices')).rejects.toThrow(AuthenticationError);
      expect(tokenManager.invalidateAccessToken).toHaveBeenCalled();
    });

    it('throws RateLimitedError on 429', async () => {
      fetchMock.mockResolvedValue(
        new Response(null, { status: 429, headers: { 'Retry-After': '30' } }),
      );

      const err = await client.get('/invoices').catch((e: unknown) => e);

      expect(err).toBeInstanceOf(RateLimitedError);
      expect((err as RateLimitedError).retryAfterSeconds).toBe(30);
    });

    it('throws ServerError on 5xx', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

      await expect(client.get('/invoices')).rejects.toThrow(ServerError);
    });

    it('retries once on 401 then throws if still failing', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

      await expect(client.get('/invoices')).rejects.toThrow(AuthenticationError);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('succeeds on retry after transient 401', async () => {
      fetchMock
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(makeJsonResponse({ ok: true }));

      const result = await client.get('/invoices');
      expect(result).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry server errors', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

      await expect(client.get('/invoices')).rejects.toThrow(ServerError);

      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('does not retry 429 errors', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 429 }));

      await expect(client.get('/invoices')).rejects.toThrow(RateLimitedError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws generic error on non-OK response (e.g. 400)', async () => {
      fetchMock.mockResolvedValue(new Response('Bad Request', { status: 400 }));

      await expect(client.get('/invoices')).rejects.toThrow('ZohoBooks API error: 400');
    });
  });
});
