import { Client, createClient, createConfig } from './generated/client/index.js';

// Exporting all generated modules from a single entry point
export * from './generated/client.gen.js';
export * from './generated/schemas.gen.js';
export * from './generated/sdk.gen.js';
export * from './generated/types.gen.js';

// Exporting the client for easy access
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

// Helper function to create a client with an API key
export function createClientWithApiKey(apiKey: string): Client {
  return createClient(
    createConfig({
      baseUrl: 'https://api.sellsy.com/',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }),
  );
}
