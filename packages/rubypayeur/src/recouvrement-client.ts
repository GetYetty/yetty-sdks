import { AuthenticationError, NotFoundError, ValidationError } from './errors.js';
import { RubyPayeurHttpClient, type RubyPayeurHttpClientOptions } from './http-client.js';
import { type RubyPayeurLogger, consoleLogger } from './logger.js';
import type { CreateDebtInput, RecoveryDebt, RecoveryDebtInvoice } from './types.js';
import {
  eurosToCents,
  mapStatus,
  parseAmountStringToCents,
  parseFrenchDate,
  parseOuiNon,
  toFormData,
} from './utils.js';

const RUBYPAYEUR_FALLBACK_PHONE = '0184807678';
const RUBYPAYEUR_PAGE_SIZE = 50;
const TEST_SIREN = '123456789';

interface RubyPayeurCreateDebtResponse {
  validation: string;
  id: number;
  ref: string;
}

interface RubyPayeurErrorResponse {
  errors: Record<string, string[]>;
}

interface RubyPayeurDebtRequestBody {
  debt: {
    siren: string;
    gender: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    items_attributes: RubyPayeurItemAttributes[];
    late_fee: 0 | 1;
    comment?: string;
    dunning_letter_proof?: string;
    terms_agree: 1;
  };
}

interface RubyPayeurItemAttributes {
  amount: number;
  invoice_number: string;
  invoiced_on: string;
  due_date: string;
  billing_proof_data_uri?: string;
}

interface RubyPayeurDebtResponse {
  reference: string;
  Statut: string;
  montant_recouvre: string | number | null;
  'Reste dû à date': string | null;
  procedure_collective: 'OUI' | 'NON';
  en_activite: 'OUI' | 'NON';
  'Date de clôture': string | null;
  etape?: string;
  Commentaire?: string;
  'Historique des procédures'?: string;
  derniere_mise_a_jour?: string;
  "Date d'ouverture"?: string;
  'SIREN débiteur'?: string;
  section: string;
  [key: string]: unknown;
}

export interface RubyPayeurRecouvrementClientOptions {
  apiToken: string;
  isProduction: boolean;
  logger?: RubyPayeurLogger;
}

export class RubyPayeurRecouvrementClient {
  private readonly http: RubyPayeurHttpClient;
  private readonly isProduction: boolean;
  private readonly logger: RubyPayeurLogger;

  constructor(options: RubyPayeurRecouvrementClientOptions) {
    this.isProduction = options.isProduction;
    this.logger = options.logger ?? consoleLogger;

    this.logger.log(
      this.isProduction
        ? 'Production mode: real debtor SIREN will be used'
        : `Test mode: debtor SIREN will be replaced with ${TEST_SIREN}`,
    );

    const httpOptions: RubyPayeurHttpClientOptions = {
      apiToken: options.apiToken,
      authPath: '/api/debt_auth',
      apiLabel: 'RubyPayeur Recouvrement API',
      logger: this.logger,
    };
    this.http = new RubyPayeurHttpClient(httpOptions);
  }

