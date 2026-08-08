// Generated API client
export * from './generated/client.gen.js';
export * from './generated/schemas.gen.js';
export * from './generated/sdk.gen.js';
export * from './generated/types.gen.js';

export {
  createConfig,
  createClient,
  buildClientParams,
  mergeHeaders,
} from './generated/client/index.js';
export type {
  ClientOptions,
  Config,
  CreateClientConfig,
  Client,
  RequestOptions,
  RequestResult,
  ResolvedRequestOptions,
  ResponseStyle,
  TDataShape,
} from './generated/client/index.js';

// Hand-written: errors
export { AuthenticationError, RateLimitedError, ServerError, ZohoBooksError } from './errors.js';

// Hand-written: logger
export { consoleLogger, type ZohoBooksLogger } from './logger.js';

// Hand-written: OAuth client
export {
  ZohoBooksOAuthClient,
  type ZohoBooksOAuthClientOptions,
  type OAuthClient,
  type OAuthTokenResult,
  type ZohoBooksRegion,
  type ZohoBooksOrganization,
} from './oauth-client.js';

// Hand-written: token manager
export {
  ZohoBooksTokenManager,
  type ZohoBooksTokenManagerOptions,
  type TokenManager,
} from './token-manager.js';
