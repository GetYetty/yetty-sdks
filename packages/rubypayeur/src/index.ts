export {
  AuthenticationError,
  NotFoundError,
  RateLimitedError,
  ResponseShapeError,
  RubyPayeurError,
  ServerError,
  ValidationError,
} from './errors.js';

export type { ScoringClient, RecouvrementClient } from './interfaces.js';

export { RubyPayeurHttpClient, type RubyPayeurHttpClientOptions } from './http-client.js';

export { consoleLogger, type RubyPayeurLogger } from './logger.js';

export {
  RubyPayeurRecouvrementClient,
  type RubyPayeurRecouvrementClientOptions,
} from './recouvrement-client.js';

export { RubyPayeurScoringClient, type RubyPayeurScoringClientOptions } from './scoring-client.js';

export type {
  CollectiveProceedingNature,
  CollectiveProceedings,
  CreateDebtInput,
  DebtorGender,
  PaymentSchedule,
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
