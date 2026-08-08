import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ZohoBooksTokenManager } from '../src/token-manager.js';
import { AuthenticationError } from '../src/errors.js';

function makeTokenResponse(
  accessToken = 'access-token-123',
  expiresIn = 3600,
  refreshToken?: string,
): Response {
  return new Response(
    JSON.stringify({
      access_token: accessToken,
      ...(refreshToken && { refresh_token: refreshToken }),
      token_type: 'Bearer',
      expires_in: expiresIn,
      api_domain: 'https://www.zohoapis.eu',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

const silentLogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

describe('ZohoBooksTokenManager', () => {
  let manager: ZohoBooksTokenManager;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    manager = new ZohoBooksTokenManager({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      refreshToken: 'refresh-token',
      region: 'eu',
      logger: silentLogger,
    });
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getAccessToken()', () => {
    it('fetches a new token on first call', async () => {
      fetchMock.mockResolvedValueOnce(makeTokenResponse());

      const token = await manager.getAccessToken();

      expect(token).toBe('access-token-123');
      expect(fetchMock).toHaveBeenCalledOnce();

      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://accounts.zoho.eu/oauth/v2/token');
      expect(options.method).toBe('POST');
      expect(options.body).toContain('grant_type=refresh_token');
      expect(options.body).toContain('client_id=client-id');
      expect(options.body).toContain('client_secret=client-secret');
      expect(options.body).toContain('refresh_token=refresh-token');
    });

    it('returns cached token on subsequent calls within expiry window', async () => {
      fetchMock.mockResolvedValueOnce(makeTokenResponse());

      await manager.getAccessToken();
      const token = await manager.getAccessToken();

      expect(token).toBe('access-token-123');
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('refreshes token when within 5-minute expiry buffer', async () => {
      fetchMock
        .mockResolvedValueOnce(makeTokenResponse('token-1', 3600))
        .mockResolvedValueOnce(makeTokenResponse('token-2', 3600));

      await manager.getAccessToken();

      vi.advanceTimersByTime(56 * 60 * 1000);

      const token = await manager.getAccessToken();
      expect(token).toBe('token-2');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('deduplicates concurrent refresh calls', async () => {
      fetchMock.mockResolvedValueOnce(makeTokenResponse());

      const [t1, t2, t3] = await Promise.all([
        manager.getAccessToken(),
        manager.getAccessToken(),
        manager.getAccessToken(),
      ]);

      expect(t1).toBe('access-token-123');
      expect(t2).toBe('access-token-123');
      expect(t3).toBe('access-token-123');
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('uses correct accounts domain for each region', async () => {
      const regions = ['com', 'in', 'com.au', 'jp'] as const;

      for (const region of regions) {
        const mgr = new ZohoBooksTokenManager({
          clientId: 'cid',
          clientSecret: 'csec',
          refreshToken: 'rt',
          region,
          logger: silentLogger,
        });
        fetchMock.mockResolvedValueOnce(makeTokenResponse());
        await mgr.getAccessToken();

        const [url] = fetchMock.mock.lastCall as [string];
        expect(url).toBe(`https://accounts.zoho.${region}/oauth/v2/token`);
      }
    });
  });

  describe('error handling', () => {
    it('throws AuthenticationError on non-OK response', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 }),
      );

      await expect(manager.getAccessToken()).rejects.toThrow(AuthenticationError);
    });

    it('throws AuthenticationError when access_token is missing', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'invalid_grant' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(manager.getAccessToken()).rejects.toThrow(AuthenticationError);
    });

    it('logs error body with invalid_grant as warn', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'invalid_grant' }), {
          status: 400,
        }),
      );

      await expect(manager.getAccessToken()).rejects.toThrow(AuthenticationError);

      expect(silentLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('invalid_grant'),
      );
    });

    it('logs error body on generic non-OK response', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 }),
      );

      await expect(manager.getAccessToken()).rejects.toThrow(AuthenticationError);

      expect(silentLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Token refresh failed'),
      );
    });
  });

  describe('refresh token rotation', () => {
    it('invokes onTokenRefreshed when a new refresh token is returned', async () => {
      const onTokenRefreshed = vi.fn().mockResolvedValue(undefined);
      const mgr = new ZohoBooksTokenManager({
        clientId: 'cid',
        clientSecret: 'csec',
        refreshToken: 'old-rt',
        region: 'eu',
        onTokenRefreshed,
        logger: silentLogger,
      });

      fetchMock.mockResolvedValueOnce(makeTokenResponse('at-1', 3600, 'new-rt'));

      await mgr.getAccessToken();

      expect(onTokenRefreshed).toHaveBeenCalledWith('new-rt');
    });

    it('does not invoke onTokenRefreshed when refresh token is unchanged', async () => {
      const onTokenRefreshed = vi.fn().mockResolvedValue(undefined);
      const mgr = new ZohoBooksTokenManager({
        clientId: 'cid',
        clientSecret: 'csec',
        refreshToken: 'same-rt',
        region: 'eu',
        onTokenRefreshed,
        logger: silentLogger,
      });

      fetchMock.mockResolvedValueOnce(makeTokenResponse('at-1', 3600, 'same-rt'));

      await mgr.getAccessToken();

      expect(onTokenRefreshed).not.toHaveBeenCalled();
    });

    it('does not invoke onTokenRefreshed when no refresh token in response', async () => {
      const onTokenRefreshed = vi.fn().mockResolvedValue(undefined);
      const mgr = new ZohoBooksTokenManager({
        clientId: 'cid',
        clientSecret: 'csec',
        refreshToken: 'old-rt',
        region: 'eu',
        onTokenRefreshed,
        logger: silentLogger,
      });

      fetchMock.mockResolvedValueOnce(makeTokenResponse('at-1', 3600));

      await mgr.getAccessToken();

      expect(onTokenRefreshed).not.toHaveBeenCalled();
    });

    it('does not throw when onTokenRefreshed callback fails', async () => {
      const onTokenRefreshed = vi.fn().mockRejectedValue(new Error('DB write failed'));
      const mgr = new ZohoBooksTokenManager({
        clientId: 'cid',
        clientSecret: 'csec',
        refreshToken: 'old-rt',
        region: 'eu',
        onTokenRefreshed,
        logger: silentLogger,
      });

      fetchMock.mockResolvedValueOnce(makeTokenResponse('at-1', 3600, 'new-rt'));

      const token = await mgr.getAccessToken();
      expect(token).toBe('at-1');
    });

    it('uses the rotated refresh token for subsequent refreshes', async () => {
      const mgr = new ZohoBooksTokenManager({
        clientId: 'cid',
        clientSecret: 'csec',
        refreshToken: 'original-rt',
        region: 'eu',
        logger: silentLogger,
      });

      fetchMock.mockResolvedValueOnce(makeTokenResponse('at-1', 3600, 'rotated-rt'));
      await mgr.getAccessToken();

      vi.advanceTimersByTime(56 * 60 * 1000);

      fetchMock.mockResolvedValueOnce(makeTokenResponse('at-2', 3600));
      await mgr.getAccessToken();

      const [, options] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect(options.body).toContain('refresh_token=rotated-rt');
    });
  });

  describe('invalidateAccessToken()', () => {
    it('forces re-fetch on next getAccessToken call', async () => {
      fetchMock
        .mockResolvedValueOnce(makeTokenResponse('token-1'))
        .mockResolvedValueOnce(makeTokenResponse('token-2'));

      await manager.getAccessToken();
      manager.invalidateAccessToken();

      const token = await manager.getAccessToken();
      expect(token).toBe('token-2');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
