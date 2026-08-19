import { describe, expect, it } from "vitest";
import {
  analyzeCategorySpending,
  calculateCardStatement,
  calculateMonthlyProjection,
  calculateMonthlySummary,
  createInstallmentSchedule,
  getStatementMonth,
  getStatementDueDate,
  simulateCategoryReduction,
  summarizeInstallments,
  type CreditCardConfig,
  type FinanceTransaction,
} from "./index";

const nubank: CreditCardConfig = {
  id: "nubank",
  name: "Nubank",
  closingDay: 5,
  dueDay: 12,
};

function transaction(
  overrides: Partial<FinanceTransaction> & Pick<FinanceTransaction, "id" | "type" | "amountCents" | "occurredAt">,
): FinanceTransaction {
  return {
    description: overrides.id,
    category: "Outros",
    status: "confirmed",
    ...overrides,
  };
}

describe("credit card statements", () => {
  it("moves purchases after closing day to the next statement", () => {
    expect(getStatementMonth("2026-08-05", nubank)).toBe("2026-08");
    expect(getStatementMonth("2026-08-06", nubank)).toBe("2026-09");
    expect(getStatementMonth("2026-12-20", nubank)).toBe("2027-01");
  });

  it("calculates due dates and clamps them to the last day of short months", () => {
    expect(getStatementDueDate("2026-08", nubank)).toBe("2026-08-12");
    expect(getStatementDueDate("2027-02", { ...nubank, closingDay: 25, dueDay: 31 })).toBe("2027-02-28");
    expect(getStatementDueDate("2026-12", { ...nubank, closingDay: 25, dueDay: 5 })).toBe("2027-01-05");
  });

  it("includes third-party purchases in the invoice and subtracts refunds", () => {
    const transactions = [
      transaction({ id: "personal", type: "expense", amountCents: 10000, occurredAt: "2026-08-03", creditCardId: "nubank" }),
      transaction({ id: "third-party", type: "expense", amountCents: 4000, occurredAt: "2026-08-04", creditCardId: "nubank", belongsToThirdParty: true }),
      transaction({ id: "refund", type: "refund", amountCents: 1500, occurredAt: "2026-08-05", creditCardId: "nubank" }),
      transaction({ id: "after-closing", type: "expense", amountCents: 9000, occurredAt: "2026-08-06", creditCardId: "nubank" }),
      transaction({ id: "pending", type: "expense", amountCents: 8000, occurredAt: "2026-08-02", creditCardId: "nubank", status: "pending" }),
    ];

    const statement = calculateCardStatement(transactions, nubank, "2026-08");

    expect(statement.totalCents).toBe(12500);
    expect(statement.entries.map(({ id }) => id)).toEqual(["personal", "third-party", "refund"]);
  });
});

describe("installment schedule", () => {
  it("preserves every cent and advances statement months across years", () => {
    const schedule = createInstallmentSchedule(10000, 3, "2026-11");
    expect(schedule).toEqual([
      { number: 1, amountCents: 3333, statementMonth: "2026-11" },
      { number: 2, amountCents: 3333, statementMonth: "2026-12" },
      { number: 3, amountCents: 3334, statementMonth: "2027-01" },
    ]);
    expect(summarizeInstallments(schedule, "2026-11")).toEqual({
      statementMonth: "2026-11",
      currentCents: 3333,
      futureCents: 6667,
    });
  });
});

describe("monthly summary", () => {
  it("separates personal and third-party spending without changing the card bill", () => {
    const transactions = [
      transaction({ id: "salary", type: "income", amountCents: 300000, occurredAt: "2026-08-01" }),
      transaction({ id: "market", type: "expense", amountCents: 50000, occurredAt: "2026-08-02", category: "Mercado", creditCardId: "nubank" }),
      transaction({ id: "friend", type: "expense", amountCents: 20000, occurredAt: "2026-08-03", category: "Lazer", creditCardId: "nubank", belongsToThirdParty: true }),
      transaction({ id: "refund", type: "refund", amountCents: 5000, occurredAt: "2026-08-04", category: "Mercado", creditCardId: "nubank" }),
      transaction({ id: "transfer", type: "transfer", amountCents: 100000, occurredAt: "2026-08-04" }),
    ];

    expect(calculateMonthlySummary(transactions, "2026-08", [nubank])).toMatchObject({
      incomeCents: 300000,
      grossPersonalExpensesCents: 50000,
      personalRefundsCents: 5000,
      personalExpensesCents: 45000,
      thirdPartyExpensesCents: 20000,
      netCashFlowCents: 255000,
      invoiceTotalCents: 65000,
    });
  });
});

describe("projections and scenarios", () => {
  it.each([
    [{ month: "2026-09" as const, incomeCents: 500000, fixedExpensesCents: 100000, invoiceCents: 100000, futureInstallmentsCents: 50000 }, "comfortable"],
    [{ month: "2026-09" as const, incomeCents: 500000, fixedExpensesCents: 200000, invoiceCents: 150000, futureInstallmentsCents: 50000 }, "attention"],
    [{ month: "2026-09" as const, incomeCents: 300000, fixedExpensesCents: 200000, invoiceCents: 150000, futureInstallmentsCents: 0 }, "critical"],
  ])("classifies financial health deterministically", (input, status) => {
    expect(calculateMonthlyProjection(input).status).toBe(status);
  });

  it("simulates savings without changing the original values", () => {
    const scenario = simulateCategoryReduction({
      month: "2026-09",
      category: "Delivery",
      currentCategoryCents: 30000,
      currentProjectedBalanceCents: -5000,
      reductionPercentage: 50,
    });

    expect(scenario).toMatchObject({
      savingsCents: 15000,
      adjustedCategoryCents: 15000,
      projectedBalanceCents: 10000,
    });
  });
});

describe("category analysis", () => {
  it("compares the current month with the historical average and ignores third-party spending", () => {
    const transactions = [
      transaction({ id: "june", type: "expense", amountCents: 10000, occurredAt: "2026-06-10", category: "Delivery" }),
      transaction({ id: "july", type: "expense", amountCents: 20000, occurredAt: "2026-07-10", category: "Delivery" }),
      transaction({ id: "august", type: "expense", amountCents: 30000, occurredAt: "2026-08-10", category: "Delivery" }),
      transaction({ id: "friend", type: "expense", amountCents: 50000, occurredAt: "2026-08-11", category: "Delivery", belongsToThirdParty: true }),
      transaction({ id: "refund", type: "refund", amountCents: 2000, occurredAt: "2026-08-12", category: "Delivery" }),
    ];

    expect(analyzeCategorySpending(transactions, "2026-08", ["2026-06", "2026-07"])).toEqual([
      {
        category: "Delivery",
        currentCents: 28000,
        averageCents: 15000,
        differenceCents: 13000,
        potentialSavingsCents: 13000,
        trend: "up",
      },
    ]);
  });
});
