import { describe, it, expect } from 'vitest';
import { FakeTokenManager } from '../../src/testing/fake-token-manager.js';
import { AuthenticationError } from '../../src/errors.js';

describe('FakeTokenManager', () => {
  it('returns default token', async () => {
    const fake = new FakeTokenManager();
    expect(await fake.getAccessToken()).toBe('fake-access-token');
  });

  it('returns custom token', async () => {
    const fake = new FakeTokenManager().setToken('my-token');
    expect(await fake.getAccessToken()).toBe('my-token');
  });

  it('records calls', async () => {
    const fake = new FakeTokenManager();
    await fake.getAccessToken();
    fake.invalidateAccessToken();
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[0]).toEqual({ method: 'getAccessToken', args: [] });
    expect(fake.calls[1]).toEqual({ method: 'invalidateAccessToken', args: [] });
  });

  it('throws on failNext then recovers', async () => {
    const fake = new FakeTokenManager().failNext(new AuthenticationError());
    await expect(fake.getAccessToken()).rejects.toThrow(AuthenticationError);
    expect(await fake.getAccessToken()).toBe('fake-access-token');
  });

  it('resets state', async () => {
    const fake = new FakeTokenManager().setToken('custom');
    await fake.getAccessToken();
    fake.reset();
    expect(fake.calls).toHaveLength(0);
    expect(await fake.getAccessToken()).toBe('fake-access-token');
  });
});
