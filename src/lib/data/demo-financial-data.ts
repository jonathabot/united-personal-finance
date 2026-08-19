import type { CreditCardConfig, FinanceTransaction, MonthlyProjectionInput } from "../finance";

export const demoCards: CreditCardConfig[] = [
  { id: "itau", name: "Itaú", closingDay: 2, dueDay: 10 },
  { id: "nubank", name: "Nubank", closingDay: 8, dueDay: 15 },
];

export const demoTransactions: FinanceTransaction[] = [
  { id: "salary-jun", type: "income", amountCents: 480000, occurredAt: "2026-06-05", description: "Salário", category: "Renda", status: "confirmed" },
  { id: "rent-jun", type: "expense", amountCents: 145000, occurredAt: "2026-06-05", description: "Aluguel", category: "Moradia", status: "confirmed" },
  { id: "delivery-jun", type: "expense", amountCents: 18000, occurredAt: "2026-06-12", description: "Delivery", category: "Delivery", creditCardId: "nubank", status: "confirmed" },
  { id: "market-jun", type: "expense", amountCents: 52000, occurredAt: "2026-06-18", description: "Supermercado", category: "Mercado", creditCardId: "itau", status: "confirmed" },
  { id: "salary-jul", type: "income", amountCents: 480000, occurredAt: "2026-07-05", description: "Salário", category: "Renda", status: "confirmed" },
  { id: "rent-jul", type: "expense", amountCents: 145000, occurredAt: "2026-07-05", description: "Aluguel", category: "Moradia", status: "confirmed" },
  { id: "delivery-jul", type: "expense", amountCents: 22000, occurredAt: "2026-07-12", description: "Delivery", category: "Delivery", creditCardId: "nubank", status: "confirmed" },
  { id: "market-jul", type: "expense", amountCents: 56000, occurredAt: "2026-07-18", description: "Supermercado", category: "Mercado", creditCardId: "itau", status: "confirmed" },
  { id: "salary-aug", type: "income", amountCents: 480000, occurredAt: "2026-08-05", description: "Salário", category: "Renda", status: "confirmed" },
  { id: "rent-aug", type: "expense", amountCents: 145000, occurredAt: "2026-08-05", description: "Aluguel", category: "Moradia", status: "confirmed" },
  { id: "delivery-aug", type: "expense", amountCents: 36000, occurredAt: "2026-08-06", description: "Delivery", category: "Delivery", creditCardId: "nubank", status: "confirmed" },
  { id: "market-aug", type: "expense", amountCents: 61000, occurredAt: "2026-08-07", description: "Supermercado", category: "Mercado", creditCardId: "itau", status: "confirmed" },
  { id: "transport-aug", type: "expense", amountCents: 28500, occurredAt: "2026-08-07", description: "Transporte", category: "Transporte", creditCardId: "nubank", status: "confirmed" },
  { id: "friend-aug", type: "expense", amountCents: 12000, occurredAt: "2026-08-08", description: "Compra para terceiro", category: "Outros", creditCardId: "nubank", belongsToThirdParty: true, status: "confirmed" },
  { id: "refund-aug", type: "refund", amountCents: 5000, occurredAt: "2026-08-08", description: "Estorno mercado", category: "Mercado", creditCardId: "itau", status: "confirmed" },
  { id: "salary-sep", type: "income", amountCents: 480000, occurredAt: "2026-09-05", description: "Salário", category: "Renda", status: "confirmed" },
  { id: "installment-sep", type: "expense", amountCents: 42000, occurredAt: "2026-08-12", description: "Notebook 2/6", category: "Eletrônicos", creditCardId: "nubank", status: "confirmed" },
];

export const demoProjections: MonthlyProjectionInput[] = [
  { month: "2026-08", incomeCents: 480000, fixedExpensesCents: 185000, invoiceCents: 132500, futureInstallmentsCents: 42000 },
  { month: "2026-09", incomeCents: 480000, fixedExpensesCents: 185000, invoiceCents: 108000, futureInstallmentsCents: 84000 },
  { month: "2026-10", incomeCents: 480000, fixedExpensesCents: 185000, invoiceCents: 95000, futureInstallmentsCents: 126000 },
];
