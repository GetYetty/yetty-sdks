import { describe, it, expect } from 'vitest';
import {
  buildOrganization,
  buildTokenResponse,
  buildInvoice,
  buildContact,
  buildCreditNote,
} from '../../src/testing/builders.js';

describe('builders', () => {
  describe('buildOrganization()', () => {
    it('returns a valid organization with defaults', () => {
      const org = buildOrganization();
      expect(org.organization_id).toBe('org-001');
      expect(org.name).toBe('ACME Corp');
      expect(org.currency_code).toBe('EUR');
    });

    it('accepts overrides', () => {
      const org = buildOrganization({ name: 'Custom Corp', currency_code: 'USD' });
      expect(org.name).toBe('Custom Corp');
      expect(org.currency_code).toBe('USD');
      expect(org.organization_id).toBe('org-001');
    });
  });

  describe('buildTokenResponse()', () => {
    it('returns a valid token response with defaults', () => {
      const token = buildTokenResponse();
      expect(token.access_token).toBe('access-token-123');
      expect(token.expires_in).toBe(3600);
    });

    it('accepts overrides', () => {
      const token = buildTokenResponse({ refresh_token: 'rt-new' });
      expect(token.refresh_token).toBe('rt-new');
    });
  });

  describe('buildInvoice()', () => {
    it('returns a valid invoice with defaults', () => {
      const inv = buildInvoice();
      expect(inv.invoice_id).toBe('inv-001');
      expect(inv.status).toBe('sent');
      expect(inv.currency_code).toBe('EUR');
    });

    it('accepts overrides', () => {
      const inv = buildInvoice({ status: 'paid', total: 5000 });
      expect(inv.status).toBe('paid');
      expect(inv.total).toBe(5000);
    });
  });

  describe('buildContact()', () => {
    it('returns a valid contact with defaults', () => {
      const c = buildContact();
      expect(c.contact_id).toBe('contact-001');
      expect(c.customer_sub_type).toBe('business');
    });

    it('accepts overrides', () => {
      const c = buildContact({ customer_sub_type: 'individual' });
      expect(c.customer_sub_type).toBe('individual');
    });
  });

  describe('buildCreditNote()', () => {
    it('returns a valid credit note with defaults', () => {
      const cn = buildCreditNote();
      expect(cn.creditnote_id).toBe('cn-001');
      expect(cn.status).toBe('open');
    });

    it('accepts overrides', () => {
      const cn = buildCreditNote({ status: 'closed' });
      expect(cn.status).toBe('closed');
    });
  });
});
