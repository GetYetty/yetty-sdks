import { describe, it, expect } from 'vitest';
import { FakeApiClient } from '../../src/testing/fake-api-client.js';
import { ServerError } from '../../src/errors.js';

describe('FakeApiClient', () => {
  it('returns seeded response', async () => {
    const fake = new FakeApiClient().seedResponse('/invoices', { data: [1, 2] });
    const result = await fake.get('/invoices');
    expect(result).toEqual({ data: [1, 2] });
  });

  it('returns empty object for unseeded path', async () => {
    const fake = new FakeApiClient();
    const result = await fake.get('/unknown');
    expect(result).toEqual({});
  });

  it('returns organization id', () => {
    const fake = new FakeApiClient().setOrganizationId('org-42');
    expect(fake.getOrganizationId()).toBe('org-42');
  });

  it('records calls', async () => {
    const fake = new FakeApiClient();
    await fake.get('/invoices', { page: '1' });
    fake.getOrganizationId();
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls[0]).toEqual({ method: 'get', args: ['/invoices', { page: '1' }] });
    expect(fake.calls[1]).toEqual({ method: 'getOrganizationId', args: [] });
  });

  it('throws on failNext then recovers', async () => {
    const fake = new FakeApiClient().failNext(new ServerError(503));
    await expect(fake.get('/invoices')).rejects.toThrow(ServerError);
    const result = await fake.get('/invoices');
    expect(result).toEqual({});
  });

  it('failNext targets specific method', async () => {
    const fake = new FakeApiClient()
      .seedResponse('/invoices', { ok: true })
      .failNext(new ServerError(500), 'getBuffer');
    const result = await fake.get('/invoices');
    expect(result).toEqual({ ok: true });
    await expect(fake.getBuffer('/invoices')).rejects.toThrow(ServerError);
  });

  it('resets state', async () => {
    const fake = new FakeApiClient().seedResponse('/x', { a: 1 });
    await fake.get('/x');
    fake.reset();
    expect(fake.calls).toHaveLength(0);
    expect(await fake.get('/x')).toEqual({});
  });
});
