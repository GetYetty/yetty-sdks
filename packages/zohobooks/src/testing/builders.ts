import type {
  ZohoBooksContact,
  ZohoBooksCreditNote,
  ZohoBooksInvoice,
  ZohoBooksOrganization,
  ZohoBooksTokenResponse,
} from '../types.js';

export function buildOrganization(overrides?: Partial<ZohoBooksOrganization>): ZohoBooksOrganization {
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

export function buildTokenResponse(overrides?: Partial<ZohoBooksTokenResponse>): ZohoBooksTokenResponse {
  return {
    access_token: 'access-token-123',
    token_type: 'Bearer',
    expires_in: 3600,
    api_domain: 'https://www.zohoapis.eu',
    ...overrides,
  };
}

export function buildInvoice(overrides?: Partial<ZohoBooksInvoice>): ZohoBooksInvoice {
  return {
    invoice_id: 'inv-001',
    invoice_number: 'FA-2024-001',
    status: 'sent',
    date: '2024-01-15',
    due_date: '2024-02-15',
    total: 1200,
    sub_total: 1000,
    tax_total: 200,
    balance: 1200,
    currency_code: 'EUR',
    exchange_rate: 1,
    reference_number: 'REF-001',
    customer_id: 'cust-001',
    last_modified_time: '2024-01-15T10:00:00+0000',
    ...overrides,
  };
}

export function buildContact(overrides?: Partial<ZohoBooksContact>): ZohoBooksContact {
  return {
    contact_id: 'contact-001',
    contact_name: 'Jean Dupont',
    company_name: 'ACME Corp',
    company_id: '123456789',
    customer_sub_type: 'business',
    billing_address: {
      address: '12 rue de la Paix',
      city: 'Paris',
      state: 'Ile-de-France',
      zip: '75002',
      country: 'France',
    },
    shipping_address: {
      address: '12 rue de la Paix',
      city: 'Paris',
      state: 'Ile-de-France',
      zip: '75002',
      country: 'France',
    },
    last_modified_time: '2024-01-15T10:00:00+0000',
    ...overrides,
  };
}

export function buildCreditNote(overrides?: Partial<ZohoBooksCreditNote>): ZohoBooksCreditNote {
  return {
    creditnote_id: 'cn-001',
    creditnote_number: 'AV-2024-001',
    status: 'open',
    date: '2024-02-01',
    total: 300,
    sub_total: 250,
    tax_total: 50,
    balance: 300,
    currency_code: 'EUR',
    exchange_rate: 1,
    reference_number: 'REF-CN-001',
    customer_id: 'cust-001',
    last_modified_time: '2024-02-01T10:00:00+0000',
    ...overrides,
  };
}
