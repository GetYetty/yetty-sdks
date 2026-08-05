import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, createConfig } from '../src/index';
import {
  getCompanies,
  getInvoices,
  getContacts,
  createComment,
  searchInvoices,
} from '../src/index';

describe('Sellsy SDK Integration Tests', () => {
  let client: ReturnType<typeof createClient>;

  beforeAll(() => {
    client = createClient(
      createConfig({
        baseUrl: process.env.SELLSY_BASE_URL || 'http://127.0.0.1:4010',
        headers: {
          Authorization: 'Bearer mock-token',
        },
      }),
    );
  });

  describe('Companies API', () => {
    it('should fetch company list', async () => {
      const response = await getCompanies({ client });
      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
    });
  });

  describe('Contacts API', () => {
    it('should fetch contact list', async () => {
      const response = await getContacts({ client });
      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
    });
  });

  describe('Invoices API', () => {
    it('should fetch invoice list', async () => {
      const response = await getInvoices({ client });
      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
    });

    it('should search invoices', async () => {
      const response = await searchInvoices({
        client,
        body: { filters: [] },
      });
      expect(response).toBeDefined();
    });
  });

  describe('Comments API', () => {
    it('should create a comment', async () => {
      const response = await createComment({
        client,
        body: {
          subject: 'Test comment',
          message: 'Test message',
        },
      });
      expect(response).toBeDefined();
    });
  });
});
