import { dateMonth } from "./calendar";
import { calculateCardStatement } from "./statements";
import type { CreditCardConfig, FinanceTransaction, MonthKey } from "./types";

export function calculateMonthlySummary(
  transactions: readonly FinanceTransaction[],
  month: MonthKey,
  cards: readonly CreditCardConfig[] = [],
) {
  const confirmed = transactions.filter((transaction) =>
    transaction.status === "confirmed" && dateMonth(transaction.occurredAt) === month);

  const incomeCents = confirmed
    .filter((transaction) => transaction.type === "income" && !transaction.belongsToThirdParty)
    .reduce((total, transaction) => total + transaction.amountCents, 0);
  const grossPersonalExpensesCents = confirmed
    .filter((transaction) => transaction.type === "expense" && !transaction.belongsToThirdParty)
    .reduce((total, transaction) => total + transaction.amountCents, 0);
  const personalRefundsCents = confirmed
    .filter((transaction) => transaction.type === "refund" && !transaction.belongsToThirdParty)
    .reduce((total, transaction) => total + transaction.amountCents, 0);
  const thirdPartyExpensesCents = confirmed
    .filter((transaction) => transaction.type === "expense" && transaction.belongsToThirdParty)
    .reduce((total, transaction) => total + transaction.amountCents, 0);
  const statements = cards.map((card) => calculateCardStatement(transactions, card, month));

  return {
    month,
    incomeCents,
    grossPersonalExpensesCents,
    personalRefundsCents,
    personalExpensesCents: grossPersonalExpensesCents - personalRefundsCents,
    thirdPartyExpensesCents,
    netCashFlowCents: incomeCents - grossPersonalExpensesCents + personalRefundsCents,
    invoiceTotalCents: statements.reduce((total, statement) => total + statement.totalCents, 0),
    statements,
  };
}

