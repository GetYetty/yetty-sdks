import { DateTime } from 'luxon';
import pRetry from 'p-retry';

import { AuthenticationError, RateLimitedError, ServerError } from './errors.js';
import { type RubyPayeurLogger, consoleLogger } from './logger.js';

const BASE_URL = 'https://rubypayeur.com';

interface AuthResponse {
  auth_token: string;
}

export interface RubyPayeurHttpClientOptions {
  apiToken: string;
  authPath: string;
  apiLabel: string;
  logger?: RubyPayeurLogger;
}

class ReauthNeededError extends Error {
  constructor() {
    super('Re-authentication needed');
  }
}

export class RubyPayeurHttpClient {
  readonly baseUrl = BASE_URL;

  private authToken: string | null = null;
  private authPromise: Promise<string> | null = null;
  private readonly logger: RubyPayeurLogger;
  private readonly options: RubyPayeurHttpClientOptions;

  constructor(options: RubyPayeurHttpClientOptions) {
    this.options = options;
    this.logger = options.logger ?? consoleLogger;
  }

  async requestWithAuth<T>(fn: (authToken: string) => Promise<T>): Promise<T> {
    const token = await this.ensureAuthenticated();

    try {
      return await this.withRetry(() => fn(token));
    } catch (error) {
      if (error instanceof ReauthNeededError) {
        this.authToken = null;
        const freshToken = await this.ensureAuthenticated();
        try {
          return await this.withRetry(() => fn(freshToken));
        } catch (retryError) {
          if (retryError instanceof ReauthNeededError) {
            throw new AuthenticationError();
          }
          throw retryError;
        }
      }
      throw error;
    }
  }

  async ensureAuthenticated(): Promise<string> {
    if (this.authToken) {
      return this.authToken;
    }

    if (!this.authPromise) {
      this.authPromise = this.authenticate().finally(() => {
        this.authPromise = null;
      });
    }

    return this.authPromise;
  }

  throwOnErrorStatus(response: Response): void {
    if (response.ok) {
      return;
    }

    if (response.status === 401) {
      throw new ReauthNeededError();
    }

    this.throwIfRateLimitedOrServer(response);

    throw new Error(`Unexpected ${this.options.apiLabel} error (HTTP ${response.status})`);
  }

  private async authenticate(): Promise<string> {
    return this.withRetry(async () => {
      const response = await fetch(new URL(this.options.authPath, BASE_URL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: this.options.apiToken }),
      });

      if (!response.ok) {
        this.throwOnAuthErrorStatus(response);
      }

      let body: Partial<AuthResponse>;
      try {
        body = (await response.json()) as Partial<AuthResponse>;
      } catch {
        this.logger.error('Authentication response was not valid JSON');
        throw new AuthenticationError();
      }

      if (!body.auth_token) {
        this.logger.error('Authentication succeeded but response had no token');
        throw new AuthenticationError();
      }

      this.authToken = body.auth_token;
      return this.authToken;
    });
  }

  private throwOnAuthErrorStatus(response: Response): never {
    this.throwIfRateLimitedOrServer(response);

    this.logger.error(`Authentication failed with HTTP ${response.status}`);
    throw new AuthenticationError();
  }

  private throwIfRateLimitedOrServer(response: Response): void {
    const status = response.status;

    if (status === 429) {
      throw new RateLimitedError(this.parseRetryAfter(response.headers));
    }

    if (status >= 500) {
      throw new ServerError(status);
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    return pRetry(fn, {
      retries: 3,
      minTimeout: 1_000,
      maxTimeout: 30_000,
      shouldRetry: (error) => error instanceof ServerError || error instanceof TypeError,
      onFailedAttempt: (error) => {
        this.logger.warn(
          `Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left. Error: ${error.message}`,
        );
      },
    });
  }

  private parseRetryAfter(headers: Headers): number | undefined {
    const header = headers.get('retry-after');
    if (!header) {
      return undefined;
    }

    const seconds = Number(header);
    if (Number.isInteger(seconds) && seconds >= 0) {
      return seconds;
    }

    const httpDate = DateTime.fromHTTP(header);
    const parsedDate = httpDate.isValid ? httpDate : DateTime.fromISO(header);
    if (parsedDate.isValid) {
      const delaySeconds = parsedDate.diffNow('seconds').seconds;
      return delaySeconds > 0 ? Math.ceil(delaySeconds) : undefined;
    }

    return undefined;
  }
}
