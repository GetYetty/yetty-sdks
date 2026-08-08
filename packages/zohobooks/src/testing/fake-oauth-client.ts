import type { OAuthClient, OAuthTokenResult } from '../interfaces.js';
import type { ZohoBooksOrganization, ZohoBooksRegion } from '../types.js';

export interface OAuthClientCall {
  method: 'getAuthorizationUrl' | 'exchangeCodeForTokens' | 'listOrganizations';
  args: unknown[];
}

export class FakeOAuthClient implements OAuthClient {
  private authUrl = 'https://accounts.zoho.eu/oauth/v2/auth?fake=true';
  private tokenResult: OAuthTokenResult = {
    accessToken: 'fake-access-token',
    refreshToken: 'fake-refresh-token',
    apiDomain: 'https://www.zohoapis.eu',
    region: 'eu',
  };
  private organizations: ZohoBooksOrganization[] = [];
  private pendingError: { method?: string; error: Error } | undefined;
  private recordedCalls: OAuthClientCall[] = [];

  get calls(): readonly OAuthClientCall[] {
    return this.recordedCalls;
  }

  setAuthUrl(url: string): this {
    this.authUrl = url;
    return this;
  }

  setTokenResult(result: OAuthTokenResult): this {
    this.tokenResult = result;
    return this;
  }

  seedOrganizations(orgs: ZohoBooksOrganization[]): this {
    this.organizations = orgs;
    return this;
  }

  failNext(error: Error, method?: string): this {
    this.pendingError = { error, method };
    return this;
  }

  reset(): void {
    this.authUrl = 'https://accounts.zoho.eu/oauth/v2/auth?fake=true';
    this.tokenResult = {
      accessToken: 'fake-access-token',
      refreshToken: 'fake-refresh-token',
      apiDomain: 'https://www.zohoapis.eu',
      region: 'eu',
    };
    this.organizations = [];
    this.pendingError = undefined;
    this.recordedCalls = [];
  }

  getAuthorizationUrl(state: string, region?: ZohoBooksRegion): string {
    this.recordedCalls.push({ method: 'getAuthorizationUrl', args: [state, region] });
    this.throwIfPending('getAuthorizationUrl');
    return this.authUrl;
  }

  async exchangeCodeForTokens(code: string, region?: ZohoBooksRegion): Promise<OAuthTokenResult> {
    this.recordedCalls.push({ method: 'exchangeCodeForTokens', args: [code, region] });
    this.throwIfPending('exchangeCodeForTokens');
    return this.tokenResult;
  }

  async listOrganizations(accessToken: string, apiDomain: string): Promise<ZohoBooksOrganization[]> {
    this.recordedCalls.push({ method: 'listOrganizations', args: [accessToken, apiDomain] });
    this.throwIfPending('listOrganizations');
    return this.organizations;
  }

  private throwIfPending(currentMethod: string): void {
    if (this.pendingError && (!this.pendingError.method || this.pendingError.method === currentMethod)) {
      const error = this.pendingError.error;
      this.pendingError = undefined;
      throw error;
    }
  }
}
