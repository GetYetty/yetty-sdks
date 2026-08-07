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

export type RecoveryDebtStatus = 'pending' | 'in_progress' | 'resolved' | 'failed' | 'cancelled';

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

export type CollectiveProceedingNature = 'Redressement' | 'Liquidation' | 'Sauvegarde';

export interface RecoveryDebt {
  externalDebtId: string;
  status: RecoveryDebtStatus;
  amountRecoveredCents?: number;
  amountRemainingCents?: number;
  collectiveProceedings?: boolean;
  collectiveProceedingNature?: CollectiveProceedingNature;
  debtorActive?: boolean;
  debtorDisplayName?: string;
  debtorRegistrationNumber?: string;
  phase?: string;
  partnerStatus?: string;
  partnerComment?: string;
  partnerMessage?: string;
  availableActions?: string;
  latePaymentFlagged?: boolean;
  procedureHistory?: string;
  debtDetails?: string;
  paymentSchedule?: boolean;
  paymentScheduleDetails?: string;
  paymentScheduleStatus?: string;
  caseManagerName?: string;
  lastPartnerUpdateAt?: string;
  openedAt?: string;
  closedAt?: string;
}
