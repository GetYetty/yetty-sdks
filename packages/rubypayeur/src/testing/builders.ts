import type { CreateDebtInput, RecoveryDebt, RubyPayeurScoring } from '../types.js';

export function buildScoring(overrides?: Partial<RubyPayeurScoring>): RubyPayeurScoring {
  return {
    score: 75,
    letter: 'A',
    color: 'dark_green',
    risk: 'Very low - excellent credit rating',
    ...overrides,
  };
}

export function buildRecoveryDebt(overrides?: Partial<RecoveryDebt>): RecoveryDebt {
  return {
    externalDebtId: 'DEBT-001',
    status: 'in_progress',
    partnerStatusLabel: 'En cours de recouvrement',
    amountRecoveredCents: 15050,
    amountRemainingCents: 40000,
    ...overrides,
  };
}

export function buildCreateDebtInput(overrides?: Partial<CreateDebtInput>): CreateDebtInput {
  return {
    debtor: {
      name: 'Acme Corp',
      registrationNumber: '987654321',
      gender: 'male',
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean@acme.fr',
      phone: '0612345678',
      address: '12 rue de la Paix, 75002 Paris',
    },
    invoices: [
      {
        reference: 'FA-2024-042',
        amountDueCents: 55045,
        issuedOn: '2024-10-01',
        dueOn: '2024-10-31',
      },
    ],
    lateFee: true,
    ...overrides,
  };
}
