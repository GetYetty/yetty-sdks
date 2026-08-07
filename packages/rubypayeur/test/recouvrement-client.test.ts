import { describe, it, expect, vi, beforeEach } from 'vitest';

import { RubyPayeurRecouvrementClient } from '../src/recouvrement-client.js';
import {
  NotFoundError,
  RateLimitedError,
  ResponseShapeError,
  ServerError,
  ValidationError,
} from '../src/errors.js';
import type { CreateDebtInput } from '../src/types.js';

interface RubyPayeurDebtResponseForTest {
  reference: string;
  Statut: string;
  montant_recouvre: number;
  'Reste dû à date': string;
  procedure_collective: 'OUI' | 'NON';
  en_activite: 'OUI' | 'NON';
  'Date de clôture': string | null;
  section: string;
}

vi.mock('p-retry', () => {
  return {
    default: async <T>(
      fn: () => Promise<T>,
      options?: {
        retries?: number;
        shouldRetry?: (error: Error & { attemptNumber: number; retriesLeft: number }) => boolean;
        onFailedAttempt?: (error: Error & { attemptNumber: number; retriesLeft: number }) => void;
      },
    ): Promise<T> => {
      const maxRetries = options?.retries ?? 3;

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          return await fn();
        } catch (error) {
          const decorated = error as Error & { attemptNumber: number; retriesLeft: number };
          decorated.attemptNumber = attempt;
          decorated.retriesLeft = maxRetries - attempt;

          if (options?.shouldRetry && !options.shouldRetry(decorated)) {
            throw error;
          }
          if (attempt <= maxRetries && options?.onFailedAttempt) {
            options.onFailedAttempt(decorated);
          }
          if (attempt > maxRetries) {
            throw error;
          }
        }
      }

      throw new Error('unreachable');
    },
  };
});

function mockFetchResponse(status: number, body: unknown, headers?: Record<string, string>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
  } as Response;
}

const VALID_AUTH_RESPONSE = { auth_token: 'test-auth-token', customer: 'ACME' };

const ORG_TOKEN = 'org-recouvrement-token';

const silentLogger = {
  log: () => {},
  warn: () => {},
  error: () => {},
};

function createTestCreateDebtInput(overrides?: Partial<CreateDebtInput>): CreateDebtInput {
  return {
    debtor: {
      name: 'Acme Corp',
      registrationNumber: '987654321',
      gender: 'male',
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean@acme.fr',
      phone: '0612345678',
      address: '12 rue de la Paix, 75002 Paris',
    },
    invoices: [
      {
        reference: 'FA-2024-042',
        amountDueCents: 55045,
        issuedOn: '2024-10-01',
        dueOn: '2024-10-31',
      },
    ],
    lateFee: true,
    comment: 'Client injoignable',
    ...overrides,
  };
}

describe('RubyPayeurRecouvrementClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  describe('validateCredentials', () => {
    it('authenticates against /api/debt_auth with the org token and returns true', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE));

      const client = new RubyPayeurRecouvrementClient({
        apiToken: ORG_TOKEN,
        isProduction: true,
        logger: silentLogger,
      });
      await expect(client.validateCredentials()).resolves.toBe(true);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [authUrl, authInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
      expect(authUrl.pathname).toBe('/api/debt_auth');
      expect(authInit.method).toBe('POST');
      expect(JSON.parse(authInit.body as string)).toEqual({ token: ORG_TOKEN });
    });

    it('returns false when the token is rejected', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(401, {}));

      const client = new RubyPayeurRecouvrementClient({
        apiToken: ORG_TOKEN,
        isProduction: true,
        logger: silentLogger,
      });
      await expect(client.validateCredentials()).resolves.toBe(false);
    });

    it('caches the Bearer token across calls', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE));

      const client = new RubyPayeurRecouvrementClient({
        apiToken: ORG_TOKEN,
        isProduction: true,
        logger: silentLogger,
      });
      await client.validateCredentials();
      await client.validateCredentials();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns false when a 200 response carries no auth token', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, { customer: 'X' }));

      const client = new RubyPayeurRecouvrementClient({
        apiToken: ORG_TOKEN,
        isProduction: true,
        logger: silentLogger,
      });
      await expect(client.validateCredentials()).resolves.toBe(false);
    });

    it('propagates a rate-limit error instead of reporting an invalid token', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': '30' }));

      const client = new RubyPayeurRecouvrementClient({
        apiToken: ORG_TOKEN,
        isProduction: true,
        logger: silentLogger,
      });
      const error = await client.validateCredentials().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(RateLimitedError);
      expect((error as RateLimitedError).retryAfterSeconds).toBe(30);
    });

    it('propagates a server error after exhausting retries', async () => {
      fetchMock.mockResolvedValue(mockFetchResponse(503, {}));

      const client = new RubyPayeurRecouvrementClient({
        apiToken: ORG_TOKEN,
        isProduction: true,
        logger: silentLogger,
      });
      await expect(client.validateCredentials()).rejects.toThrow(ServerError);
    });

    it('retries a transient network error during authentication', async () => {
      fetchMock
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE));

      const client = new RubyPayeurRecouvrementClient({
        apiToken: ORG_TOKEN,
        isProduction: true,
        logger: silentLogger,
      });
      await expect(client.validateCredentials()).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('createDebt', () => {
    function createAuthenticatedClient(isProduction: boolean) {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE));
      return new RubyPayeurRecouvrementClient({
        apiToken: ORG_TOKEN,
        isProduction,
        logger: silentLogger,
      });
    }

    function getFormData(): FormData {
      const [, init] = fetchMock.mock.calls[1] as [URL, RequestInit];
      return init.body as unknown as FormData;
    }

    function getFormField(key: string): string | undefined {
      const value = getFormData().get(key);
      if (value === null) {
        return undefined;
      }
      if (typeof value === 'string') {
        return value;
      }
      return value.name;
    }

    it('sends a POST to /api/debts as multipart/form-data', async () => {
      const client = createAuthenticatedClient(true);
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, {
          validation: 'Dossier transmis',
          id: 42,
          ref: 'ABC123',
        }),
      );

      await client.createDebt(createTestCreateDebtInput());

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [url, init] = fetchMock.mock.calls[1] as [URL, RequestInit];
      expect(url.pathname).toBe('/api/debts');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer test-auth-token',
        }),
      );
      expect(init.headers).not.toHaveProperty('Content-Type');

      expect(getFormField('debt[siren]')).toBe('987654321');
      expect(getFormField('debt[gender]')).toBe('male');
      expect(getFormField('debt[first_name]')).toBe('Jean');
      expect(getFormField('debt[last_name]')).toBe('Dupont');
      expect(getFormField('debt[email]')).toBe('jean@acme.fr');
      expect(getFormField('debt[phone]')).toBe('0612345678');
      expect(getFormField('debt[items_attributes][0][amount]')).toBe('550.45');
      expect(getFormField('debt[items_attributes][0][invoice_number]')).toBe('FA-2024-042');
      expect(getFormField('debt[items_attributes][0][invoiced_on]')).toBe('2024-10-01');
      expect(getFormField('debt[items_attributes][0][due_date]')).toBe('2024-10-31');
      expect(getFormField('debt[late_fee]')).toBe('1');
      expect(getFormField('debt[comment]')).toBe('Client injoignable');
      expect(getFormField('debt[terms_agree]')).toBe('1');
    });

    it('returns externalDebtId from ref and status pending', async () => {
      const client = createAuthenticatedClient(true);
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, {
          validation: 'Dossier transmis',
          id: 42,
          ref: 'ABC123',
        }),
      );

      const result = await client.createDebt(createTestCreateDebtInput());

      expect(result).toEqual({
        externalDebtId: 'ABC123',
        status: 'pending',
      });
    });

    it('falls back to id when ref is absent in response', async () => {
      const client = createAuthenticatedClient(true);
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, {
          validation: 'Dossier transmis',
          id: 99,
        }),
      );

      const result = await client.createDebt(createTestCreateDebtInput());

      expect(result.externalDebtId).toBe('99');
    });

    it('converts amountDueCents to euros', async () => {
      const client = createAuthenticatedClient(true);
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, { id: 1, ref: 'X' }));

      await client.createDebt(
        createTestCreateDebtInput({
          invoices: [
            {
              reference: 'FA-001',
              amountDueCents: 12345,
              issuedOn: '2024-01-01',
              dueOn: '2024-02-01',
            },
          ],
        }),
      );

      expect(getFormField('debt[items_attributes][0][amount]')).toBe('123.45');
    });

    it('uses fallback phone when debtor phone is missing', async () => {
      const client = createAuthenticatedClient(true);
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, { id: 1, ref: 'X' }));

      const input = createTestCreateDebtInput();
      input.debtor.phone = undefined;
      await client.createDebt(input);

      expect(getFormField('debt[phone]')).toBe('0184807678');
    });

    it('sets late_fee to 0 when lateFee is false', async () => {
      const client = createAuthenticatedClient(true);
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, { id: 1, ref: 'X' }));

      await client.createDebt(createTestCreateDebtInput({ lateFee: false }));

      expect(getFormField('debt[late_fee]')).toBe('0');
    });

    it('omits comment when undefined', async () => {
      const client = createAuthenticatedClient(true);
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, { id: 1, ref: 'X' }));

      await client.createDebt(createTestCreateDebtInput({ comment: undefined }));

      expect(getFormField('debt[comment]')).toBeUndefined();
    });

    it('includes billing_proof_data_uri when pdfBase64 is present', async () => {
      const client = createAuthenticatedClient(true);
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, { id: 1, ref: 'X' }));

      await client.createDebt(
        createTestCreateDebtInput({
          invoices: [
            {
              reference: 'FA-001',
              amountDueCents: 10000,
              issuedOn: '2024-01-01',
              dueOn: '2024-02-01',
              pdfBase64: 'JVBER==',
            },
          ],
        }),
      );

      expect(getFormField('debt[items_attributes][0][billing_proof_data_uri]')).toBe(
        'data:application/pdf;base64,JVBER==',
      );
    });

    describe('SIREN override', () => {
      it('uses real SIREN in production', async () => {
        const client = createAuthenticatedClient(true);
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, { id: 1, ref: 'X' }));

        await client.createDebt(createTestCreateDebtInput());

        expect(getFormField('debt[siren]')).toBe('987654321');
      });

      it('replaces SIREN with test value in non-production', async () => {
        const client = createAuthenticatedClient(false);
        fetchMock.mockResolvedValueOnce(mockFetchResponse(200, { id: 1, ref: 'X' }));

        await client.createDebt(createTestCreateDebtInput());

        expect(getFormField('debt[siren]')).toBe('123456789');
      });
    });

    describe('error handling', () => {
      it('throws ValidationError on 422', async () => {
        const client = createAuthenticatedClient(true);
        fetchMock.mockResolvedValueOnce(
          mockFetchResponse(422, {
            errors: {
              'items.amount': ['doit être remplie!', "n'est pas un nombre"],
              'items.invoice_number': ['Cette facture est déjà présente dans le dossier'],
            },
          }),
        );

        const error = await client.createDebt(createTestCreateDebtInput()).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.fieldErrors).toEqual({
          'items.amount': ['doit être remplie!', "n'est pas un nombre"],
          'items.invoice_number': ['Cette facture est déjà présente dans le dossier'],
        });
      });

      it('handles 422 with missing errors field gracefully', async () => {
        const client = createAuthenticatedClient(true);
        fetchMock.mockResolvedValueOnce(mockFetchResponse(422, {}));

        const error = await client.createDebt(createTestCreateDebtInput()).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).fieldErrors).toEqual({});
      });

      it('throws NotFoundError on 404', async () => {
        const client = createAuthenticatedClient(true);
        fetchMock.mockResolvedValueOnce(mockFetchResponse(404, {}));

        await expect(client.createDebt(createTestCreateDebtInput())).rejects.toThrow(NotFoundError);
      });

      it('propagates rate-limit error on 429', async () => {
        const client = createAuthenticatedClient(true);
        fetchMock.mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': '60' }));

        await expect(client.createDebt(createTestCreateDebtInput())).rejects.toThrow(
          RateLimitedError,
        );
      });

      it('propagates server error on 5xx', async () => {
        const client = createAuthenticatedClient(true);
        fetchMock.mockResolvedValue(mockFetchResponse(500, {}));

        await expect(client.createDebt(createTestCreateDebtInput())).rejects.toThrow(ServerError);
      });
    });
  });

  describe('getDebt', () => {
    function createAuthenticatedClient() {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE));
      return new RubyPayeurRecouvrementClient({
        apiToken: ORG_TOKEN,
        isProduction: true,
        logger: silentLogger,
      });
    }

    const SAMPLE_DEBT_RESPONSE = {
      reference: 'ABC123',
      Statut: 'En cours de recouvrement',
      montant_recouvre: 150.5,
      'Reste dû à date': '400,00 €',
      procedure_collective: 'NON',
      en_activite: 'OUI',
      'Date de clôture': null,
      section: 'En cours',
    };

    it('fetches a single debt by reference via query param', async () => {
      const client = createAuthenticatedClient();
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_DEBT_RESPONSE));

      await client.getDebt('ABC123');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [url, init] = fetchMock.mock.calls[1] as [URL, RequestInit];
      expect(url.pathname).toBe('/api/debts/');
      expect(url.searchParams.get('reference')).toBe('ABC123');
      expect(init.method).toBe('GET');
    });

    it('maps RubyPayeur response fields to RecoveryDebt', async () => {
      const client = createAuthenticatedClient();
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, SAMPLE_DEBT_RESPONSE));

      const result = await client.getDebt('ABC123');

      expect(result).toEqual({
        externalDebtId: 'ABC123',
        status: 'in_progress',
        amountRecoveredCents: 15050,
        amountRemainingCents: 40000,
        collectiveProceedings: false,
        debtorActive: true,
        partnerStatus: 'En cours de recouvrement',
        phase: undefined,
        partnerComment: undefined,
        procedureHistory: undefined,
        lastPartnerUpdateAt: undefined,
        openedAt: undefined,
        closedAt: undefined,
        debtorRegistrationNumber: undefined,
      });
    });

    it('maps procedure_collective OUI to collectiveProceedings true', async () => {
      const client = createAuthenticatedClient();
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, { ...SAMPLE_DEBT_RESPONSE, procedure_collective: 'OUI' }),
      );

      const result = await client.getDebt('ABC123');
      expect(result.collectiveProceedings).toBe(true);
    });

    it('maps en_activite NON to debtorActive false', async () => {
      const client = createAuthenticatedClient();
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, { ...SAMPLE_DEBT_RESPONSE, en_activite: 'NON' }),
      );

      const result = await client.getDebt('ABC123');
      expect(result.debtorActive).toBe(false);
    });

    it('parses Date de clôture when present', async () => {
      const client = createAuthenticatedClient();
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, {
          ...SAMPLE_DEBT_RESPONSE,
          Statut: 'Clôturé',
          'Date de clôture': '15/03/2025',
        }),
      );

      const result = await client.getDebt('ABC123');
      expect(result.closedAt).toBe('2025-03-15T00:00:00.000Z');
      expect(result.status).toBe('resolved');
    });

    it('maps known RubyPayeur statuses correctly', async () => {
      const client = createAuthenticatedClient();

      const statusCases: Array<[string, string]> = [
        ['Dossier en attente de validation', 'pending'],
        ['En cours de recouvrement', 'in_progress'],
        ['En attente de réglement', 'in_progress'],
        ['Echéancier en cours', 'in_progress'],
        ['Recouvré', 'resolved'],
        ['Recouvrement partiel', 'resolved'],
        ['Clôturé', 'resolved'],
        ['Irrécouvrable', 'failed'],
        ['Annulé', 'cancelled'],
      ];

      for (const [rubyPayeurStatus, expectedStatus] of statusCases) {
        fetchMock.mockResolvedValueOnce(
          mockFetchResponse(200, { ...SAMPLE_DEBT_RESPONSE, Statut: rubyPayeurStatus }),
        );

        const result = await client.getDebt('ABC123');
        expect(result.status).toBe(expectedStatus);
      }
    });

    it('defaults unknown status to in_progress', async () => {
      const client = createAuthenticatedClient();
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, { ...SAMPLE_DEBT_RESPONSE, Statut: 'Some Future Status' }),
      );

      const result = await client.getDebt('ABC123');
      expect(result.status).toBe('in_progress');
    });

    it('parses Reste dû à date with various formats', async () => {
      const client = createAuthenticatedClient();

      const cases: Array<[string, number]> = [
        ['1 234,56 €', 123456],
        ['400,00 €', 40000],
        ['0', 0],
        ['1234.56', 123456],
      ];

      for (const [remainingString, expectedCents] of cases) {
        fetchMock.mockResolvedValueOnce(
          mockFetchResponse(200, {
            ...SAMPLE_DEBT_RESPONSE,
            'Reste dû à date': remainingString,
          }),
        );

        const result = await client.getDebt('ABC123');
        expect(result.amountRemainingCents).toBe(expectedCents);
      }
    });

    it('throws NotFoundError on 404', async () => {
      const client = createAuthenticatedClient();
      fetchMock.mockResolvedValueOnce(mockFetchResponse(404, {}));

      await expect(client.getDebt('UNKNOWN')).rejects.toThrow(NotFoundError);
    });

    it('propagates rate-limit error on 429', async () => {
      const client = createAuthenticatedClient();
      fetchMock.mockResolvedValueOnce(mockFetchResponse(429, {}, { 'retry-after': '30' }));

      await expect(client.getDebt('ABC123')).rejects.toThrow(RateLimitedError);
    });
  });

  describe('getDebts', () => {
    function createAuthenticatedClient() {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE));
      return new RubyPayeurRecouvrementClient({
        apiToken: ORG_TOKEN,
        isProduction: true,
        logger: silentLogger,
      });
    }

    function makeDebtResponse(
      reference: string,
      overrides?: Partial<RubyPayeurDebtResponseForTest>,
    ): RubyPayeurDebtResponseForTest {
      return {
        reference,
        Statut: 'En cours de recouvrement',
        montant_recouvre: 0,
        'Reste dû à date': '100,00 €',
        procedure_collective: 'NON',
        en_activite: 'OUI',
        'Date de clôture': null,
        section: 'En cours',
        ...overrides,
      };
    }

    function wrapInJsonApi(items: RubyPayeurDebtResponseForTest[]): {
      data: { attributes: RubyPayeurDebtResponseForTest }[];
    } {
      return { data: items.map((attrs) => ({ attributes: attrs })) };
    }

    it('fetches all debts when given empty IDs', async () => {
      const client = createAuthenticatedClient();

      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, wrapInJsonApi([makeDebtResponse('REF-1')])),
      );

      const result = await client.getDebts([]);

      expect(result).toHaveLength(1);
      expect(result[0].externalDebtId).toBe('REF-1');
    });

    it('fetches all pages and filters to requested IDs', async () => {
      const client = createAuthenticatedClient();

      const page1 = Array.from({ length: 50 }, (_, i) => makeDebtResponse(`REF-${i}`));
      const page2 = Array.from({ length: 10 }, (_, i) => makeDebtResponse(`REF-${50 + i}`));

      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(200, wrapInJsonApi(page1)))
        .mockResolvedValueOnce(mockFetchResponse(200, wrapInJsonApi(page2)));

      const result = await client.getDebts(['REF-0', 'REF-55']);

      expect(result).toHaveLength(2);
      expect(result[0].externalDebtId).toBe('REF-0');
      expect(result[1].externalDebtId).toBe('REF-55');

      expect(fetchMock).toHaveBeenCalledTimes(3);
      const [url1] = fetchMock.mock.calls[1] as [URL];
      expect(url1.searchParams.get('page')).toBe('1');
      const [url2] = fetchMock.mock.calls[2] as [URL];
      expect(url2.searchParams.get('page')).toBe('2');
    });

    it('stops pagination when API returns empty data', async () => {
      const client = createAuthenticatedClient();

      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, { data: [] }));

      const result = await client.getDebts(['REF-1']);

      expect(result).toHaveLength(0);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns empty when no requested IDs match', async () => {
      const client = createAuthenticatedClient();

      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(
          200,
          wrapInJsonApi([makeDebtResponse('OTHER-1'), makeDebtResponse('OTHER-2')]),
        ),
      );

      const result = await client.getDebts(['REF-999']);

      expect(result).toHaveLength(0);
    });

    it('propagates server error', async () => {
      const client = createAuthenticatedClient();
      fetchMock.mockResolvedValue(mockFetchResponse(500, {}));

      await expect(client.getDebts(['REF-1'])).rejects.toThrow(ServerError);
    });
  });

  describe('response shape validation', () => {
    function createAuthenticatedClient() {
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, VALID_AUTH_RESPONSE));
      return new RubyPayeurRecouvrementClient({
        apiToken: ORG_TOKEN,
        isProduction: true,
        logger: silentLogger,
      });
    }

    it('throws ResponseShapeError when getDebt response is missing required fields', async () => {
      const client = createAuthenticatedClient();
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, { id: 123, status: 'open' }));

      const error = await client.getDebt('ABC123').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ResponseShapeError);
      expect((error as ResponseShapeError).endpoint).toBe('GET /api/debts/:reference');
    });

    it('throws ResponseShapeError when getDebts list has wrong item shape', async () => {
      const client = createAuthenticatedClient();
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, {
          data: [{ wrong: 'shape' }],
        }),
      );

      const error = await client.getDebts([]).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ResponseShapeError);
      expect((error as ResponseShapeError).endpoint).toBe('GET /api/debts');
    });

    it('throws ResponseShapeError when createDebt response is not an object', async () => {
      const client = createAuthenticatedClient();
      fetchMock.mockResolvedValueOnce(mockFetchResponse(200, 'plain text'));

      const error = await client.createDebt(createTestCreateDebtInput()).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ResponseShapeError);
      expect((error as ResponseShapeError).endpoint).toBe('POST /api/debts');
    });

    it('accepts extra fields in debt response (passthrough)', async () => {
      const client = createAuthenticatedClient();
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse(200, {
          reference: 'ABC123',
          Statut: 'En cours de recouvrement',
          montant_recouvre: 150.5,
          'Reste dû à date': '400,00 €',
          procedure_collective: 'NON',
          en_activite: 'OUI',
          'Date de clôture': null,
          section: 'En cours',
          new_api_field: 'should not break',
          nested: { extra: true },
        }),
      );

      const result = await client.getDebt('ABC123');

      expect(result.externalDebtId).toBe('ABC123');
      expect(result.status).toBe('in_progress');
    });
  });
});
