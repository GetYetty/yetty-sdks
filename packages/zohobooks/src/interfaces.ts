import type { ZohoBooksOrganization, ZohoBooksRegion } from './types.js';

export interface TokenManager {
  getAccessToken(): Promise<string>;
  invalidateAccessToken(): void;
}

export interface ApiClient {
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  getBuffer(path: string, params?: Record<string, string>): Promise<Buffer>;
  getOrganizationId(): string;
}

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken: string;
  apiDomain: string;
  region: ZohoBooksRegion;
}

export interface OAuthClient {
  getAuthorizationUrl(state: string, region?: ZohoBooksRegion): string;
  exchangeCodeForTokens(code: string, region?: ZohoBooksRegion): Promise<OAuthTokenResult>;
  listOrganizations(accessToken: string, apiDomain: string): Promise<ZohoBooksOrganization[]>;
}
