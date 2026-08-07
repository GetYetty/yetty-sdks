import type { RubyPayeurLogger } from './logger.js';
import type { RecoveryDebtStatus } from './types.js';

const STATUS_MAP: Record<string, RecoveryDebtStatus> = {
  'Dossier en attente de validation': 'pending',
  'En cours de recouvrement': 'in_progress',
  'En attente de réglement': 'in_progress',
  'Echéancier en cours': 'in_progress',
  'Retard de paiement signalé': 'in_progress',
  'Injonction en cours': 'in_progress',
  'Compte non provisionné': 'in_progress',
  'Injonction opposée': 'in_progress',
  Recouvré: 'resolved',
  'Recouvrement terminé': 'resolved',
  'Recouvrement partiel': 'resolved',
  'Injonction terminée': 'resolved',
  'Saisie terminée': 'resolved',
  Clôturé: 'resolved',
  Irrécouvrable: 'failed',
  'Injonction perdue': 'failed',
  Annulé: 'cancelled',
  'Clôture anticipée': 'cancelled',
  'Signalement retiré': 'cancelled',
};

export function mapStatus(statut: string, logger?: RubyPayeurLogger): RecoveryDebtStatus {
  const mapped = STATUS_MAP[statut];
  if (!mapped) {
    logger?.warn(`Unknown RubyPayeur status "${statut}", defaulting to in_progress`);
  }
  return mapped ?? 'in_progress';
}

export function parseOuiNon(value: string): boolean {
  return value === 'OUI';
}

export function parseFrenchDate(value: string): string | undefined {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return undefined;
  }
  return `${match[3]}-${match[2]}-${match[1]}T00:00:00.000Z`;
}

export function parseAmountStringToCents(value: string): number {
  const remainingMatch = value.match(/Montant total restant d[ûu]\s*:\s*([\d\s,.]+)\s*euros/i);
  const raw = remainingMatch?.[1] ?? value;
  const cleaned = raw
    .replace(/\s/g, '')
    .replace(/[^\d,.]/g, '')
    .replace(',', '.');
  const euros = parseFloat(cleaned);
  if (isNaN(euros)) {
    return 0;
  }
  return Math.round(euros * 100);
}

export function eurosToCents(value: string | number | null): number {
  const euros = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (isNaN(euros)) {
    return 0;
  }
  return Math.round(euros * 100);
}

export function flattenToFormData(formData: FormData, value: unknown, prefix: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flattenToFormData(formData, item, `${prefix}[${index}]`);
    });
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, val] of Object.entries(value)) {
      flattenToFormData(formData, val, prefix ? `${prefix}[${key}]` : key);
    }
  } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    formData.append(prefix, String(value));
  }
}

export function toFormData(obj: object): FormData {
  const formData = new FormData();
  flattenToFormData(formData, obj, '');
  return formData;
}
