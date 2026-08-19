import { describe, expect, it } from "vitest";
import { a2uiPayloadSchema } from "./schema";
import { buildFinancialOverview, buildScenarioComparison, buildSpendingAnalysis } from "./builders";

describe("A2UI financial builders", () => {
  it("builds a validated multi-component overview", () => {
    const payload = buildFinancialOverview("2026-09", {
      month: "2026-09", incomeCents: 480000, committedCents: 377000,
      projectedBalanceCents: 103000, committedIncomePercentage: 78.54, status: "comfortable",
    }, [{ month: "2026-09", incomeCents: 480000, expensesCents: 377000, balanceCents: 103000 }], []);
    expect(a2uiPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("builds validated analysis and scenario payloads", () => {
    const categories = [{ category: "Delivery", currentCents: 36000, averageCents: 20000, potentialSavingsCents: 16000, trend: "up" }];
    expect(a2uiPayloadSchema.safeParse(buildSpendingAnalysis("2026-08", categories)).success).toBe(true);
    expect(a2uiPayloadSchema.safeParse(buildScenarioComparison({ month: "2026-08", category: "Delivery", reductionPercentage: 50, savingsCents: 18000, rows: [] })).success).toBe(true);
  });
});
