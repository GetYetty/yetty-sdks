// --- Scoring types ---

export type ScoringLetter = 'A' | 'B' | 'C' | 'D' | 'E';

const VALID_LETTERS: ReadonlySet<string> = new Set<ScoringLetter>(['A', 'B', 'C', 'D', 'E']);

export function isValidScoringLetter(value: string): value is ScoringLetter {
  return VALID_LETTERS.has(value);
}

export type ScoringColor = 'dark_green' | 'light_green' | 'yellow' | 'orange' | 'red';

const LETTER_TO_COLOR: Record<ScoringLetter, ScoringColor> = {
  A: 'dark_green',
  B: 'light_green',
  C: 'yellow',
  D: 'orange',
  E: 'red',
};

export function scoringColorForLetter(letter: ScoringLetter): ScoringColor {
  return LETTER_TO_COLOR[letter];
}

export interface RubyPayeurScoring {
  score: number;
  letter: ScoringLetter;
  color: ScoringColor;
  risk: string;
}

// --- Recouvrement types ---

export type RecoveryDebtStatus =
  | 'pending'
  | 'in_progress'
  | 'partially_resolved'
  | 'resolved'
  | 'failed'
  | 'cancelled';

export type DebtorGender = 'male' | 'female';

export interface RecoveryDebtInvoice {
  reference: string;
  amountDueCents: number;
  issuedOn: string;
  dueOn: string;
  pdfBase64?: string;
}

export interface RecoveryDebtor {
  name: string;
  registrationNumber: string;
  gender: DebtorGender;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
}

export interface CreateDebtInput {
  debtor: RecoveryDebtor;
  invoices: RecoveryDebtInvoice[];
  lateFee: boolean;
  comment?: string;
  dunningLetterProofBase64?: string;
}

export type CollectiveProceedingNature = 'restructuring' | 'liquidation' | 'safeguard';

export interface CollectiveProceedings {
  active: true;
  nature?: CollectiveProceedingNature;
}

export interface PaymentSchedule {
  details?: string;
  status?: string;
}

export interface RecoveryDebt {
  externalDebtId: string;
  status: RecoveryDebtStatus;
  partnerStatusLabel: string;

  amountRecoveredCents: number;
  amountRemainingCents: number;

  debtorCompanyName?: string;
  debtorRegistrationNumber?: string;
  debtorActive?: boolean;

  collectiveProceedings?: CollectiveProceedings;
  recoveryPhase?: string;
  procedureHistory?: string;
  latePaymentSignaled?: boolean;

  statusVerdict?: string;
  caseManagerName?: string;
  caseManagerMessage?: string;
  nextStepsSuggestion?: string;

  debtBreakdown?: string;
  paymentSchedule?: PaymentSchedule;

  lastPartnerUpdateAt?: string;
  openedAt?: string;
  closedAt?: string;
}
