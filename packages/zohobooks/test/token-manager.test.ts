import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationError } from '../src/errors.js';
import { ZohoBooksTokenManager, type ZohoBooksTokenManagerOptions } from '../src/token-manager.js';

function buildOptions(
  overrides?: Partial<ZohoBooksTokenManagerOptions>,
): ZohoBooksTokenManagerOptions {
  return {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    refreshToken: 'test-refresh-token',
    region: 'eu',
    logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    ...overrides,
  };
}

describe('ZohoBooksTokenManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should fetch a new access token on first call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'new-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          api_domain: 'https://www.zohoapis.eu',
        }),
        { status: 200 },
      ),
    );

    const manager = new ZohoBooksTokenManager(buildOptions());
    const token = await manager.getAccessToken();

    expect(token).toBe('new-access-token');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('should return cached token when not expired', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'cached-token',
          token_type: 'Bearer',
          expires_in: 3600,
          api_domain: 'https://www.zohoapis.eu',
        }),
        { status: 200 },
      ),
    );

    const manager = new ZohoBooksTokenManager(buildOptions());
    await manager.getAccessToken();
    const token = await manager.getAccessToken();

    expect(token).toBe('cached-token');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('should refresh token when expired (past buffer)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'first-token',
            token_type: 'Bearer',
            expires_in: 3600,
            api_domain: 'https://www.zohoapis.eu',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'second-token',
            token_type: 'Bearer',
            expires_in: 3600,
            api_domain: 'https://www.zohoapis.eu',
          }),
          { status: 200 },
        ),
      );

    const manager = new ZohoBooksTokenManager(buildOptions());
    await manager.getAccessToken();

    // Advance past expiry (3600s - 300s buffer = 3300s)
    vi.advanceTimersByTime(3301 * 1000);

    const token = await manager.getAccessToken();
    expect(token).toBe('second-token');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should throw AuthenticationError on HTTP failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    const manager = new ZohoBooksTokenManager(buildOptions());
    await expect(manager.getAccessToken()).rejects.toThrow(AuthenticationError);
  });

  it('should throw AuthenticationError when access_token is missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          token_type: 'Bearer',
          expires_in: 3600,
          api_domain: 'https://www.zohoapis.eu',
        }),
        { status: 200 },
      ),
    );

    const manager = new ZohoBooksTokenManager(buildOptions());
    await expect(manager.getAccessToken()).rejects.toThrow(AuthenticationError);
  });

  it('should call onTokenRefreshed when refresh token rotates', async () => {
    const onTokenRefreshed = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'new-access',
          refresh_token: 'rotated-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
          api_domain: 'https://www.zohoapis.eu',
        }),
        { status: 200 },
      ),
    );

    const manager = new ZohoBooksTokenManager(buildOptions({ onTokenRefreshed }));
    await manager.getAccessToken();

    expect(onTokenRefreshed).toHaveBeenCalledWith('rotated-refresh-token');
  });

  it('should invalidate cached token', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'first',
            token_type: 'Bearer',
            expires_in: 3600,
            api_domain: 'https://www.zohoapis.eu',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'second',
            token_type: 'Bearer',
            expires_in: 3600,
            api_domain: 'https://www.zohoapis.eu',
          }),
          { status: 200 },
        ),
      );

    const manager = new ZohoBooksTokenManager(buildOptions());
    await manager.getAccessToken();

    manager.invalidateAccessToken();
    const token = await manager.getAccessToken();

    expect(token).toBe('second');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should deduplicate concurrent refresh calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'deduped-token',
          token_type: 'Bearer',
          expires_in: 3600,
          api_domain: 'https://www.zohoapis.eu',
        }),
        { status: 200 },
      ),
    );

    const manager = new ZohoBooksTokenManager(buildOptions());
    const [t1, t2] = await Promise.all([manager.getAccessToken(), manager.getAccessToken()]);

    expect(t1).toBe('deduped-token');
    expect(t2).toBe('deduped-token');
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
