import { afterEach, describe, expect, it, vi } from "vitest";
import { runAgent } from "./runtime";
import type { FinancialRepository } from "../repositories";

const groqCreateMock = vi.hoisted(() => vi.fn());

vi.mock("groq-sdk", () => ({
  default: class MockGroq {
    chat = { completions: { create: groqCreateMock } };
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  groqCreateMock.mockReset();
});

function analyticalRepository(): FinancialRepository {
  return {
    getDataset: async () => ({
      cards: [],
      transactions: [],
      projections: [
        { month: "2026-08", incomeCents: 403000, fixedExpensesCents: 12000, invoiceCents: 11000, futureInstallmentsCents: 0 },
        { month: "2026-09", incomeCents: 353000, fixedExpensesCents: 12000, invoiceCents: 55000, futureInstallmentsCents: 0 },
        { month: "2026-10", incomeCents: 400000, fixedExpensesCents: 12000, invoiceCents: 21000, futureInstallmentsCents: 0 },
      ],
    }),
    createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); },
    createValueChangeDraft: async () => { throw new Error(); }, createCloseDraft: async () => { throw new Error(); },
    cancelLatestDraft: async () => { throw new Error(); }, confirmLatestDraft: async () => { throw new Error(); },
  };
}

describe("demo agent tool routing", () => {
  it("compares two named months without model arithmetic", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const result = await runAgent([{ role: "user", content: "Compare agosto com setembro de 2026" }]);
    expect(result.text).toContain("2026-08");
    expect(result.text).toContain("2026-09");
    expect(result.text).toContain("saldo projetado");
  });

  it("continues the latest comparison when the user asks about another month", async () => {
    vi.stubEnv("GROQ_API_KEY", "not-used");
    const result = await runAgent([
      { role: "user", content: "Compare agosto com setembro de 2026" },
      { role: "assistant", content: "De 2026-08 para 2026-09, o saldo projetado diminui em R$ 940,00." },
      { role: "user", content: "E outubro?" },
    ], analyticalRepository());

    expect(result.text).toContain("De 2026-09 para 2026-10");
    expect(result.text).toContain("R$\u00a0810,00");
    expect(groqCreateMock).not.toHaveBeenCalled();
  });

  it("explains the latest comparison with reconciled engine deltas", async () => {
    vi.stubEnv("GROQ_API_KEY", "not-used");
    const result = await runAgent([
      { role: "user", content: "E se eu reduzir Eletrônicos em 50%?" },
      { role: "assistant", content: "Reduzindo Eletrônicos em 50%, o saldo passa de R$ 3.800,00 para R$ 4.100,00." },
      { role: "user", content: "Compare agosto com setembro de 2026" },
      { role: "assistant", content: "De 2026-08 para 2026-09, o saldo projetado diminui em R$ 940,00." },
      { role: "user", content: "Por que piorou?" },
    ], analyticalRepository());

    expect(result.text).toContain("De 2026-08 para 2026-09");
    expect(result.text).toContain("receita diminuiu em R$\u00a0500,00");
    expect(result.text).toContain("compromissos aumentaram em R$\u00a0440,00");
    expect(result.text).toContain("saldo projetado piorou em R$\u00a0940,00");
    expect(result.text).not.toContain("Eletrônicos");
    expect(groqCreateMock).not.toHaveBeenCalled();
  });

  it("corrects a false premise about the direction of the latest comparison", async () => {
    vi.stubEnv("GROQ_API_KEY", "not-used");
    const result = await runAgent([
      { role: "user", content: "Compare setembro com outubro de 2026" },
      { role: "assistant", content: "De 2026-09 para 2026-10, o saldo projetado aumenta em R$ 810,00." },
      { role: "user", content: "Por que piorou?" },
    ], analyticalRepository());

    expect(result.text).toContain("Na verdade, de 2026-09 para 2026-10");
    expect(result.text).toContain("saldo projetado melhorou em R$\u00a0810,00");
    expect(groqCreateMock).not.toHaveBeenCalled();
  });

  it("converts unstructured model replies to plain text", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    groqCreateMock.mockResolvedValue({
      choices: [{ message: { content: "Em **agosto**, o `saldo` ficou confortável.", tool_calls: [] } }],
    });

    const result = await runAgent([{ role: "user", content: "Explique isso em outras palavras" }], analyticalRepository());

    expect(result.text).toBe("Em agosto, o saldo ficou confortável.");
  });

  it("routes next-month questions to the financial overview", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const result = await runAgent([{ role: "user", content: "Vou ficar apertado no próximo mês?" }]);

    expect(result.provider).toBe("demo");
    expect(result.text).toContain("2026-09");
    expect(result.text).toContain("saldo projetado");
    expect(result.ui).toBeDefined();
  });

  it("routes savings questions to category analysis", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const result = await runAgent([{ role: "user", content: "No que posso economizar?" }]);

    expect(result.text).toContain("Delivery");
    expect(result.ui).toBeDefined();
  });

  it("routes hypothetical questions to scenario simulation", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const result = await runAgent([{ role: "user", content: "E se eu reduzir delivery pela metade?" }]);

    expect(result.text).toContain("50%");
    expect(result.text).toContain("economia estimada");
  });

  it("confirms a pending financial change without depending on model tool selection", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: async () => { throw new Error(); },
      createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: async () => { throw new Error(); },
      createCloseDraft: async () => { throw new Error(); },
      cancelLatestDraft: async () => { throw new Error(); },
      confirmLatestDraft: vi.fn(async () => ({ action: "create_entity", referenceId: "12345678-0000-0000-0000-000000000000" })),
    };
    const result = await runAgent([{ role: "user", content: "confirmar" }], repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(repository.confirmLatestDraft).toHaveBeenCalledWith("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(result.text).toContain("salva com segurança");
  });

  it("creates a complete fixed-expense draft without depending on Groq nullable arguments", async () => {
    vi.stubEnv("GROQ_API_KEY", "not-used");
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: vi.fn(async () => ({ id: "12345678-0000-0000-0000-000000000000", action: "create_entity" as const, payload: {} })),
      createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: async () => { throw new Error(); },
      createCloseDraft: async () => { throw new Error(); },
      cancelLatestDraft: async () => { throw new Error(); },
      confirmLatestDraft: async () => { throw new Error(); },
    };

    const result = await runAgent([{ role: "user", content: "Adicione internet de R$ 120 aos gastos fixos, com vencimento dia 18, a partir de agosto de 2026." }], repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    expect(repository.createEntityDraft).toHaveBeenCalledWith({
      kind: "fixed_expense", name: "Internet", amountCents: 12000,
      effectiveFrom: "2026-08", dueDay: 18,
    }, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(result.text).toContain("ainda não foi aplicada");
  });

  it("always classifies 'cadastre uma conta' as an account", async () => {
    vi.stubEnv("GROQ_API_KEY", "not-used");
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: vi.fn(async () => ({ id: "12345678-0000-0000-0000-000000000000", action: "create_entity" as const, payload: {} })),
      createRenameDraft: async () => { throw new Error(); }, createValueChangeDraft: async () => { throw new Error(); },
      createCloseDraft: async () => { throw new Error(); }, cancelLatestDraft: async () => { throw new Error(); }, confirmLatestDraft: async () => { throw new Error(); },
    };
    await runAgent([{ role: "user", content: "Cadastre uma conta chamada Conta Reserva" }], repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(repository.createEntityDraft).toHaveBeenCalledWith({ kind: "account", name: "Conta Reserva", effectiveFrom: "2026-08" }, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  });

  it("routes a salary increase with temporal validity without calling Groq", async () => {
    vi.stubEnv("GROQ_API_KEY", "not-used");
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: vi.fn(async () => ({ id: "12345678-0000-0000-0000-000000000000", action: "update_value" as const, payload: {} })),
      createCloseDraft: async () => { throw new Error(); }, cancelLatestDraft: async () => { throw new Error(); }, confirmLatestDraft: async () => { throw new Error(); },
    };
    await runAgent([{ role: "user", content: "Meu salário aumentou para R$ 4.000 em outubro de 2026." }], repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(repository.createValueChangeDraft).toHaveBeenCalledWith({ name: "Salário", amountCents: 400000, effectiveFrom: "2026-10" }, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  });

  it("routes debt settlement to a temporal close draft", async () => {
    vi.stubEnv("GROQ_API_KEY", "not-used");
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); }, createValueChangeDraft: async () => { throw new Error(); },
      createCloseDraft: vi.fn(async () => ({ id: "12345678-0000-0000-0000-000000000000", action: "close_entity" as const, payload: {} })),
      cancelLatestDraft: async () => { throw new Error(); }, confirmLatestDraft: async () => { throw new Error(); },
    };
    await runAgent([{ role: "user", content: "Quitei o Nubank, retire dos próximos meses." }], repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(repository.createCloseDraft).toHaveBeenCalledWith({ name: "Nubank", inactiveFrom: "2026-09", status: "settled" }, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  });

  it("routes contextual amount correction without depending on model selection", async () => {
    vi.stubEnv("GROQ_API_KEY", "not-used");
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: async () => { throw new Error(); }, createCloseDraft: async () => { throw new Error(); },
      createTransactionCorrectionDraft: vi.fn(async () => ({ id: "1", action: "update_transaction" as const, payload: {
        description: "Tênis", previousAmountCents: 10000, amountCents: 12000, previousCategory: "?", category: "?",
      } })),
      cancelLatestDraft: async () => { throw new Error(); }, confirmLatestDraft: async () => { throw new Error(); },
    };
    await runAgent([{ role: "user", content: "Na verdade foram R$ 120" }], repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(repository.createTransactionCorrectionDraft).toHaveBeenCalledWith({ amountCents: 12000, category: undefined }, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  });

  it("routes payment-method correction instead of renaming an entity", async () => {
    vi.stubEnv("GROQ_API_KEY", "not-used");
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: async () => { throw new Error(); }, createRenameDraft: vi.fn(async () => { throw new Error(); }),
      createValueChangeDraft: async () => { throw new Error(); }, createCloseDraft: async () => { throw new Error(); },
      createTransactionCorrectionDraft: vi.fn(async () => ({ id: "1", action: "update_transaction" as const, payload: {
        description: "Cadeira", previousAmountCents: 33000, amountCents: 33000,
        previousCategory: "Móveis", category: "Móveis", previousEntityId: "nubank", entityId: "itau", paymentMethod: "Itaú",
      } })),
      cancelLatestDraft: async () => { throw new Error(); }, confirmLatestDraft: async () => { throw new Error(); },
    };
    await runAgent([{ role: "user", content: "Mude o meio de pagamento para Itaú" }], repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(repository.createTransactionCorrectionDraft).toHaveBeenCalledWith({ paymentMethod: "Itaú" }, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(repository.createRenameDraft).not.toHaveBeenCalled();
  });

  it("routes a third-party expense back to personal", async () => {
    vi.stubEnv("GROQ_API_KEY", "not-used");
    const repository: FinancialRepository = {
      getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
      createEntityDraft: async () => { throw new Error(); }, createRenameDraft: async () => { throw new Error(); },
      createValueChangeDraft: async () => { throw new Error(); }, createCloseDraft: async () => { throw new Error(); },
      createTransactionCorrectionDraft: vi.fn(async () => ({ id: "1", action: "update_transaction" as const, payload: {
        description: "Celular", previousBelongsToThirdParty: true, belongsToThirdParty: false,
      } })), cancelLatestDraft: async () => { throw new Error(); }, confirmLatestDraft: async () => { throw new Error(); },
    };
    await runAgent([{ role: "user", content: "Mude o último lançamento para despesa pessoal" }], repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(repository.createTransactionCorrectionDraft).toHaveBeenCalledWith({ belongsToThirdParty: false }, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  });
});
