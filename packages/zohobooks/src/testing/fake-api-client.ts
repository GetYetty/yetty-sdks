import type { ApiClient } from '../interfaces.js';

export interface ApiClientCall {
  method: 'get' | 'getBuffer' | 'getOrganizationId';
  args: unknown[];
}

export class FakeApiClient implements ApiClient {
  private responses = new Map<string, unknown>();
  private bufferResponses = new Map<string, Buffer>();
  private organizationId = 'fake-org-id';
  private pendingError: { method?: string; error: Error } | undefined;
  private recordedCalls: ApiClientCall[] = [];

  get calls(): readonly ApiClientCall[] {
    return this.recordedCalls;
  }

  seedResponse(path: string, response: unknown): this {
    this.responses.set(path, response);
    return this;
  }

  seedBufferResponse(path: string, buffer: Buffer): this {
    this.bufferResponses.set(path, buffer);
    return this;
  }

  setOrganizationId(id: string): this {
    this.organizationId = id;
    return this;
  }

  failNext(error: Error, method?: string): this {
    this.pendingError = { error, method };
    return this;
  }

  reset(): void {
    this.responses.clear();
    this.bufferResponses.clear();
    this.organizationId = 'fake-org-id';
    this.pendingError = undefined;
    this.recordedCalls = [];
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    this.recordedCalls.push({ method: 'get', args: [path, params] });
    this.throwIfPending('get');
    return (this.responses.get(path) ?? {}) as T;
  }

  async getBuffer(path: string, params?: Record<string, string>): Promise<Buffer> {
    this.recordedCalls.push({ method: 'getBuffer', args: [path, params] });
    this.throwIfPending('getBuffer');
    return this.bufferResponses.get(path) ?? Buffer.from('');
  }

  getOrganizationId(): string {
    this.recordedCalls.push({ method: 'getOrganizationId', args: [] });
    return this.organizationId;
  }

  private throwIfPending(currentMethod: string): void {
    if (this.pendingError && (!this.pendingError.method || this.pendingError.method === currentMethod)) {
      const error = this.pendingError.error;
      this.pendingError = undefined;
      throw error;
    }
  }
}
