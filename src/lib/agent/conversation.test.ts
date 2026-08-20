import { describe, expect, it } from "vitest";
import { agentRequestSchema, inferToolFromIntent, isCapabilityQuestion, isToolAllowed, unsupportedCapabilityMessage } from "./conversation";

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
    expect(isToolAllowed("create_transaction_draft", "Lazer, gasto com sorvete")).toBe(true);
    expect(isToolAllowed("create_transaction_draft", "Crie mais uma transação no Nubank")).toBe(true);
    expect(isToolAllowed("create_transaction_draft", "Adicione cinco despesas")).toBe(true);
    expect(isToolAllowed("create_transaction_draft", "Como vai você?")).toBe(false);
    expect(isToolAllowed("analyze_spending", "Onde estou gastando demais?")).toBe(true);
    expect(isToolAllowed("simulate_financial_scenario", "E se eu reduzir delivery pela metade?")).toBe(true);
    expect(isToolAllowed("query_financial_overview", "Vou ficar apertado no próximo mês?")).toBe(true);
    expect(isToolAllowed("create_financial_entity_draft", "Meu salário é R$ 3.530")).toBe(true);
    expect(isToolAllowed("rename_financial_entity_draft", "Mude o nome de CLT para Custos de empréstimos")).toBe(true);
    expect(isToolAllowed("confirm_financial_change", "Confirmar")).toBe(true);
    expect(isToolAllowed("create_financial_entity_draft", "Adicione internet de R$ 120 aos gastos fixos a partir de agosto de 2026 todo dia 18")).toBe(true);
    expect(isToolAllowed("correct_latest_transaction_draft", "Na verdade foram R$ 25")).toBe(true);
    expect(isToolAllowed("correct_latest_transaction_draft", "Mude a categoria para Vestuário")).toBe(true);
    expect(isToolAllowed("void_latest_transaction_draft", "Desfaça o último lançamento")).toBe(true);
    expect(isToolAllowed("create_transaction_draft", "Recebi R$ 500 de freelance")).toBe(true);
    expect(isToolAllowed("create_transaction_draft", "Recebi um estorno no Nubank")).toBe(true);
    expect(isToolAllowed("anticipate_installments_draft", "Antecipe as duas últimas parcelas")).toBe(true);
    expect(isToolAllowed("query_transaction_history", "Mostre meu histórico")).toBe(true);
  });

  it("recovers the intended tool when the model selects an incompatible one", () => {
    expect(inferToolFromIntent("Vou ficar apertado no próximo mês?")).toBe("query_financial_overview");
    expect(inferToolFromIntent("Compare agosto com setembro de 2026")).toBe("compare_financial_months");
    expect(inferToolFromIntent("Onde estou gastando mais?")).toBe("analyze_spending");
    expect(inferToolFromIntent("Mude o nome de CLT para Custos de empréstimos")).toBe("rename_financial_entity_draft");
    expect(inferToolFromIntent("Na verdade foram R$ 25")).toBe("correct_latest_transaction_draft");
    expect(inferToolFromIntent("Desfaça o último lançamento")).toBe("void_latest_transaction_draft");
    expect(inferToolFromIntent("Antecipe as últimas 2 parcelas")).toBe("anticipate_installments_draft");
    expect(inferToolFromIntent("Mostre meu histórico")).toBe("query_transaction_history");
  });
});
