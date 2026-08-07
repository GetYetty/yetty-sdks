import { describe, it, expect } from 'vitest';
import { buildScoring, buildRecoveryDebt, buildCreateDebtInput } from '../../src/testing/index.js';

describe('builders', () => {
  describe('buildScoring', () => {
    it('returns sensible defaults', () => {
      const scoring = buildScoring();

      expect(scoring.score).toBe(75);
      expect(scoring.letter).toBe('A');
      expect(scoring.color).toBe('dark_green');
      expect(scoring.risk).toBe('Very low - excellent credit rating');
    });

    it('allows overriding individual fields', () => {
      const scoring = buildScoring({ score: 30, letter: 'D' });

      expect(scoring.score).toBe(30);
      expect(scoring.letter).toBe('D');
      expect(scoring.color).toBe('dark_green');
    });
  });

  describe('buildRecoveryDebt', () => {
    it('returns sensible defaults', () => {
      const debt = buildRecoveryDebt();

      expect(debt.externalDebtId).toBe('DEBT-001');
      expect(debt.status).toBe('in_progress');
      expect(debt.amountRecoveredCents).toBe(15050);
      expect(debt.amountRemainingCents).toBe(40000);
    });

    it('allows overriding individual fields', () => {
      const debt = buildRecoveryDebt({ status: 'resolved', externalDebtId: 'CUSTOM' });

      expect(debt.status).toBe('resolved');
      expect(debt.externalDebtId).toBe('CUSTOM');
      expect(debt.partnerStatusLabel).toBe('En cours de recouvrement');
    });
  });

  describe('buildCreateDebtInput', () => {
    it('returns a valid input with defaults', () => {
      const input = buildCreateDebtInput();

      expect(input.debtor.registrationNumber).toBe('987654321');
      expect(input.invoices).toHaveLength(1);
      expect(input.lateFee).toBe(true);
    });

    it('allows overriding top-level fields', () => {
      const input = buildCreateDebtInput({ lateFee: false, comment: 'Urgent' });

      expect(input.lateFee).toBe(false);
      expect(input.comment).toBe('Urgent');
      expect(input.debtor.name).toBe('Acme Corp');
    });
  });
});
