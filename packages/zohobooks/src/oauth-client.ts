import type { OAuthClient, OAuthTokenResult } from './interfaces.js';
import { consoleLogger, type ZohoBooksLogger } from './logger.js';
import type { ZohoBooksOrganization, ZohoBooksRegion } from './types.js';

function accountsDomain(region: ZohoBooksRegion): string {
  return `accounts.zoho.${region}`;
}

function deriveRegion(apiDomain: string): ZohoBooksRegion {
  const match = /zohoapis\.(.+)$/.exec(apiDomain);
  return (match?.[1] ?? 'eu') as ZohoBooksRegion;
}

export interface ZohoBooksOAuthClientOptions {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  scopes: string;
  logger?: ZohoBooksLogger;
}

export class ZohoBooksOAuthClient implements OAuthClient {
  private readonly logger: ZohoBooksLogger;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly callbackUrl: string;
  private readonly scopes: string;

  constructor(options: ZohoBooksOAuthClientOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.callbackUrl = options.callbackUrl;
    this.scopes = options.scopes;
    this.logger = options.logger ?? consoleLogger;
  }

  getAuthorizationUrl(state: string, region: ZohoBooksRegion = 'eu'): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.callbackUrl,
      scope: this.scopes,
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://${accountsDomain(region)}/oauth/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    region: ZohoBooksRegion = 'eu',
  ): Promise<OAuthTokenResult> {
    const url = `https://${accountsDomain(region)}/oauth/v2/token`;

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.callbackUrl,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error('ZohoBooks OAuth token exchange failed', error);
      throw new Error(`ZohoBooks OAuth: token exchange failed. ${error}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      api_domain: string;
      token_type: string;
      expires_in: number;
    };

    if (!data.access_token) {
      throw new Error('ZohoBooks OAuth: missing access_token from exchange.');
    }

    if (!data.refresh_token) {
      throw new Error(
        'ZohoBooks OAuth: missing refresh_token from exchange. Ensure access_type=offline and prompt=consent.',
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      apiDomain: data.api_domain,
      region: deriveRegion(data.api_domain),
    };
  }

  async listOrganizations(
    accessToken: string,
    apiDomain: string,
  ): Promise<ZohoBooksOrganization[]> {
    const url = `${apiDomain}/books/v3/organizations`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(
        `ZohoBooks list organizations failed: status=${response.status} url=${url} body=${error}`,
      );
      throw new Error(`ZohoBooks OAuth: list organizations failed. ${error}`);
    }

    const data = (await response.json()) as {
      organizations: ZohoBooksOrganization[];
    };

    return data.organizations;
  }
}
