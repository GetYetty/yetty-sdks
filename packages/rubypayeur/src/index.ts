export {
  AuthenticationError,
  NotFoundError,
  RateLimitedError,
  RubyPayeurError,
  ServerError,
  ValidationError,
} from './errors.js';

export { RubyPayeurHttpClient, type RubyPayeurHttpClientOptions } from './http-client.js';

export { consoleLogger, type RubyPayeurLogger } from './logger.js';

export {
  RubyPayeurRecouvrementClient,
  type RubyPayeurRecouvrementClientOptions,
} from './recouvrement-client.js';

export { RubyPayeurScoringClient, type RubyPayeurScoringClientOptions } from './scoring-client.js';

export type {
  CreateDebtInput,
  DebtorGender,
  RecoveryDebt,
  RecoveryDebtInvoice,
  RecoveryDebtStatus,
  RecoveryDebtor,
  RubyPayeurScoring,
  ScoringColor,
  ScoringLetter,
} from './types.js';

export { isValidScoringLetter, scoringColorForLetter } from './types.js';

export {
  eurosToCents,
  mapStatus,
  parseAmountStringToCents,
  parseFrenchDate,
  toFormData,
} from './utils.js';
