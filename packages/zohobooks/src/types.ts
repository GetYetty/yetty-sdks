export type ZohoBooksRegion =
  | 'eu'
  | 'com'
  | 'in'
  | 'com.au'
  | 'jp'
  | 'ca'
  | 'sa'
  | 'uk';

export interface ZohoBooksPageContext {
  page: number;
  per_page: number;
  has_more_page: boolean;
}

export interface ZohoBooksListResponse {
  code: number;
  message: string;
  page_context: ZohoBooksPageContext;
  [key: string]: unknown;
}

export interface ZohoBooksOrganization {
  organization_id: string;
  name: string;
  is_default_org: boolean;
  country_code: string;
  currency_code: string;
  fiscal_year_start_month: number;
  time_zone: string;
}

export interface ZohoBooksTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  api_domain: string;
}

export type ZohoBooksInvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'overdue'
  | 'paid'
  | 'partially_paid'
  | 'unpaid'
  | 'void';

export interface ZohoBooksInvoice {
  invoice_id: string;
  invoice_number: string;
  status: ZohoBooksInvoiceStatus;
  date: string;
  due_date: string;
  total?: number;
  sub_total?: number;
  tax_total?: number;
  balance?: number;
  currency_code: string;
  exchange_rate: number;
  reference_number: string;
  customer_id: string;
  last_modified_time: string;
  last_payment_date?: string;
}

export type ZohoBooksCreditNoteStatus = 'draft' | 'open' | 'closed' | 'void';

export interface ZohoBooksCreditNoteInvoice {
  invoice_id: string;
  credited_amount: number;
}

export interface ZohoBooksCreditNote {
  creditnote_id: string;
  creditnote_number: string;
  status: ZohoBooksCreditNoteStatus;
  date: string;
  total?: number;
  sub_total?: number;
  tax_total?: number;
  balance?: number;
  currency_code: string;
  exchange_rate: number;
  reference_number: string;
  customer_id: string;
  last_modified_time: string;
  invoices_credited?: ZohoBooksCreditNoteInvoice[];
}

export interface ZohoBooksAddress {
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface ZohoBooksContactPerson {
  contact_person_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  is_primary_contact: boolean;
}

export interface ZohoBooksContact {
  contact_id: string;
  contact_name: string;
  company_name: string;
  company_id?: string;
  customer_sub_type: 'business' | 'individual';
  contact_persons?: ZohoBooksContactPerson[];
  billing_address: ZohoBooksAddress;
  shipping_address: ZohoBooksAddress;
  last_modified_time: string;
}
