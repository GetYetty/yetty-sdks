import type { TokenManager } from '../token-manager.js';

export interface TokenManagerCall {
  method: 'getAccessToken' | 'invalidateAccessToken';
  args: unknown[];
}

export class FakeTokenManager implements TokenManager {
  private token = 'fake-access-token';
  private pendingError: Error | undefined;
  private recordedCalls: TokenManagerCall[] = [];

  get calls(): readonly TokenManagerCall[] {
    return this.recordedCalls;
  }

  setToken(token: string): this {
    this.token = token;
    return this;
  }

  failNext(error: Error): this {
    this.pendingError = error;
    return this;
  }

  reset(): void {
    this.token = 'fake-access-token';
    this.pendingError = undefined;
    this.recordedCalls = [];
  }

  async getAccessToken(): Promise<string> {
    this.recordedCalls.push({ method: 'getAccessToken', args: [] });

    if (this.pendingError) {
      const error = this.pendingError;
      this.pendingError = undefined;
      throw error;
    }

    return this.token;
  }

  invalidateAccessToken(): void {
    this.recordedCalls.push({ method: 'invalidateAccessToken', args: [] });
  }
}
