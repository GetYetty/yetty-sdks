import { describe, it, expect, beforeAll } from 'vitest';
import {
  getCustomers,
  getCustomer,
  postCompanyCustomer,
  getMe,
  getCustomerInvoices,
  getJournals,
  deleteCustomerInvoices,
  type Client,
  createClient,
} from '../src/index.js';

describe('Pennylane API Integration (Mocked)', () => {
  let client: Client;

  beforeAll(() => {
    client = createClient({
      baseUrl: 'http://127.0.0.1:4010',
      headers: {
        Authorization: 'Bearer mock-token',
      },
    });
  });

  it('should fetch customers successfully from mock server', async () => {
    const { data, error, response } = await getCustomers({
      client,
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });

  it('should fetch a single customer successfully', async () => {
    const { data, error, response } = await getCustomer({
      client,
      path: {
        id: 123,
      },
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });

  it('should create a company customer successfully', async () => {
    const { data, error, response } = await postCompanyCustomer({
      client,
      body: {
        name: 'Test Company',
        billing_address: {
          address: '123 Main St',
          city: 'Paris',
          postal_code: '75001',
          country_alpha2: 'FR',
        },
      },
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(201);
    expect(data).toBeDefined();
  });

  it('should fetch current user profile (getMe) successfully', async () => {
    const { data, error, response } = await getMe({
      client,
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });

  it('should fetch customer invoices successfully', async () => {
    const { data, error, response } = await getCustomerInvoices({
      client,
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });

  it('should fetch journals successfully', async () => {
    const { data, error, response } = await getJournals({ client });

    expect(error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });

  it('should delete a draft customer invoice successfully', async () => {
    const { error, response } = await deleteCustomerInvoices({
      client,
      path: {
        id: 1234,
      },
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(204);
  });
});
