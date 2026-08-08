import type { ZohoBooksOrganization } from '../oauth-client.js';

interface ZohoBooksTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  api_domain: string;
}

export function buildOrganization(
  overrides?: Partial<ZohoBooksOrganization>,
): ZohoBooksOrganization {
  return {
    organization_id: 'org-001',
    name: 'ACME Corp',
    is_default_org: true,
    country_code: 'FR',
    currency_code: 'EUR',
    fiscal_year_start_month: 1,
    time_zone: 'Europe/Paris',
    ...overrides,
  };
}

export function buildTokenResponse(
  overrides?: Partial<ZohoBooksTokenResponse>,
): ZohoBooksTokenResponse {
  return {
    access_token: 'access-token-123',
    token_type: 'Bearer',
    expires_in: 3600,
    api_domain: 'https://www.zohoapis.eu',
    ...overrides,
  };
}
