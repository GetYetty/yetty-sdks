import { AuthenticationError } from './errors.js';
import { consoleLogger, type ZohoBooksLogger } from './logger.js';
import type { ZohoBooksRegion } from './oauth-client.js';

const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

function accountsDomain(region: ZohoBooksRegion): string {
  return `accounts.zoho.${region}`;
}

export interface TokenManager {
  getAccessToken(): Promise<string>;
  invalidateAccessToken(): void;
}

export interface ZohoBooksTokenManagerOptions {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  region: ZohoBooksRegion;
  onTokenRefreshed?: (newRefreshToken: string) => Promise<void>;
  logger?: ZohoBooksLogger;
}

interface ZohoBooksTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  api_domain: string;
}

export class ZohoBooksTokenManager implements TokenManager {
  private readonly logger: ZohoBooksLogger;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private refreshToken: string;
  private readonly region: ZohoBooksRegion;
  private readonly onTokenRefreshed?: (newRefreshToken: string) => Promise<void>;

  private cachedAccessToken: string | null = null;
  private tokenExpiresAt = 0;
  private refreshPromise: Promise<string> | null = null;

  constructor(options: ZohoBooksTokenManagerOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.refreshToken = options.refreshToken;
    this.region = options.region;
    this.onTokenRefreshed = options.onTokenRefreshed;
    this.logger = options.logger ?? consoleLogger;
  }

  async getAccessToken(): Promise<string> {
    if (this.cachedAccessToken && this.tokenExpiresAt - EXPIRY_BUFFER_MS > Date.now()) {
      return this.cachedAccessToken;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.mintAccessToken().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  invalidateAccessToken(): void {
    this.cachedAccessToken = null;
    this.tokenExpiresAt = 0;
  }

  private async mintAccessToken(): Promise<string> {
    const url = `https://${accountsDomain(this.region)}/oauth/v2/token`;
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unreadable');
      if (errorBody.includes('invalid_grant')) {
        this.logger.warn(
          `ZohoBooks refresh token expired or revoked (HTTP ${response.status}): ${errorBody}`,
        );
      } else {
        this.logger.error(`Token refresh failed (HTTP ${response.status}): ${errorBody}`);
      }
      throw new AuthenticationError();
    }

    const body = (await response.json()) as ZohoBooksTokenResponse;

    if (!body.access_token) {
      this.logger.error('Token refresh response missing access_token');
      throw new AuthenticationError();
    }

    this.cachedAccessToken = body.access_token;
    this.tokenExpiresAt = Date.now() + body.expires_in * 1000;

    if (body.refresh_token && body.refresh_token !== this.refreshToken) {
      this.refreshToken = body.refresh_token;
      try {
        await this.onTokenRefreshed?.(body.refresh_token);
      } catch (error) {
        this.logger.error('Failed to persist rotated refresh token', error);
      }
    }

    this.logger.debug('Access token refreshed successfully');

    return body.access_token;
  }
}
