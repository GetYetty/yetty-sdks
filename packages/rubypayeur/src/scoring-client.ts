import { NotFoundError } from './errors.js';
import { RubyPayeurHttpClient, type RubyPayeurHttpClientOptions } from './http-client.js';
import type { RubyPayeurLogger } from './logger.js';
import { CompanyResponseSchema, parseResponse } from './schemas.js';
import {
  type RubyPayeurScoring,
  type ScoringLetter,
  isValidScoringLetter,
  scoringColorForLetter,
} from './types.js';

export interface RubyPayeurScoringClientOptions {
  apiToken: string;
  logger?: RubyPayeurLogger;
}

export class RubyPayeurScoringClient {
  private readonly http: RubyPayeurHttpClient;

  constructor(options: RubyPayeurScoringClientOptions) {
    const httpOptions: RubyPayeurHttpClientOptions = {
      apiToken: options.apiToken,
      authPath: '/api/auth',
      apiLabel: 'RubyPayeur API',
      logger: options.logger,
    };
    this.http = new RubyPayeurHttpClient(httpOptions);
  }

  async getCompanyScoring(siren: string): Promise<RubyPayeurScoring> {
    return this.http.requestWithAuth(async (authToken) => {
      const url = new URL('/api/companies', this.http.baseUrl);
      url.searchParams.set('siren', siren);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.status === 404) {
        throw new NotFoundError(`company SIREN ${siren}`);
      }

      this.http.throwOnErrorStatus(response);

      const raw = await response.json();
      const body = parseResponse(CompanyResponseSchema, raw, 'GET /api/companies');
      const attributes = body.data.attributes;

      if (
        !attributes?.current_scoring_letter ||
        attributes.current_scoring === null ||
        attributes.current_scoring === undefined ||
        attributes.current_scoring.trim() === ''
      ) {
        throw new NotFoundError(`company SIREN ${siren}`);
      }

      if (!isValidScoringLetter(attributes.current_scoring_letter)) {
        throw new Error(
          `Unexpected scoring letter "${attributes.current_scoring_letter}" for SIREN ${siren}`,
        );
      }

      return {
        score: Number(attributes.current_scoring),
        letter: attributes.current_scoring_letter as ScoringLetter,
        color: scoringColorForLetter(attributes.current_scoring_letter),
        risk: attributes.current_scoring_risk ?? '',
      };
    });
  }
}
