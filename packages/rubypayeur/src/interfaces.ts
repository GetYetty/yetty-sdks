import type { CreateDebtInput, RecoveryDebt, RubyPayeurScoring } from './types.js';

export interface ScoringClient {
  getCompanyScoring(siren: string): Promise<RubyPayeurScoring>;
}

export interface RecouvrementClient {
  validateCredentials(): Promise<boolean>;
  createDebt(input: CreateDebtInput): Promise<RecoveryDebt>;
  getDebt(externalDebtId: string): Promise<RecoveryDebt>;
  getDebts(externalDebtIds: string[]): Promise<RecoveryDebt[]>;
  iterateDebts(): AsyncGenerator<RecoveryDebt[]>;
}
