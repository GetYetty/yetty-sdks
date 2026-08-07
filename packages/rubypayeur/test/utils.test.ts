import { describe, it, expect, vi } from 'vitest';

import {
  eurosToCents,
  mapStatus,
  parseAmountStringToCents,
  parseFrenchDate,
  parseOuiNon,
} from '../src/utils.js';

describe('eurosToCents', () => {
  it('converts a string amount to cents', () => {
    expect(eurosToCents('1927.0')).toBe(192700);
  });

  it('converts a string with decimals to cents', () => {
    expect(eurosToCents('8411.71')).toBe(841171);
  });

  it('converts a number to cents', () => {
    expect(eurosToCents(1927)).toBe(192700);
  });

  it('converts numeric zero to 0', () => {
    expect(eurosToCents(0)).toBe(0);
  });

  it('converts null to 0', () => {
    expect(eurosToCents(null)).toBe(0);
  });

  it('converts an empty string to 0', () => {
    expect(eurosToCents('')).toBe(0);
  });

  it('converts a non-numeric string to 0', () => {
    expect(eurosToCents('not-a-number')).toBe(0);
  });

  it('rounds to the nearest cent', () => {
    expect(eurosToCents('19.999')).toBe(2000);
  });
});

describe('parseAmountStringToCents', () => {
  it('extracts amount from "Montant total restant dû" sentence', () => {
    expect(
      parseAmountStringToCents(
        'Montant en principal : 6 300,00  euros Montant prévu au jugement : 8 637,46  euros Montant total restant dû : 8 637,46  euros',
      ),
    ).toBe(863746);
  });

  it('returns 0 for prose with no extractable amount', () => {
    expect(
      parseAmountStringToCents('Tout a été recouvré. Le dossier est clôturé avec succès.'),
    ).toBe(0);
  });

  it('parses a plain numeric string', () => {
    expect(parseAmountStringToCents('1927.00')).toBe(192700);
  });

  it('parses a French-formatted number with spaces and comma', () => {
    expect(parseAmountStringToCents('8 411,71')).toBe(841171);
  });

  it('parses a zero string', () => {
    expect(parseAmountStringToCents('0')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(parseAmountStringToCents('')).toBe(0);
  });

  it('handles the "Montant total restant dû" pattern with accent variant (u instead of û)', () => {
    expect(parseAmountStringToCents('Montant total restant du : 700,00  euros')).toBe(70000);
  });

  it('handles multi-line "Reste dû à date" with invoice breakdown', () => {
    const value =
      '- Facture INV-003864 : 2 680,00  euros / émission 31/05/2024 / échéance 30/06/2024.' +
      ' Montant en principal : 7 920,00  euros' +
      ' Indemnité(s) forfaitaire(s) : 200,00  euros (5 x 40 euros)' +
      ' Montant total restant dû : 7 151,80  euros';
    expect(parseAmountStringToCents(value)).toBe(715180);
  });
});

describe('parseFrenchDate', () => {
  it('parses a DD/MM/YYYY date to ISO', () => {
    expect(parseFrenchDate('14/06/2023')).toBe('2023-06-14T00:00:00.000Z');
  });

  it('returns undefined for non-date strings', () => {
    expect(parseFrenchDate('not-a-date')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseFrenchDate('')).toBeUndefined();
  });

  it('returns undefined for ISO format input', () => {
    expect(parseFrenchDate('2023-06-14')).toBeUndefined();
  });

  it('parses date with future year', () => {
    expect(parseFrenchDate('09/12/2025')).toBe('2025-12-09T00:00:00.000Z');
  });
});

describe('parseOuiNon', () => {
  it('returns true for OUI', () => {
    expect(parseOuiNon('OUI')).toBe(true);
  });

  it('returns false for NON', () => {
    expect(parseOuiNon('NON')).toBe(false);
  });

  it('returns false for any other string', () => {
    expect(parseOuiNon('Non')).toBe(false);
  });
});

describe('mapStatus', () => {
  const silentLogger = { log: () => {}, warn: () => {}, error: () => {} };

  it.each([
    ['Dossier en attente de validation', 'pending'],
    ['En cours de recouvrement', 'in_progress'],
    ['En attente de réglement', 'in_progress'],
    ['Echéancier en cours', 'in_progress'],
    ['Retard de paiement signalé', 'in_progress'],
    ['Injonction en cours', 'in_progress'],
    ['Compte non provisionné', 'in_progress'],
    ['Injonction opposée', 'in_progress'],
    ['Recouvré', 'resolved'],
    ['Recouvrement terminé', 'resolved'],
    ['Recouvrement partiel', 'resolved'],
    ['Injonction terminée', 'resolved'],
    ['Saisie terminée', 'resolved'],
    ['Clôturé', 'resolved'],
    ['Irrécouvrable', 'failed'],
    ['Injonction perdue', 'failed'],
    ['Annulé', 'cancelled'],
    ['Clôture anticipée', 'cancelled'],
    ['Signalement retiré', 'cancelled'],
  ] as const)('maps "%s" to "%s"', (input, expected) => {
    expect(mapStatus(input, silentLogger)).toBe(expected);
  });

  it('defaults unknown status to in_progress and logs a warning', () => {
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    expect(mapStatus('Something New', logger)).toBe('in_progress');
    expect(logger.warn).toHaveBeenCalledWith(
      'Unknown RubyPayeur status "Something New", defaulting to in_progress',
    );
  });
});
