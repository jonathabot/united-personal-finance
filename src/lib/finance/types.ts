export type MonthKey = `${number}-${string}`;
export type TransactionType = "expense" | "income" | "refund" | "transfer";

export type FinanceTransaction = {
  id: string;
  type: TransactionType;
  amountCents: number;
  occurredAt: string;
  description: string;
  category: string;
  accountId?: string;
  creditCardId?: string;
  belongsToThirdParty?: boolean;
  status: "pending" | "confirmed" | "voided";
};

export type CreditCardConfig = {
  id: string;
  name: string;
  closingDay: number;
  dueDay: number;
};

export type Installment = {
  number: number;
  amountCents: number;
  statementMonth: MonthKey;
};

export type MonthlyProjectionInput = {
  month: MonthKey;
  incomeCents: number;
  fixedExpensesCents: number;
  invoiceCents: number;
  futureInstallmentsCents: number;
};

export function assertCents(value: number, field = "value") {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer number of cents.`);
  }
}

