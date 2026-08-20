import { addMonths, dateMonth, parseLocalDate, parseMonth } from "./calendar";
import type { CreditCardConfig, FinanceTransaction, MonthKey, PersistedInstallment } from "./types";

function assertCardDays(card: CreditCardConfig) {
  if (!Number.isSafeInteger(card.closingDay) || card.closingDay < 1 || card.closingDay > 31) {
    throw new RangeError("Card closing day must be between 1 and 31.");
  }
  if (!Number.isSafeInteger(card.dueDay) || card.dueDay < 1 || card.dueDay > 31) {
    throw new RangeError("Card due day must be between 1 and 31.");
  }
}

export function getStatementMonth(occurredAt: string, card: CreditCardConfig): MonthKey {
  assertCardDays(card);
  const { day } = parseLocalDate(occurredAt);
  const purchaseMonth = dateMonth(occurredAt);
  return day > card.closingDay ? addMonths(purchaseMonth, 1) : purchaseMonth;
}

export function getStatementDueDate(statementMonth: MonthKey, card: CreditCardConfig): string {
  assertCardDays(card);
  const dueMonth = card.dueDay <= card.closingDay ? addMonths(statementMonth, 1) : statementMonth;
  const { year, month } = parseMonth(dueMonth);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(card.dueDay, lastDay);
  return `${dueMonth}-${String(day).padStart(2, "0")}`;
}

export function signedInvoiceAmount(transaction: FinanceTransaction) {
  if (transaction.type === "refund") return -transaction.amountCents;
  if (transaction.type === "expense") return transaction.amountCents;
  return 0;
}

export function calculateCardStatement(
  transactions: readonly FinanceTransaction[],
  card: CreditCardConfig,
  statementMonth: MonthKey,
  installments: readonly PersistedInstallment[] = [],
) {
  const installmentTransactionIds = new Set(installments.map((item) => item.transactionId));
  const entries = transactions.filter((transaction) =>
    transaction.status === "confirmed" &&
    transaction.creditCardId === card.id &&
    !installmentTransactionIds.has(transaction.id) &&
    getStatementMonth(transaction.occurredAt, card) === statementMonth &&
    (transaction.type === "expense" || transaction.type === "refund"));
  const installmentEntries = installments.filter((item) => item.entityId === card.id && item.statementMonth === statementMonth && item.status !== "voided");
  return {
    cardId: card.id,
    statementMonth,
    dueDate: getStatementDueDate(statementMonth, card),
    totalCents: entries.reduce((total, transaction) => total + signedInvoiceAmount(transaction), 0) + installmentEntries.reduce((total, item) => total + item.amountCents, 0),
    entries,
    installmentEntries,
  };
}