  async validateCredentials(): Promise<boolean> {
    try {
      await this.http.ensureAuthenticated();
      return true;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return false;
      }
      throw error;
    }
  }

  async createDebt(input: CreateDebtInput): Promise<RecoveryDebt> {
    return this.http.requestWithAuth(async (authToken) => {
      const body = this.buildCreateDebtBody(input);
      const formData = toFormData(body);

      const response = await fetch(new URL('/api/debts', this.http.baseUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (response.status === 422) {
        const errorBody = (await response.json()) as Partial<RubyPayeurErrorResponse>;
        throw new ValidationError(errorBody.errors ?? {});
      }

      if (response.status === 404) {
        throw new NotFoundError('/api/debts');
      }

      this.http.throwOnErrorStatus(response);

      const data = (await response.json()) as Partial<RubyPayeurCreateDebtResponse>;

      return {
        externalDebtId: String(data.ref ?? data.id),
        status: 'pending' as const,
      };
    });
  }

  async getDebt(externalDebtId: string): Promise<RecoveryDebt> {
    return this.http.requestWithAuth(async (authToken) => {
      const url = new URL('/api/debts/', this.http.baseUrl);
      url.searchParams.set('reference', externalDebtId);

      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.status === 404) {
        throw new NotFoundError(`debt reference=${externalDebtId}`);
      }

      this.http.throwOnErrorStatus(response);

      const data = (await response.json()) as RubyPayeurDebtResponse;
      return this.mapDebtResponse(data);
    });
  }

  async getDebts(externalDebtIds: string[]): Promise<RecoveryDebt[]> {
    const filterByIds = externalDebtIds.length > 0;
    const requestedIds = new Set(externalDebtIds);

    return this.http.requestWithAuth(async (authToken) => {
      const matched: RecoveryDebt[] = [];
      let page = 1;
      let pageSize = RUBYPAYEUR_PAGE_SIZE;

      while (pageSize === RUBYPAYEUR_PAGE_SIZE) {
        const url = new URL('/api/debts', this.http.baseUrl);
        url.searchParams.set('page', String(page));

        const response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${authToken}` },
        });

        this.http.throwOnErrorStatus(response);

        const body = (await response.json()) as {
          data?: { attributes: RubyPayeurDebtResponse }[];
        };
        const data = body.data;
        if (!Array.isArray(data) || data.length === 0) {
          break;
        }

        for (const entry of data) {
          const item = entry.attributes;
          if (!filterByIds || requestedIds.has(item.reference)) {
            matched.push(this.mapDebtResponse(item));
          }
        }

        pageSize = data.length;
        page++;
      }

      return matched;
    });
  }

  private mapDebtResponse(data: RubyPayeurDebtResponse): RecoveryDebt {
    return {
      externalDebtId: data.reference,
      status: mapStatus(data.Statut, this.logger),
      amountRecoveredCents: eurosToCents(data.montant_recouvre ?? 0),
      amountRemainingCents: parseAmountStringToCents(data['Reste dû à date'] ?? '0'),
      collectiveProceedings: parseOuiNon(data.procedure_collective ?? 'NON'),
      debtorActive: parseOuiNon(data.en_activite ?? 'OUI'),
      phase: data.etape || undefined,
      partnerStatus: data.Statut || undefined,
      partnerComment: data.Commentaire || undefined,
      procedureHistory: data['Historique des procédures'] || undefined,
      lastPartnerUpdateAt: data.derniere_mise_a_jour
        ? parseFrenchDate(data.derniere_mise_a_jour)
        : undefined,
      openedAt: data["Date d'ouverture"] ? parseFrenchDate(data["Date d'ouverture"]) : undefined,
      closedAt: data['Date de clôture'] ? parseFrenchDate(data['Date de clôture']) : undefined,
      debtorRegistrationNumber: data['SIREN débiteur'] || undefined,
    };
  }

  private buildCreateDebtBody(input: CreateDebtInput): RubyPayeurDebtRequestBody {
    const siren = this.isProduction ? input.debtor.registrationNumber : TEST_SIREN;

    return {
      debt: {
        siren,
        gender: input.debtor.gender,
        first_name: input.debtor.firstName,
        last_name: input.debtor.lastName,
        email: input.debtor.email,
        phone: input.debtor.phone ?? RUBYPAYEUR_FALLBACK_PHONE,
        items_attributes: input.invoices.map((inv): RubyPayeurItemAttributes =>
          this.buildItemAttributes(inv),
        ),
        late_fee: input.lateFee ? 1 : 0,
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
        ...(input.dunningLetterProofBase64
          ? {
              dunning_letter_proof: `data:application/pdf;base64,${input.dunningLetterProofBase64}`,
            }
          : {}),
        terms_agree: 1,
      },
    };
  }

  private buildItemAttributes(invoice: RecoveryDebtInvoice): RubyPayeurItemAttributes {
    const attrs: RubyPayeurItemAttributes = {
      amount: Number((invoice.amountDueCents / 100).toFixed(2)),
      invoice_number: invoice.reference,
      invoiced_on: invoice.issuedOn,
      due_date: invoice.dueOn,
    };

    if (invoice.pdfBase64) {
      attrs.billing_proof_data_uri = `data:application/pdf;base64,${invoice.pdfBase64}`;
    }

    return attrs;
  }
}
