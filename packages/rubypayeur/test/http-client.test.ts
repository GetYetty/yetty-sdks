import { DateTime } from 'luxon';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { RubyPayeurHttpClient } from '../src/http-client.js';
import { AuthenticationError, RateLimitedError, ServerError } from '../src/errors.js';

vi.mock('p-retry', () => {
  return {
    default: async <T>(
      fn: () => Promise<T>,
      options?: {
        retries?: number;
        shouldRetry?: (error: Error & { attemptNumber: number; retriesLeft: number }) => boolean;
        onFailedAttempt?: (error: Error & { attemptNumber: number; retriesLeft: number }) => void;
      },
    ): Promise<T> => {
      const maxRetries = options?.retries ?? 3;

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          return await fn();
        } catch (error) {
          const decorated = error as Error & { attemptNumber: number; retriesLeft: number };
          decorated.attemptNumber = attempt;
          decorated.retriesLeft = maxRetries - attempt;

          if (options?.shouldRetry && !options.shouldRetry(decorated)) {
            throw error;
          }
          if (attempt <= maxRetries && options?.onFailedAttempt) {
            options.onFailedAttempt(decorated);
          }
          if (attempt > maxRetries) {
            throw error;
          }
        }
      }

      throw new Error('unreachable');
    },
  };
});

function mockFetchResponse(status: number, body: unknown, headers?: Record<string, string>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
  } as Response;
}

const VALID_AUTH_RESPONSE = { auth_token: 'test-auth-token', customer: 'ACME' };
const API_TOKEN = 'platform-or-org-token';

const silentLogger = {
  log: () => {},
  warn: () => {},
  error: () => {},
};

function createClient(): RubyPayeurHttpClient {
  return new RubyPayeurHttpClient({
    apiToken: API_TOKEN,
    authPath: '/api/auth',
    apiLabel: 'Test API',
    logger: silentLogger,
  });
}

function probe(client: RubyPayeurHttpClient): Promise<string> {
  return client.requestWithAuth(async (authToken) => {
    const response = await fetch(new URL('/api/data', client.baseUrl), {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    client.throwOnErrorStatus(response);
    return authToken;
  });
}

describe('RubyPayeurHttpClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  describe('ensureAuthenticated', () => {
    it('POSTs the token to the configured auth path and caches the result', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE));

      const client = createClient();
      await expect(client.ensureAuthenticated()).resolves.toBe('test-auth-token');
      await expect(client.ensureAuthenticated()).resolves.toBe('test-auth-token');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [authUrl, authInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
      expect(authUrl.pathname).toBe('/api/auth');
      expect(authInit.method).toBe('POST');
      expect(JSON.parse(authInit.body as string)).toEqual({ token: API_TOKEN });
    });

    it('deduplicates concurrent authentications into one request', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE));

      const client = createClient();
      await Promise.all([client.ensureAuthenticated(), client.ensureAuthenticated()]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws an authentication error when a 200 response has no token', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, { customer: 'X' }));

      const client = createClient();
      await expect(client.ensureAuthenticated()).rejects.toBeInstanceOf(AuthenticationError);
    });

    it('maps a rejected token (401) to an authentication error', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(401, {}));

      const client = createClient();
      await expect(client.ensureAuthenticated()).rejects.toBeInstanceOf(AuthenticationError);
    });

    it('surfaces a rate-limit error (not an auth failure) on 429', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': '30' }));

      const client = createClient();
      const error = await client.ensureAuthenticated().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(RateLimitedError);
      expect((error as RateLimitedError).retryAfterSeconds).toBe(30);
    });

    it('retries a 5xx on the auth endpoint and surfaces a server error', async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(503, {}));

      const client = createClient();
      await expect(client.ensureAuthenticated()).rejects.toBeInstanceOf(ServerError);
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });

    it('retries a transient network error during authentication', async () => {
      fetchMock
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE));

      const client = createClient();
      await expect(client.ensureAuthenticated()).resolves.toBe('test-auth-token');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws an authentication error when a 200 body is not valid JSON', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.reject(new SyntaxError('Unexpected token <')),
      } as unknown as Response);

      const client = createClient();
      await expect(client.ensureAuthenticated()).rejects.toBeInstanceOf(AuthenticationError);
    });
  });

  describe('requestWithAuth', () => {
    it('refreshes the token on 401 and retries the request', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(401, {}))
        .mockResolvedValueOnce(mockFetchResponse(200, { auth_token: 'refreshed-token' }))
        .mockResolvedValueOnce(mockFetchResponse(200, {}));

      const client = createClient();
      await expect(probe(client)).resolves.toBe('refreshed-token');

      expect(fetchMock).toHaveBeenCalledTimes(4);
      const [lastUrl, lastInit] = fetchMock.mock.calls[3] as [URL, RequestInit];
      expect(lastUrl.pathname).toBe('/api/data');
      expect((lastInit.headers as Record<string, string>).Authorization).toBe(
        'Bearer refreshed-token',
      );
    });

    it('throws an authentication error when the request 401s again after re-auth', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(401, {}))
        .mockResolvedValueOnce(mockFetchResponse(200, { auth_token: 'refreshed-token' }))
        .mockResolvedValueOnce(mockFetchResponse(401, {}));

      const client = createClient();
      await expect(probe(client)).rejects.toBeInstanceOf(AuthenticationError);
    });

    it('maps 429 to a rate-limited error carrying retry-after and does not retry', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': '30' }));

      const client = createClient();
      const error = await probe(client).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(RateLimitedError);
      expect((error as RateLimitedError).retryAfterSeconds).toBe(30);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries a 5xx on the data endpoint and surfaces a server error', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValue(mockFetchResponse(502, {}));

      const client = createClient();
      const error = await probe(client).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ServerError);
      expect((error as ServerError).statusCode).toBe(502);
    });

    it('parses an HTTP-date Retry-After header into seconds', async () => {
      const future = DateTime.now().plus({ seconds: 120 }).toHTTP();
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': future }));

      const client = createClient();
      const error = await probe(client).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(RateLimitedError);
      const retry = (error as RateLimitedError).retryAfterSeconds ?? 0;
      expect(retry).toBeGreaterThan(110);
      expect(retry).toBeLessThanOrEqual(120);
    });

    it('parses an ISO-8601 Retry-After date', async () => {
      const future = DateTime.now().plus({ seconds: 90 }).toISO();
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': future }));

      const client = createClient();
      const error = await probe(client).catch((e: unknown) => e);

      const retry = (error as RateLimitedError).retryAfterSeconds ?? 0;
      expect(retry).toBeGreaterThan(80);
      expect(retry).toBeLessThanOrEqual(90);
    });

    it.each([
      ['-5', 'negative'],
      ['10x', 'trailing junk'],
      ['1.5', 'non-integer'],
    ])('drops a malformed Retry-After value (%s, %s)', async (retryAfter) => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': retryAfter }));

      const client = createClient();
      const error = await probe(client).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(RateLimitedError);
      expect((error as RateLimitedError).retryAfterSeconds).toBeUndefined();
    });
  });
});
