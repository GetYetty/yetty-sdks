import { describe, it, expect, vi, beforeEach } from 'vitest';

import { RubyPayeurScoringClient } from '../src/scoring-client.js';
import {
  AuthenticationError,
  NotFoundError,
  RateLimitedError,
  ServerError,
} from '../src/errors.js';

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

const VALID_AUTH_RESPONSE = { auth_token: 'test-auth-token' };

const VALID_SCORING_RESPONSE = {
  data: {
    attributes: {
      current_scoring: '75.0',
      current_scoring_letter: 'A',
      current_scoring_color: '#0A7E4E',
      current_scoring_risk: 'Very low - excellent credit rating',
    },
  },
};

const silentLogger = {
  log: () => {},
  warn: () => {},
  error: () => {},
};

function createClient() {
  return new RubyPayeurScoringClient({
    apiToken: 'test-api-token',
    logger: silentLogger,
  });
}

describe('RubyPayeurScoringClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  describe('getCompanyScoring', () => {
    it('authenticates and returns scoring data', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_SCORING_RESPONSE));

      const client = createClient();
      const scoring = await client.getCompanyScoring('123456789');

      expect(scoring).toEqual({
        score: 75,
        letter: 'A',
        color: 'dark_green',
        risk: 'Very low - excellent credit rating',
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);

      const [authUrl, authInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
      expect(authUrl.pathname).toBe('/api/auth');
      expect(JSON.parse(authInit.body as string)).toEqual({ token: 'test-api-token' });

      const [scoringUrl, scoringInit] = fetchMock.mock.calls[1] as [URL, RequestInit];
      expect(scoringUrl.pathname).toBe('/api/companies');
      expect(scoringUrl.searchParams.get('siren')).toBe('123456789');
      expect((scoringInit.headers as Record<string, string>).Authorization).toBe(
        'Bearer test-auth-token',
      );
    });

    it('reuses cached auth token on subsequent calls', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_SCORING_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_SCORING_RESPONSE));

      const client = createClient();
      await client.getCompanyScoring('111111111');
      await client.getCompanyScoring('222222222');

      expect(fetchMock).toHaveBeenCalledTimes(3);
      const [firstUrl] = fetchMock.mock.calls[0] as [URL];
      expect(firstUrl.pathname).toBe('/api/auth');
      const [secondUrl] = fetchMock.mock.calls[1] as [URL];
      expect(secondUrl.pathname).toBe('/api/companies');
      const [thirdUrl] = fetchMock.mock.calls[2] as [URL];
      expect(thirdUrl.pathname).toBe('/api/companies');
    });

    it('refreshes token on 401 and retries the request', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(401, {}))
        .mockResolvedValueOnce(mockFetchResponse(200, { auth_token: 'refreshed-token' }))
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_SCORING_RESPONSE));

      const client = createClient();
      const scoring = await client.getCompanyScoring('123456789');

      expect(scoring.score).toBe(75);
      expect(fetchMock).toHaveBeenCalledTimes(4);

      const [lastUrl, lastInit] = fetchMock.mock.calls[3] as [URL, RequestInit];
      expect(lastUrl.pathname).toBe('/api/companies');
      expect((lastInit.headers as Record<string, string>).Authorization).toBe(
        'Bearer refreshed-token',
      );
    });

    it('throws AuthenticationError when auth fails', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(401, {}));

      const client = createClient();
      await expect(client.getCompanyScoring('123456789')).rejects.toThrow(AuthenticationError);
    });

    it('throws AuthenticationError when re-auth after 401 also fails', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(401, {}))
        .mockResolvedValueOnce(mockFetchResponse(403, {}));

      const client = createClient();
      await expect(client.getCompanyScoring('123456789')).rejects.toThrow(AuthenticationError);
    });

    it('throws AuthenticationError when request returns 401 again after successful re-auth', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(401, {}))
        .mockResolvedValueOnce(mockFetchResponse(200, { auth_token: 'refreshed-token' }))
        .mockResolvedValueOnce(mockFetchResponse(401, {}));

      const client = createClient();
      await expect(client.getCompanyScoring('123456789')).rejects.toThrow(AuthenticationError);
    });

    it('throws NotFoundError on HTTP 404', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(404, {}));

      const client = createClient();
      await expect(client.getCompanyScoring('000000000')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when SIREN has no scoring data', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(
          mockFetchResponse(200, {
            data: {
              attributes: {
                current_scoring: null,
                current_scoring_letter: null,
                current_scoring_color: null,
                current_scoring_risk: null,
              },
            },
          }),
        );

      const client = createClient();
      await expect(client.getCompanyScoring('000000000')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when the letter is present but the numeric score is null', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(
          mockFetchResponse(200, {
            data: {
              attributes: {
                current_scoring: null,
                current_scoring_letter: 'A',
                current_scoring_color: '#0A7E4E',
                current_scoring_risk: 'Very low',
              },
            },
          }),
        );

      const client = createClient();
      await expect(client.getCompanyScoring('000000000')).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when the numeric score is an empty string', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(
          mockFetchResponse(200, {
            data: {
              attributes: {
                current_scoring: '',
                current_scoring_letter: 'A',
                current_scoring_color: '#0A7E4E',
                current_scoring_risk: 'Very low',
              },
            },
          }),
        );

      const client = createClient();
      await expect(client.getCompanyScoring('000000000')).rejects.toThrow(NotFoundError);
    });

    it('throws RateLimitedError on 429 with retry-after', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': '30' }));

      const client = createClient();
      const error = await client.getCompanyScoring('123456789').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(RateLimitedError);
      expect((error as RateLimitedError).retryAfterSeconds).toBe(30);
    });

    it('throws ServerError on 5xx after exhausting retries', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(502, {}))
        .mockResolvedValueOnce(mockFetchResponse(502, {}))
        .mockResolvedValueOnce(mockFetchResponse(502, {}))
        .mockResolvedValueOnce(mockFetchResponse(502, {}));

      const client = createClient();
      const error = await client.getCompanyScoring('123456789').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ServerError);
      expect((error as ServerError).statusCode).toBe(502);
    });

    it('retries on 5xx and succeeds', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(503, {}))
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_SCORING_RESPONSE));

      const client = createClient();
      const scoring = await client.getCompanyScoring('123456789');

      expect(scoring.score).toBe(75);
    });

    it('retries on network error and succeeds', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_SCORING_RESPONSE));

      const client = createClient();
      const scoring = await client.getCompanyScoring('123456789');

      expect(scoring.score).toBe(75);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('does not retry on non-5xx errors', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': '10' }));

      const client = createClient();
      await expect(client.getCompanyScoring('123456789')).rejects.toThrow(RateLimitedError);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('authentication hardening', () => {
    it('throws AuthenticationError when a 200 auth response has no token', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, {}));

      const client = createClient();
      await expect(client.getCompanyScoring('123456789')).rejects.toThrow(AuthenticationError);
    });

    it('surfaces a rate-limit error (not an auth failure) when auth returns 429', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': '30' }));

      const client = createClient();
      const error = await client.getCompanyScoring('123456789').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(RateLimitedError);
      expect((error as RateLimitedError).retryAfterSeconds).toBe(30);
    });

    it('retries a 5xx on the auth endpoint and surfaces a server error, not an auth failure', async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(503, {}));

      const client = createClient();
      await expect(client.getCompanyScoring('123456789')).rejects.toThrow(ServerError);
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });

    it('retries a transient network error during authentication', async () => {
      fetchMock
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE))
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_SCORING_RESPONSE));

      const client = createClient();
      const scoring = await client.getCompanyScoring('123456789');

      expect(scoring.score).toBe(75);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('constructor', () => {
    it('accepts undefined token', () => {
      expect(
        () => new RubyPayeurScoringClient({ apiToken: undefined as unknown as string }),
      ).not.toThrow();
    });
  });
});
