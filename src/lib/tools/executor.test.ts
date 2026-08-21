import { describe, expect, it, vi } from "vitest";
import { a2uiPayloadSchema } from "../a2ui/schema";
import { executeAgentTool } from "./executor";
import { demoFinancialRepository, type FinancialRepository } from "../repositories";

function componentNames(result: Awaited<ReturnType<typeof executeAgentTool>>) {
  return result.ui?.find((message) => message.kind === "updateComponents")?.components.map((component) => component.component) ?? [];
}

describe("agent tool executor", () => {
  it("returns a deterministic overview calculated from demo data", async () => {
    const result = await executeAgentTool("query_financial_overview", { month: "2026-08" });

    expect(result.text).toContain("R$\u00a01.545,00");
    expect(result.text).toContain("confortável");
    expect(a2uiPayloadSchema.safeParse(result.ui).success).toBe(true);
    expect(componentNames(result)).toEqual(["FinancialHealthCard", "ProjectionChart", "FinanceDataTable", "FinanceDataTable"]);
    expect(JSON.stringify(result.ui)).toContain("Premissas do cálculo");
  });

  it("distinguishes recorded net spending from projected commitments", async () => {
    const result = await executeAgentTool("query_financial_overview", { month: "2026-08" });

    expect(result.text).toContain("gastos líquidos registrados");
    expect(result.text).toContain("compromissos projetados");
  });

  it("finds category opportunities from historical data", async () => {
    const result = await executeAgentTool("analyze_spending", { month: "2026-08" });

    expect(result.text).toContain("Delivery");
    expect(result.text).toContain("R$\u00a0160,00");
    expect(a2uiPayloadSchema.safeParse(result.ui).success).toBe(true);
    expect(componentNames(result)).toEqual(["CategoryBreakdown", "SavingsOpportunityTable", "FinanceDataTable"]);
    expect(JSON.stringify(result.ui)).toContain("Premissas da comparação");
  });

  it("reports insufficient history when both baseline months have no spending", async () => {
    const repository: FinancialRepository = {
      getDataset: async () => ({
        cards: [],
        transactions: [{
          id: "current", type: "expense", amountCents: 33000, occurredAt: "2026-08-10",
          description: "Cadeira", category: "Casa", status: "confirmed",
        }],
        projections: [],
      }),
      createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: async () => { throw new Error(); }, createCloseDraft: async () => { throw new Error(); },
      cancelLatestDraft: async () => { throw new Error(); }, confirmLatestDraft: async () => { throw new Error(); },
    };

    const result = await executeAgentTool("analyze_spending", { month: "2026-08" }, repository);

    expect(result.text).toContain("Não há histórico suficiente");
    expect(result.text).not.toContain("Não encontrei gastos acima da média");
  });

  it("simulates a reduction using the financial engine", async () => {
    const result = await executeAgentTool("simulate_financial_scenario", {
      month: "2026-08",
      category: "delivery",
      reductionPercentage: 50,
    });

    expect(result.text).toContain("R$\u00a0180,00");
    expect(result.text).toContain("R$\u00a01.385,00");
    expect(componentNames(result)).toEqual(["ScenarioComparison"]);
  });

  it("rejects invalid tool arguments before executing calculations", async () => {
    await expect(executeAgentTool("query_financial_overview", { month: "agosto" })).rejects.toThrow();
    await expect(executeAgentTool("simulate_financial_scenario", { month: "2026-08", category: "Delivery", reductionPercentage: 150 })).rejects.toThrow();
  });

  it("persists a transaction draft and confirms it through the repository", async () => {
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: async () => { throw new Error(); }, createCloseDraft: async () => { throw new Error(); },
      createTransactionDraft: vi.fn(async () => ({ id: "12345678-0000-0000-0000-000000000000", action: "create_transaction" as const, payload: {} })),
      cancelLatestDraft: async () => undefined,
      confirmLatestDraft: vi.fn(async () => ({ action: "create_transaction", referenceId: "87654321-0000-0000-0000-000000000000" })),
    };
    const draft = await executeAgentTool("create_transaction_draft", {
      amountCents: 3500, description: "Almoço", category: "Alimentação", paymentMethod: "Nubank",
    }, repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(repository.createTransactionDraft).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 3500, occurredOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }), "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(componentNames(draft)).toEqual(["TransactionConfirmation"]);
    const confirmed = await executeAgentTool("confirm_transaction", { draftId: "12345678-0000-0000-0000-000000000000", confirmed: true }, repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(confirmed.text).toContain("Despesa confirmada e salva");
  });

  it("preserves installment count in the persistent draft and confirmation card", async () => {
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: async () => { throw new Error(); }, createCloseDraft: async () => { throw new Error(); },
      createTransactionDraft: vi.fn(async () => ({ id: "12345678-0000-0000-0000-000000000000", action: "create_transaction" as const, payload: {} })),
      cancelLatestDraft: async () => undefined, confirmLatestDraft: async () => { throw new Error(); },
    };
    const result = await executeAgentTool("create_transaction_draft", {
      amountCents: 10000, description: "Tênis", category: "Vestuário", paymentMethod: "Nubank", installmentCount: 3,
    }, repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(repository.createTransactionDraft).toHaveBeenCalledWith(expect.objectContaining({ installmentCount: 3 }), expect.any(String));
    const data = result.ui?.find((message) => message.kind === "updateDataModel")?.data.transaction as { installmentCount: number };
    expect(data.installmentCount).toBe(3);
  });

  it("asks for a category instead of persisting a placeholder", async () => {
    const repository = { ...demoFinancialRepository, createTransactionDraft: vi.fn() };
    const result = await executeAgentTool("create_transaction_draft", {
      amountCents: 10000, description: "Compra", category: "?", paymentMethod: "Nubank", installmentCount: 3,
    }, repository);
    expect(repository.createTransactionDraft).not.toHaveBeenCalled();
    expect(result.text).toContain("confirmar a categoria");
    expect(componentNames(result)).toEqual(["ClarificationCard"]);
  });

  it("prepares an auditable correction of the latest confirmed transaction", async () => {
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: async () => { throw new Error(); }, createCloseDraft: async () => { throw new Error(); },
      createTransactionCorrectionDraft: vi.fn(async () => ({ id: "1", action: "update_transaction" as const, payload: {
        description: "Tênis", previousAmountCents: 10000, amountCents: 12000, previousCategory: "?", category: "Vestuário",
      } })),
      cancelLatestDraft: async () => undefined, confirmLatestDraft: async () => { throw new Error(); },
    };
    const result = await executeAgentTool("correct_latest_transaction_draft", { amountCents: 12000, category: "Vestuário" }, repository);
    expect(repository.createTransactionCorrectionDraft).toHaveBeenCalled();
    expect(result.text).toContain("ainda não foi aplicada");
    expect(componentNames(result)).toEqual(["FinancialChangeConfirmation"]);
  });

  it("shows both payment methods in a payment correction preview", async () => {
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: async () => { throw new Error(); }, createCloseDraft: async () => { throw new Error(); },
      createTransactionCorrectionDraft: async () => ({ id: "1", action: "update_transaction", payload: {
        description: "Cadeira", previousEntityId: "nubank", entityId: "itau",
        previousPaymentMethod: "Nubank", paymentMethod: "Itaú",
      } }), cancelLatestDraft: async () => undefined, confirmLatestDraft: async () => { throw new Error(); },
    };
    const result = await executeAgentTool("correct_latest_transaction_draft", { paymentMethod: "Itaú" }, repository);
    expect(JSON.stringify(result.ui)).toContain("Meio anterior");
    expect(JSON.stringify(result.ui)).toContain("Nubank");
    expect(JSON.stringify(result.ui)).toContain("Itaú");
  });

  it("prepares logical voiding without deleting the transaction", async () => {
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: async () => { throw new Error(); }, createCloseDraft: async () => { throw new Error(); },
      createTransactionVoidDraft: vi.fn(async () => ({ id: "2", action: "void_transaction" as const, payload: { description: "Tênis", amountCents: 10000, category: "Vestuário" } })),
      cancelLatestDraft: async () => undefined, confirmLatestDraft: async () => { throw new Error(); },
    };
    const result = await executeAgentTool("void_latest_transaction_draft", { confirmedIntent: true }, repository);
    expect(repository.createTransactionVoidDraft).toHaveBeenCalled();
    expect(result.text).toContain("continua válido");
    expect(componentNames(result)).toEqual(["FinancialChangeConfirmation"]);
  });

  it.each([
    { type: "expense", belongsToThirdParty: true, description: "Jantar do irmão", destinationPaymentMethod: null },
    { type: "refund", belongsToThirdParty: false, description: "Estorno do jantar" },
    { type: "income", belongsToThirdParty: false, description: "Freelance" },
    { type: "transfer", belongsToThirdParty: false, description: "Transferência", destinationPaymentMethod: "Reserva" },
  ] as const)("creates a confirmable $type draft", async (input) => {
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: async () => { throw new Error(); }, createCloseDraft: async () => { throw new Error(); },
      createTransactionDraft: vi.fn(async () => ({ id: "12345678-0000-0000-0000-000000000000", action: "create_transaction" as const, payload: {} })),
      cancelLatestDraft: async () => undefined, confirmLatestDraft: async () => { throw new Error(); },
    };
    const result = await executeAgentTool("create_transaction_draft", { ...input, amountCents: 8000, category: "Outros", paymentMethod: "Nubank", installmentCount: 1 }, repository);
    expect(repository.createTransactionDraft).toHaveBeenCalledWith(expect.objectContaining({ type: input.type, belongsToThirdParty: input.belongsToThirdParty }), expect.any(String));
    expect(componentNames(result)).toEqual(["TransactionConfirmation"]);
  });

  it("explains when the requested account does not exist", async () => {
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: async () => { throw new Error(); }, createCloseDraft: async () => { throw new Error(); },
      createTransactionDraft: async () => { throw new Error("ENTITY_NOT_FOUND:Conta Corrente"); },
      cancelLatestDraft: async () => undefined, confirmLatestDraft: async () => { throw new Error(); },
    };
    const result = await executeAgentTool("create_transaction_draft", {
      type: "income", amountCents: 50000, description: "Freelance", category: "Receita",
      paymentMethod: "Conta Corrente", installmentCount: 1, belongsToThirdParty: false,
    }, repository);
    expect(result.text).toContain("Não encontrei Conta Corrente");
    expect(componentNames(result)).toEqual(["ClarificationCard"]);
  });

  it("prepares installment anticipation and renders its total", async () => {
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: async () => { throw new Error(); }, createCloseDraft: async () => { throw new Error(); },
      createInstallmentAnticipationDraft: vi.fn(async () => ({ id: "1", action: "anticipate_installments" as const, payload: {
        description: "Tênis", count: 2, targetStatementMonth: "2026-09", installments: [{ amountCents: 4000 }, { amountCents: 4000 }],
      } })), cancelLatestDraft: async () => undefined, confirmLatestDraft: async () => { throw new Error(); },
    };
    const result = await executeAgentTool("anticipate_installments_draft", { count: 2 }, repository);
    expect(result.text).toContain("cronograma original");
    expect(componentNames(result)).toEqual(["FinancialChangeConfirmation"]);
  });

  it("renders recent transaction history from persisted rows", async () => {
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      getRecentTransactions: async () => [{ id: "1", type: "expense", amountCents: 3500, occurredOn: "2026-08-19", description: "Almoço", category: "Alimentação", paymentMethod: "Nubank", status: "confirmed" }],
      createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: async () => { throw new Error(); }, createCloseDraft: async () => { throw new Error(); },
      cancelLatestDraft: async () => undefined, confirmLatestDraft: async () => { throw new Error(); },
    };
    const result = await executeAgentTool("query_transaction_history", { limit: 20 }, repository);
    expect(result.text).toContain("1 lançamentos");
    expect(componentNames(result)).toEqual(["FinanceDataTable"]);
  });

  it("uses a clarification card when the requested category has no data", async () => {
    const result = await executeAgentTool("simulate_financial_scenario", { month: "2026-08", category: "Viagens", reductionPercentage: 20 });
    expect(componentNames(result)).toEqual(["ClarificationCard"]);
  });

  it("uses a controlled error card when projection premises are unavailable", async () => {
    const result = await executeAgentTool("query_financial_overview", { month: "2026-07" });
    expect(componentNames(result)).toEqual(["ErrorCard"]);
  });

  it("shows onboarding for a new authenticated account instead of demo values", async () => {
    const emptyRepository: FinancialRepository = { getDataset: async () => ({ cards: [], transactions: [], projections: [
      { month: "2026-08", incomeCents: 0, fixedExpensesCents: 0, invoiceCents: 0, futureInstallmentsCents: 0 },
    ] }), createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); }, createValueChangeDraft: async () => { throw new Error(); }, createCloseDraft: async () => { throw new Error(); }, cancelLatestDraft: async () => { throw new Error(); }, confirmLatestDraft: async () => { throw new Error(); } };
    const result = await executeAgentTool("query_financial_overview", { month: "2026-08" }, emptyRepository);
    expect(result.text).toContain("ainda não possui dados");
    expect(result.text).not.toContain("R$");
    expect(componentNames(result)).toEqual(["ClarificationCard"]);
  });

  it("creates and confirms a persistent financial entity draft through the repository", async () => {
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: vi.fn(async () => ({ id: "12345678-0000-0000-0000-000000000000", action: "create_entity" as const, payload: {} })),
      createRenameDraft: vi.fn(async () => { throw new Error(); }),
      createValueChangeDraft: vi.fn(async () => { throw new Error(); }),
      createCloseDraft: vi.fn(async () => { throw new Error(); }),
      cancelLatestDraft: vi.fn(async () => { throw new Error(); }),
      confirmLatestDraft: vi.fn(async () => ({ action: "create_entity", referenceId: "87654321-0000-0000-0000-000000000000" })),
    };
    const draft = await executeAgentTool("create_financial_entity_draft", { kind: "income", name: "Salário", amountCents: 353000, effectiveFrom: "2026-08" }, repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(repository.createEntityDraft).toHaveBeenCalled();
    expect(componentNames(draft)).toEqual(["FinancialChangeConfirmation"]);
    const confirmed = await executeAgentTool("confirm_financial_change", { confirmed: true }, repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(repository.confirmLatestDraft).toHaveBeenCalledWith("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(confirmed.text).toContain("salva com segurança");
  });

  it("creates temporal value and close drafts and can cancel safely", async () => {
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }), createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: vi.fn(async () => ({ id: "11111111-0000-0000-0000-000000000000", action: "update_value" as const, payload: {} })),
      createCloseDraft: vi.fn(async () => ({ id: "22222222-0000-0000-0000-000000000000", action: "close_entity" as const, payload: {} })),
      cancelLatestDraft: vi.fn(async () => undefined), confirmLatestDraft: async () => { throw new Error(); },
    };
    const changed = await executeAgentTool("change_financial_entity_value_draft", { name: "Salário", amountCents: 400000, effectiveFrom: "2026-10" }, repository);
    expect(changed.text).toContain("histórico anterior");
    const closed = await executeAgentTool("close_financial_entity_draft", { name: "Nubank", inactiveFrom: "2026-09", status: "settled" }, repository);
    expect(closed.text).toContain("meses anteriores");
    const cancelled = await executeAgentTool("cancel_financial_change", { cancelled: true }, repository);
    expect(cancelled.text).toContain("Nenhum dado");
  });
});
