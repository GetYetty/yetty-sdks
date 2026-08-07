import { describe, it, expect, beforeEach } from 'vitest';
import { FakeScoringClient, buildScoring } from '../../src/testing/index.js';
import { NotFoundError, ServerError } from '../../src/errors.js';

describe('FakeScoringClient', () => {
  let client: FakeScoringClient;

  beforeEach(() => {
    client = new FakeScoringClient();
  });

  describe('getCompanyScoring', () => {
    it('returns seeded scoring', async () => {
      const scoring = buildScoring({ score: 90 });
      client.seed('123456789', scoring);

      const result = await client.getCompanyScoring('123456789');

      expect(result).toEqual(scoring);
    });

    it('throws NotFoundError for unknown siren', async () => {
      await expect(client.getCompanyScoring('000000000')).rejects.toThrow(NotFoundError);
    });

    it('records calls', async () => {
      client.seed('111', buildScoring());

      await client.getCompanyScoring('111');
      await client.getCompanyScoring('111');

      expect(client.calls).toHaveLength(2);
      expect(client.calls[0]).toEqual({ method: 'getCompanyScoring', args: ['111'] });
    });
  });

  describe('failNext', () => {
    it('throws the configured error on next call then clears', async () => {
      client.seed('123456789', buildScoring());
      client.failNext(new ServerError(503));

      await expect(client.getCompanyScoring('123456789')).rejects.toThrow(ServerError);

      const result = await client.getCompanyScoring('123456789');
      expect(result.score).toBe(75);
    });

    it('still records the failing call', async () => {
      client.failNext(new ServerError(500));

      await client.getCompanyScoring('123').catch(() => {});

      expect(client.calls).toHaveLength(1);
    });
  });

  describe('reset', () => {
    it('clears scorings, errors, and calls', async () => {
      client.seed('123', buildScoring());
      client.failNext(new ServerError(500));
      await client.getCompanyScoring('123').catch(() => {});

      client.reset();

      expect(client.calls).toHaveLength(0);
      await expect(client.getCompanyScoring('123')).rejects.toThrow(NotFoundError);
    });
  });

  describe('seed chaining', () => {
    it('returns this for fluent API', () => {
      const result = client.seed('111', buildScoring()).seed('222', buildScoring({ score: 50 }));
      expect(result).toBe(client);
    });
  });
});
