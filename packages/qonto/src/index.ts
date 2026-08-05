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

// Qonto API base URLs
export const QONTO_BASE_URL = 'https://thirdparty.qonto.com';
export const QONTO_SANDBOX_BASE_URL = 'https://thirdparty-sandbox.qonto.com';

// Helper function to create a client with Qonto credentials (slug:secret_key format)
export function createClientWithCredentials(organizationSlug: string, secretKey: string): Client {
  return createClient(
    createConfig({
      baseUrl: QONTO_BASE_URL,
      headers: {
        Authorization: `${organizationSlug}:${secretKey}`,
      },
    }),
  );
}

// Helper function to create a sandbox client with Qonto credentials
export function createSandboxClientWithCredentials(
  organizationSlug: string,
  secretKey: string,
): Client {
  return createClient(
    createConfig({
      baseUrl: QONTO_SANDBOX_BASE_URL,
      headers: {
        Authorization: `${organizationSlug}:${secretKey}`,
      },
    }),
  );
}
