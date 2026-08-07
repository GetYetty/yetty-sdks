import { z } from 'zod';

import { ResponseShapeError } from './errors.js';

// --- Scoring API ---

export const CompanyResponseSchema = z
  .object({
    data: z.object({
      attributes: z
        .object({
          current_scoring: z.string().nullable(),
          current_scoring_letter: z.string().nullable(),
          current_scoring_color: z.string().nullable(),
          current_scoring_risk: z.string().nullable(),
        })
        .passthrough(),
    }),
  })
  .passthrough();

export type CompanyResponse = z.infer<typeof CompanyResponseSchema>;

// --- Recouvrement API ---

export const CreateDebtResponseSchema = z
  .object({
    id: z.number().optional(),
    ref: z.string().optional(),
    validation: z.string().optional(),
  })
  .passthrough();

export type CreateDebtResponse = z.infer<typeof CreateDebtResponseSchema>;

export const ErrorResponseSchema = z
  .object({
    errors: z.record(z.array(z.string())).optional(),
  })
  .passthrough();

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

const OuiNonSchema = z.enum(['OUI', 'NON']);

export const DebtResponseSchema = z
  .object({
    reference: z.string(),
    Statut: z.string(),
    montant_recouvre: z.union([z.string(), z.number(), z.null()]),
    'Reste dû à date': z.string().nullable(),
    procedure_collective: OuiNonSchema,
    en_activite: OuiNonSchema,
    'Date de clôture': z.string().nullable(),
    section: z.string(),
    etape: z.string().optional(),
    Commentaire: z.string().optional(),
    'Historique des procédures': z.string().optional(),
    derniere_mise_a_jour: z.string().optional(),
    "Date d'ouverture": z.string().optional(),
    'SIREN débiteur': z.string().optional(),
  })
  .passthrough();

export type DebtResponse = z.infer<typeof DebtResponseSchema>;

export const DebtListResponseSchema = z
  .object({
    data: z
      .array(
        z.object({
          attributes: DebtResponseSchema,
        }),
      )
      .optional(),
  })
  .passthrough();

export type DebtListResponse = z.infer<typeof DebtListResponseSchema>;

/**
 * Parse a JSON response body against a Zod schema. Throws a
 * `ResponseShapeError` with the endpoint and validation details
 * when the response doesn't match the expected shape.
 */
export function parseResponse<T>(schema: z.ZodType<T>, data: unknown, endpoint: string): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  throw new ResponseShapeError(endpoint, result.error);
}
