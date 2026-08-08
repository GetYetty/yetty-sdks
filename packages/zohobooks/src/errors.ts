export class ZohoBooksError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AuthenticationError extends ZohoBooksError {
  constructor(message = 'ZohoBooks authentication failed. Invalid or expired credentials.') {
    super(message);
  }
}

export class RateLimitedError extends ZohoBooksError {
  constructor(readonly retryAfterSeconds?: number) {
    super(
      retryAfterSeconds !== undefined
        ? `Rate limited. Retry after ${retryAfterSeconds} seconds.`
        : 'Rate limited.',
    );
  }
}

export class ServerError extends ZohoBooksError {
  constructor(readonly statusCode: number) {
    super(`Server error (HTTP ${statusCode}).`);
  }
}
