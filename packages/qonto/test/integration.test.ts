import { describe, it, expect, beforeAll } from 'vitest';
import {
  type Client,
  createClient,
  getV2Organization,
  cancelSepaTransfer,
  listSepaTransfers,
  updateBusinessAccount,
  deleteV2TransactionsByIdAttachments,
  postV2TransactionsByIdAttachments,
  getV2Memberships,
  postV2InternalTransfers,
  indexSepaBeneficiaries,
  showSepaBeneficiary,
} from '../src/index.js';

describe('Qonto API Integration (Mocked)', () => {
  let client: Client;

  beforeAll(() => {
    client = createClient({
      baseUrl: 'http://127.0.0.1:4010',
      headers: {
        Authorization: 'Bearer mock-token',
      },
    });
  });

  it('should fetch organization successfully from mock server', async () => {
    const { data, error, response } = await getV2Organization({
      client,
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });

  it('should list beneficiaries successfully', async () => {
    const { data, error, response } = await indexSepaBeneficiaries({
      client,
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });

  it('should get a specific beneficiary successfully', async () => {
    const { data, error, response } = await showSepaBeneficiary({
      client,
      path: {
        id: 'aa8bb989-6b70-4981-8cf1-a1622236e6d1',
      },
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });

  it('should cancel a SEPA transfer successfully', async () => {
    const { data, error, response } = await cancelSepaTransfer({
      client,
      path: {
        id: 'aa8bb989-6b70-4981-8cf1-a1622236e6d1',
      },
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(204);
    expect(data).toBeDefined();
  });

  it('should list SEPA transfers successfully', async () => {
    const { data, error, response } = await listSepaTransfers({
      client,
      query: {
        per_page: 20,
      },
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });

  it('should update a business account successfully', async () => {
    const { data, error, response } = await updateBusinessAccount({
      client,
      path: {
        id: 'account-123',
      },
      body: {
        bank_account: {
          name: 'Updated Account Name',
        },
      },
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });

  it('should delete transaction attachments successfully', async () => {
    const { error, response } = await deleteV2TransactionsByIdAttachments({
      client,
      path: {
        id: 'aa8bb989-6b70-4981-8cf1-a1622236e6d1',
      },
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(200);
  });

  it('should add attachment to transaction successfully', async () => {
    const { data, error, response } = await postV2TransactionsByIdAttachments({
      client,
      path: {
        id: '909670c9-039a-45dc-b823-4cff43d2d884',
      },
      body: {
        file: {} as Blob,
      },
      headers: {
        'X-Qonto-Idempotency-Key': 'asd',
      },
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });

  it('should list memberships successfully', async () => {
    const { data, error, response } = await getV2Memberships({
      client,
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });

  it('should create an internal transfer successfully', async () => {
    const { data, error, response } = await postV2InternalTransfers({
      client,
      body: {
        internal_transfer: {
          currency: 'EUR',
          amount: '250.0',
          reference: 'aa8bb989-6b70-4981-8cf1-a1622236e6d1',
          credit_iban: 'aa8bb989-6b70-4981-8cf1-a1622236e6d1',
          debit_iban: 'aa8bb989-6b70-4981-8cf1-a1622236e6d1',
        },
      },
      headers: {
        'X-Qonto-Idempotency-Key': 'asd',
      },
    });

    expect(error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
  });
});
