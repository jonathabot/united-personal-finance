import { z } from "zod";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use o formato YYYY-MM.");

export const toolSchemas = {
  create_financial_entity_draft: z.object({
    kind: z.enum(["income", "credit_card", "fixed_expense", "loan", "reserve", "account"]),
    name: z.string().trim().min(1).max(120),
    amountCents: z.number().int().nonnegative().nullish().transform((value) => value ?? undefined),
    effectiveFrom: monthSchema,
    closingDay: z.number().int().min(1).max(31).nullish().transform((value) => value ?? undefined),
    dueDay: z.number().int().min(1).max(31).nullish().transform((value) => value ?? undefined),
  }).superRefine((value, context) => {
    if (value.kind === "credit_card" && (!value.closingDay || !value.dueDay)) context.addIssue({ code: "custom", message: "Cartões exigem fechamento e vencimento." });
    if (["income", "fixed_expense", "loan"].includes(value.kind) && value.amountCents === undefined) context.addIssue({ code: "custom", message: "Esta entidade exige um valor recorrente." });
  }),
  rename_financial_entity_draft: z.object({ currentName: z.string().trim().min(1).max(120), newName: z.string().trim().min(1).max(120) }),
  change_financial_entity_value_draft: z.object({ name: z.string().trim().min(1).max(120), amountCents: z.number().int().nonnegative(), effectiveFrom: monthSchema }),
  close_financial_entity_draft: z.object({ name: z.string().trim().min(1).max(120), inactiveFrom: monthSchema, status: z.enum(["inactive", "settled"]) }),
  cancel_financial_change: z.object({ cancelled: z.literal(true) }),
  confirm_financial_change: z.object({ confirmed: z.literal(true) }),
  query_financial_overview: z.object({ month: monthSchema }),
  compare_financial_months: z.object({ monthA: monthSchema, monthB: monthSchema }).refine((value) => value.monthA !== value.monthB, "Escolha dois meses diferentes."),
  create_transaction_draft: z.object({
    type: z.enum(["expense", "income", "refund", "transfer"]).default("expense"),
    amountCents: z.number().int().positive(),
    description: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1).max(80),
    paymentMethod: z.string().trim().min(1).max(80),
    installmentCount: z.number().int().min(1).max(120).default(1),
    belongsToThirdParty: z.boolean().default(false),
    destinationPaymentMethod: z.string().trim().min(1).max(80).nullable().optional().transform((value) => value ?? undefined),
  }),
  confirm_transaction: z.object({
    draftId: z.string().min(1),
    confirmed: z.literal(true),
  }),
  correct_latest_transaction_draft: z.object({
    amountCents: z.number().int().positive().optional(),
    category: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().min(1).max(200).optional(),
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    paymentMethod: z.string().trim().min(1).max(80).optional(),
    belongsToThirdParty: z.boolean().optional(),
  }).refine((value) => Object.values(value).some((item) => item !== undefined), "Informe pelo menos uma correção."),
  void_latest_transaction_draft: z.object({ confirmedIntent: z.literal(true) }),
  anticipate_installments_draft: z.object({ count: z.number().int().positive().max(120) }),
  query_transaction_history: z.object({ limit: z.number().int().min(1).max(50).default(20) }),
  analyze_spending: z.object({ month: monthSchema }),
  simulate_financial_scenario: z.object({
    month: monthSchema,
    category: z.string().trim().min(1).max(80),
    reductionPercentage: z.number().int().min(0).max(100),
  }),
} as const;

export type ToolName = keyof typeof toolSchemas;
