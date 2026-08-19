import { z } from "zod";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use o formato YYYY-MM.");

export const toolSchemas = {
  query_financial_overview: z.object({ month: monthSchema }),
  create_transaction_draft: z.object({
    amountCents: z.number().int().positive(),
    description: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1).max(80),
    paymentMethod: z.string().trim().min(1).max(80),
  }),
  confirm_transaction: z.object({
    draftId: z.string().min(1),
    confirmed: z.literal(true),
  }),
  analyze_spending: z.object({ month: monthSchema }),
  simulate_financial_scenario: z.object({
    month: monthSchema,
    category: z.string().trim().min(1).max(80),
    reductionPercentage: z.number().int().min(0).max(100),
  }),
} as const;

export type ToolName = keyof typeof toolSchemas;

