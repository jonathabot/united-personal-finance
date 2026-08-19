import { describe, expect, it } from "vitest";
import { agentRequestSchema, isCapabilityQuestion, isToolAllowed, unsupportedCapabilityMessage } from "./conversation";

describe("agent conversation contract", () => {
  it("accepts a multi-turn conversation ending with the user", () => {
    const result = agentRequestSchema.safeParse({
      threadId: "bb81b72c-c9d9-4f13-9424-46a5bf5c43ee",
      messages: [
        { role: "user", content: "Como estão minhas faturas?" },
        { role: "assistant", content: "Aqui está o resumo." },
        { role: "user", content: "E as parcelas?" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a conversation that does not end with the user", () => {
    const result = agentRequestSchema.safeParse({
      threadId: "bb81b72c-c9d9-4f13-9424-46a5bf5c43ee",
      messages: [{ role: "assistant", content: "Olá" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("unsupported capabilities", () => {
  it("explains a rejected projection instead of asking a generic question", () => {
    expect(unsupportedCapabilityMessage("Vou ficar apertado no mês que vem?"))
      .toContain("dados válidos");
  });
});

describe("capability questions", () => {
  it("recognizes common questions about the agent itself", () => {
    expect(isCapabilityQuestion("O que você pode fazer?")).toBe(true);
    expect(isCapabilityQuestion("Como você pode ajudar?")).toBe(true);
    expect(isCapabilityQuestion("Mostre minhas faturas")).toBe(false);
  });
});

describe("tool intent gate", () => {
  it("does not allow an unrelated message to query invoices", () => {
    expect(isToolAllowed("query_financial_overview", "Teste")).toBe(false);
  });

  it("allows tools only for compatible explicit intents", () => {
    expect(isToolAllowed("query_financial_overview", "Mostre minhas faturas")).toBe(true);
    expect(isToolAllowed("create_transaction_draft", "Gastei 35 reais no almoço")).toBe(true);
    expect(isToolAllowed("create_transaction_draft", "Como vai você?")).toBe(false);
    expect(isToolAllowed("analyze_spending", "Onde estou gastando demais?")).toBe(true);
    expect(isToolAllowed("simulate_financial_scenario", "E se eu reduzir delivery pela metade?")).toBe(true);
  });
});
