import { describe, expect, it } from "vitest";
import { a2uiPayloadSchema } from "../a2ui/schema";
import { executeAgentTool } from "./executor";

function componentNames(result: ReturnType<typeof executeAgentTool>) {
  return result.ui?.find((message) => message.kind === "updateComponents")?.components.map((component) => component.component) ?? [];
}

describe("agent tool executor", () => {
  it("returns a deterministic overview calculated from demo data", () => {
    const result = executeAgentTool("query_financial_overview", { month: "2026-08" });

    expect(result.text).toContain("R$\u00a01.545,00");
    expect(result.text).toContain("confortável");
    expect(a2uiPayloadSchema.safeParse(result.ui).success).toBe(true);
    expect(componentNames(result)).toEqual(["FinancialHealthCard", "ProjectionChart", "FinanceDataTable"]);
  });

  it("finds category opportunities from historical data", () => {
    const result = executeAgentTool("analyze_spending", { month: "2026-08" });

    expect(result.text).toContain("Delivery");
    expect(result.text).toContain("R$\u00a0160,00");
    expect(a2uiPayloadSchema.safeParse(result.ui).success).toBe(true);
    expect(componentNames(result)).toEqual(["CategoryBreakdown", "SavingsOpportunityTable"]);
  });

  it("simulates a reduction using the financial engine", () => {
    const result = executeAgentTool("simulate_financial_scenario", {
      month: "2026-08",
      category: "delivery",
      reductionPercentage: 50,
    });

    expect(result.text).toContain("R$\u00a0180,00");
    expect(result.text).toContain("R$\u00a01.385,00");
    expect(componentNames(result)).toEqual(["ScenarioComparison"]);
  });

  it("rejects invalid tool arguments before executing calculations", () => {
    expect(() => executeAgentTool("query_financial_overview", { month: "agosto" })).toThrow();
    expect(() => executeAgentTool("simulate_financial_scenario", { month: "2026-08", category: "Delivery", reductionPercentage: 150 })).toThrow();
  });

  it("does not claim persistence when confirming a draft", () => {
    const result = executeAgentTool("confirm_transaction", { draftId: "draft-1", confirmed: true });
    expect(result.text).toContain("não foi salvo");
  });

  it("uses a clarification card when the requested category has no data", () => {
    const result = executeAgentTool("simulate_financial_scenario", { month: "2026-08", category: "Viagens", reductionPercentage: 20 });
    expect(componentNames(result)).toEqual(["ClarificationCard"]);
  });

  it("uses a controlled error card when projection premises are unavailable", () => {
    const result = executeAgentTool("query_financial_overview", { month: "2026-07" });
    expect(componentNames(result)).toEqual(["ErrorCard"]);
  });
});
