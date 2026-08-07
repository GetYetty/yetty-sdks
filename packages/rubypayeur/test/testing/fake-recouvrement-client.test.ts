import { describe, it, expect, beforeEach } from 'vitest';
import {
  FakeRecouvrementClient,
  buildRecoveryDebt,
  buildCreateDebtInput,
} from '../../src/testing/index.js';
import { NotFoundError, ServerError, ValidationError } from '../../src/errors.js';

describe('FakeRecouvrementClient', () => {
  let client: FakeRecouvrementClient;

  beforeEach(() => {
    client = new FakeRecouvrementClient();
  });

  describe('validateCredentials', () => {
    it('returns true by default', async () => {
      expect(await client.validateCredentials()).toBe(true);
    });

    it('returns false when configured', async () => {
      client.setCredentialsValid(false);
      expect(await client.validateCredentials()).toBe(false);
    });
  });

  describe('createDebt', () => {
    it('creates a debt with auto-generated ID', async () => {
      const input = buildCreateDebtInput();
      const debt = await client.createDebt(input);

      expect(debt.externalDebtId).toBe('FAKE-1');
      expect(debt.status).toBe('pending');
      expect(debt.amountRemainingCents).toBe(55045);
    });

    it('increments IDs across calls', async () => {
      const d1 = await client.createDebt(buildCreateDebtInput());
      const d2 = await client.createDebt(buildCreateDebtInput());

      expect(d1.externalDebtId).toBe('FAKE-1');
      expect(d2.externalDebtId).toBe('FAKE-2');
    });

    it('stores the created debt so getDebt can find it', async () => {
      const debt = await client.createDebt(buildCreateDebtInput());
      const found = await client.getDebt(debt.externalDebtId);

      expect(found).toEqual(debt);
    });
  });

  describe('getDebt', () => {
    it('returns a seeded debt', async () => {
      const debt = buildRecoveryDebt({ externalDebtId: 'ABC-123' });
      client.seedDebt(debt);

      const result = await client.getDebt('ABC-123');
      expect(result).toEqual(debt);
    });

    it('throws NotFoundError for unknown debt', async () => {
      await expect(client.getDebt('UNKNOWN')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getDebts', () => {
    it('returns matching debts by ID', async () => {
      client.seedDebt(buildRecoveryDebt({ externalDebtId: 'A' }));
      client.seedDebt(buildRecoveryDebt({ externalDebtId: 'B' }));
      client.seedDebt(buildRecoveryDebt({ externalDebtId: 'C' }));

      const result = await client.getDebts(['A', 'C']);
      expect(result.map((d) => d.externalDebtId)).toEqual(['A', 'C']);
    });

    it('returns all debts when given empty array', async () => {
      client.seedDebt(buildRecoveryDebt({ externalDebtId: 'A' }));
      client.seedDebt(buildRecoveryDebt({ externalDebtId: 'B' }));

      const result = await client.getDebts([]);
      expect(result).toHaveLength(2);
    });
  });

  describe('iterateDebts', () => {
    it('yields all seeded debts in a single page', async () => {
      client.seedDebt(buildRecoveryDebt({ externalDebtId: 'X' }));
      client.seedDebt(buildRecoveryDebt({ externalDebtId: 'Y' }));

      const pages: unknown[][] = [];
      for await (const page of client.iterateDebts()) {
        pages.push(page);
      }

      expect(pages).toHaveLength(1);
      expect(pages[0]).toHaveLength(2);
    });

    it('yields nothing when no debts seeded', async () => {
      const pages: unknown[][] = [];
      for await (const page of client.iterateDebts()) {
        pages.push(page);
      }
      expect(pages).toHaveLength(0);
    });
  });

  describe('failNext', () => {
    it('throws error on the specified method then clears', async () => {
      client.failNext('validateCredentials', new ServerError(500));

      await expect(client.validateCredentials()).rejects.toThrow(ServerError);
      expect(await client.validateCredentials()).toBe(true);
    });

    it('can target different methods independently', async () => {
      client.failNext('getDebt', new NotFoundError('debt'));
      client.failNext('createDebt', new ValidationError({ amount: ['must be positive'] }));

      await expect(client.getDebt('X')).rejects.toThrow(NotFoundError);
      await expect(client.createDebt(buildCreateDebtInput())).rejects.toThrow(ValidationError);
    });
  });

  describe('call recording', () => {
    it('records all calls in order', async () => {
      client.seedDebt(buildRecoveryDebt({ externalDebtId: 'D1' }));

      await client.validateCredentials();
      await client.getDebt('D1');
      await client.getDebts(['D1']);

      expect(client.calls).toHaveLength(3);
      expect(client.calls.map((c) => c.method)).toEqual([
        'validateCredentials',
        'getDebt',
        'getDebts',
      ]);
    });
  });

  describe('reset', () => {
    it('clears everything', async () => {
      client.seedDebt(buildRecoveryDebt({ externalDebtId: 'D1' }));
      client.setCredentialsValid(false);
      client.failNext('getDebt', new ServerError(500));
      await client.validateCredentials();

      client.reset();

      expect(client.calls).toHaveLength(0);
      expect(await client.validateCredentials()).toBe(true);
      await expect(client.getDebt('D1')).rejects.toThrow(NotFoundError);

      const debt = await client.createDebt(buildCreateDebtInput());
      expect(debt.externalDebtId).toBe('FAKE-1');
    });
  });

  describe('seedDebt chaining', () => {
    it('returns this for fluent API', () => {
      const result = client
        .seedDebt(buildRecoveryDebt({ externalDebtId: 'A' }))
        .seedDebt(buildRecoveryDebt({ externalDebtId: 'B' }));
      expect(result).toBe(client);
    });
  });
});
