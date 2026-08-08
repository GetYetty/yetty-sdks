import Bottleneck from 'bottleneck';
import pRetry from 'p-retry';
import { AuthenticationError, RateLimitedError, ServerError } from './errors.js';
import type { ApiClient, TokenManager } from './interfaces.js';
import { consoleLogger, type ZohoBooksLogger } from './logger.js';
import type { ZohoBooksRegion } from './types.js';

function apiDomain(region: ZohoBooksRegion): string {
  return `www.zohoapis.${region}`;
}

function parseRetryAfter(headers: Headers): number | undefined {
  const raw = headers.get('Retry-After');
  if (!raw) {
    return undefined;
  }

  const seconds = Number(raw);
  if (!Number.isNaN(seconds)) {
    return seconds;
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
  }

  return undefined;
}

export interface ZohoBooksApiClientOptions {
  tokenManager: TokenManager;
  organizationId: string;
  region: ZohoBooksRegion;
  logger?: ZohoBooksLogger;
}

export class ZohoBooksApiClient implements ApiClient {
  private readonly logger: ZohoBooksLogger;
  private readonly baseUrl: string;
  private readonly tokenManager: TokenManager;
  private readonly organizationId: string;
  private readonly limiter = new Bottleneck({
    minTime: 200,
    maxConcurrent: 1,
  });

  constructor(options: ZohoBooksApiClientOptions) {
    this.tokenManager = options.tokenManager;
    this.organizationId = options.organizationId;
    this.logger = options.logger ?? consoleLogger;
    this.baseUrl = `https://${apiDomain(options.region)}/books/v3`;
  }

  getOrganizationId(): string {
    return this.organizationId;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const response = await this.authenticatedFetch(path, params);
    return (await response.json()) as T;
  }

  async getBuffer(
    path: string,
    params?: Record<string, string>,
  ): Promise<Buffer> {
    const response = await this.authenticatedFetch(path, {
      ...params,
      accept: 'pdf',
    });
    return Buffer.from(await response.arrayBuffer());
  }

  private async authenticatedFetch(
    path: string,
    params?: Record<string, string>,
  ): Promise<globalThis.Response> {
    try {
      return await this.doFetch(path, params);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        this.logger.warn(`Got 401 on ${path}, retrying once with fresh token`);
        return await this.doFetch(path, params);
      }
      throw error;
    }
  }

  private logRateLimitHeaders(headers: Headers, path: string): void {
    const limit = headers.get('X-Rate-Limit-Limit');
    const remaining = headers.get('X-Rate-Limit-Remaining');

    if (!limit || !remaining) {
      return;
    }

    const limitNum = Number(limit);
    const remainingNum = Number(remaining);

    if (Number.isNaN(limitNum) || Number.isNaN(remainingNum) || limitNum <= 0) {
      return;
    }

    const usagePercent = ((limitNum - remainingNum) / limitNum) * 100;

    if (remainingNum <= limitNum * 0.2) {
      this.logger.warn(
        `Zoho rate-limit quota running low [${path}] ${remainingNum}/${limitNum} remaining (${Math.round(usagePercent)}% used)`,
      );
    } else {
      this.logger.debug(
        `Zoho rate-limit status [${path}] ${remainingNum}/${limitNum} remaining`,
      );
    }
  }

  private async doFetch(
    path: string,
    params?: Record<string, string>,
  ): Promise<globalThis.Response> {
    return pRetry(
      async () => {
        const accessToken = await this.tokenManager.getAccessToken();

        const url = new URL(`${this.baseUrl}${path}`);
        url.searchParams.set('organization_id', this.organizationId);
        if (params) {
          for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
          }
        }

        const response = await this.limiter.schedule(() =>
          fetch(url.toString(), {
            method: 'GET',
            headers: {
              Authorization: `Zoho-oauthtoken ${accessToken}`,
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(30_000),
          }),
        );

        this.logRateLimitHeaders(response.headers, path);

        if (response.status === 401) {
          this.tokenManager.invalidateAccessToken();
          throw new AuthenticationError();
        }

        if (response.status === 429) {
          throw new RateLimitedError(parseRetryAfter(response.headers));
        }

        if (response.status >= 500) {
          throw new ServerError(response.status);
        }

        if (!response.ok) {
          const text = await response.text().catch(() => 'unknown');
          this.logger.error(`ZohoBooks API error: ${response.status} - ${text}`);
          throw new Error(`ZohoBooks API error: ${response.status}`);
        }

        return response;
      },
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 30000,
        shouldRetry: (error) =>
          !(error instanceof AuthenticationError) &&
          !(error instanceof ServerError) &&
          !(error instanceof RateLimitedError),
        onFailedAttempt: (error) => {
          this.logger.warn(
            `ZohoBooks API call failed (attempt ${error.attemptNumber}/${error.attemptNumber + error.retriesLeft}): ${error.message}`,
          );
        },
      },
    );
  }
}
