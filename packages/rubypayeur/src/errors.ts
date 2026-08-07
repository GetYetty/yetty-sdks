export class RubyPayeurError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AuthenticationError extends RubyPayeurError {
  constructor(message = 'RubyPayeur authentication failed. Invalid or expired API token.') {
    super(message);
  }
}

export class NotFoundError extends RubyPayeurError {
  constructor(readonly resource: string) {
    super(`Resource not found: ${resource}`);
  }
}

export class RateLimitedError extends RubyPayeurError {
  constructor(readonly retryAfterSeconds?: number) {
    super(
      retryAfterSeconds !== undefined
        ? `Rate limited. Retry after ${retryAfterSeconds} seconds.`
        : 'Rate limited.',
    );
  }
}

export class ServerError extends RubyPayeurError {
  constructor(readonly statusCode: number) {
    super(`Server error (HTTP ${statusCode}).`);
  }
}

export class ValidationError extends RubyPayeurError {
  constructor(readonly fieldErrors: Record<string, string[]>) {
    super(
      `Validation failed: ${Object.entries(fieldErrors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ')}`,
    );
  }
}
