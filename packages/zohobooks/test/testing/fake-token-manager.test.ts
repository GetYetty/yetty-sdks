import { describe, expect, it } from 'vitest';
import { FakeTokenManager } from '../../src/testing/fake-token-manager.js';

describe('FakeTokenManager', () => {
  it('should return the default fake token', async () => {
    const manager = new FakeTokenManager();
    const token = await manager.getAccessToken();

    expect(token).toBe('fake-access-token');
  });

  it('should return a custom token after setToken()', async () => {
    const manager = new FakeTokenManager();
    manager.setToken('custom-token');

    expect(await manager.getAccessToken()).toBe('custom-token');
  });

  it('should throw the pending error on next call', async () => {
    const manager = new FakeTokenManager();
    manager.failNext(new Error('boom'));

    await expect(manager.getAccessToken()).rejects.toThrow('boom');
    // Should succeed on subsequent call
    expect(await manager.getAccessToken()).toBe('fake-access-token');
  });

  it('should record calls', async () => {
    const manager = new FakeTokenManager();
    await manager.getAccessToken();
    manager.invalidateAccessToken();

    expect(manager.calls).toEqual([
      { method: 'getAccessToken', args: [] },
      { method: 'invalidateAccessToken', args: [] },
    ]);
  });

  it('should reset state', async () => {
    const manager = new FakeTokenManager();
    manager.setToken('custom');
    await manager.getAccessToken();
    manager.reset();

    expect(manager.calls).toEqual([]);
    expect(await manager.getAccessToken()).toBe('fake-access-token');
  });
});
