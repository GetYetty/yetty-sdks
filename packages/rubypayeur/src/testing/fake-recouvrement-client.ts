import type { RecouvrementClient } from '../interfaces.js';
import { NotFoundError } from '../errors.js';
import type { CreateDebtInput, RecoveryDebt } from '../types.js';

export interface RecouvrementClientCall {
  method: 'validateCredentials' | 'createDebt' | 'getDebt' | 'getDebts' | 'iterateDebts';
  args: unknown[];
}

export class FakeRecouvrementClient implements RecouvrementClient {
  private debts = new Map<string, RecoveryDebt>();
  private credentialsValid = true;
  private pendingErrors = new Map<RecouvrementClientCall['method'], Error>();
  private recordedCalls: RecouvrementClientCall[] = [];
  private nextDebtId = 1;

  get calls(): readonly RecouvrementClientCall[] {
    return this.recordedCalls;
  }

  seedDebt(debt: RecoveryDebt): this {
    this.debts.set(debt.externalDebtId, debt);
    return this;
  }

  setCredentialsValid(valid: boolean): this {
    this.credentialsValid = valid;
    return this;
  }

  failNext(method: RecouvrementClientCall['method'], error: Error): this {
    this.pendingErrors.set(method, error);
    return this;
  }

  reset(): void {
    this.debts.clear();
    this.credentialsValid = true;
    this.pendingErrors.clear();
    this.recordedCalls = [];
    this.nextDebtId = 1;
  }

  private consumeError(method: RecouvrementClientCall['method']): void {
    const error = this.pendingErrors.get(method);
    if (error) {
      this.pendingErrors.delete(method);
      throw error;
    }
  }

  async validateCredentials(): Promise<boolean> {
    this.recordedCalls.push({ method: 'validateCredentials', args: [] });
    this.consumeError('validateCredentials');
    return this.credentialsValid;
  }

  async createDebt(input: CreateDebtInput): Promise<RecoveryDebt> {
    this.recordedCalls.push({ method: 'createDebt', args: [input] });
    this.consumeError('createDebt');

    const debt: RecoveryDebt = {
      externalDebtId: `FAKE-${this.nextDebtId++}`,
      status: 'pending',
      partnerStatusLabel: 'Dossier en attente de validation',
      amountRecoveredCents: 0,
      amountRemainingCents: input.invoices.reduce((sum, inv) => sum + inv.amountDueCents, 0),
    };
    this.debts.set(debt.externalDebtId, debt);
    return debt;
  }

  async getDebt(externalDebtId: string): Promise<RecoveryDebt> {
    this.recordedCalls.push({ method: 'getDebt', args: [externalDebtId] });
    this.consumeError('getDebt');

    const debt = this.debts.get(externalDebtId);
    if (!debt) {
      throw new NotFoundError(`debt reference=${externalDebtId}`);
    }
    return debt;
  }

  async getDebts(externalDebtIds: string[]): Promise<RecoveryDebt[]> {
    this.recordedCalls.push({ method: 'getDebts', args: [externalDebtIds] });
    this.consumeError('getDebts');

    if (externalDebtIds.length === 0) {
      return [...this.debts.values()];
    }
    const requested = new Set(externalDebtIds);
    return [...this.debts.values()].filter((d) => requested.has(d.externalDebtId));
  }

  async *iterateDebts(): AsyncGenerator<RecoveryDebt[]> {
    this.recordedCalls.push({ method: 'iterateDebts', args: [] });
    this.consumeError('iterateDebts');

    const allDebts = [...this.debts.values()];
    if (allDebts.length > 0) {
      yield allDebts;
    }
  }
}
