import type { ScoringClient } from '../interfaces.js';
import { NotFoundError } from '../errors.js';
import type { RubyPayeurScoring } from '../types.js';

export interface ScoringClientCall {
  method: 'getCompanyScoring';
  args: [siren: string];
}

export class FakeScoringClient implements ScoringClient {
  private scorings = new Map<string, RubyPayeurScoring>();
  private pendingError: Error | undefined;
  private recordedCalls: ScoringClientCall[] = [];

  get calls(): readonly ScoringClientCall[] {
    return this.recordedCalls;
  }

  seed(siren: string, scoring: RubyPayeurScoring): this {
    this.scorings.set(siren, scoring);
    return this;
  }

  failNext(error: Error): this {
    this.pendingError = error;
    return this;
  }

  reset(): void {
    this.scorings.clear();
    this.pendingError = undefined;
    this.recordedCalls = [];
  }

  async getCompanyScoring(siren: string): Promise<RubyPayeurScoring> {
    this.recordedCalls.push({ method: 'getCompanyScoring', args: [siren] });

    if (this.pendingError) {
      const error = this.pendingError;
      this.pendingError = undefined;
      throw error;
    }

    const scoring = this.scorings.get(siren);
    if (!scoring) {
      throw new NotFoundError(`company SIREN ${siren}`);
    }
    return scoring;
  }
}
