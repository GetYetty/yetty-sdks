/**
 * Integration smoke tests that hit the real RubyPayeur Recouvrement API.
 *
 * Skipped unless RUBYPAYEUR_RECOUVREMENT_TOKEN is set in the environment.
 * Run manually with:
 *   RUBYPAYEUR_RECOUVREMENT_TOKEN=xxx npm test -w @getyetty-sdk/rubypayeur
 */
import { describe, it, expect } from 'vitest';

import { RubyPayeurRecouvrementClient } from '../src/recouvrement-client.js';

const token = process.env.RUBYPAYEUR_RECOUVREMENT_TOKEN;

describe.skipIf(!token)(
  'Recouvrement API integration',
  () => {
    const client = new RubyPayeurRecouvrementClient({
      apiToken: token!,
      isProduction: true,
    });

    it('validates credentials', async () => {
      const valid = await client.validateCredentials();
      expect(valid).toBe(true);
    });

    it('fetches debts and parses every entry through Zod schemas', async () => {
      const debts = await client.getDebts([]);

      expect(debts.length).toBeGreaterThan(0);

      for (const debt of debts) {
        expect(debt.externalDebtId).toEqual(expect.any(String));
        expect(['pending', 'in_progress', 'resolved', 'failed', 'cancelled']).toContain(
          debt.status,
        );
        expect(debt.amountRecoveredCents).toEqual(expect.any(Number));
        expect(debt.amountRemainingCents).toEqual(expect.any(Number));
        expect(typeof debt.collectiveProceedings).toBe('boolean');
        expect(typeof debt.debtorActive).toBe('boolean');
      }
    });

    it('fetches a single debt by reference', async () => {
      const allDebts = await client.getDebts([]);
      const first = allDebts[0]!;

      const debt = await client.getDebt(first.externalDebtId);
      expect(debt.externalDebtId).toBe(first.externalDebtId);
      expect(debt.status).toBe(first.status);
    });
  },
  30_000,
);
