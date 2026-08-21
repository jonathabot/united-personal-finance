import { afterEach, describe, expect, it, vi } from "vitest";
import type { FinancialRepository } from "../../repositories";
import { runAgent } from "../runtime";

afterEach(() => vi.unstubAllEnvs());

function recordingRepository() {
  const createTransactionDraft = vi.fn(async () => ({
    id: "12345678-0000-0000-0000-000000000000",
    action: "create_transaction" as const,
    payload: {},
  }));
  const createTransactionCorrectionDraft = vi.fn(async () => ({
    id: "12345678-0000-0000-0000-000000000001",
    action: "update_transaction" as const,
    payload: {},
  }));
  const repository: FinancialRepository = {
    getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
    createEntityDraft: async () => { throw new Error("unexpected entity draft"); },
    createRenameDraft: async () => { throw new Error("unexpected rename draft"); },
    createValueChangeDraft: async () => { throw new Error("unexpected value draft"); },
    createCloseDraft: async () => { throw new Error("unexpected close draft"); },
    createTransactionDraft,
    createTransactionCorrectionDraft,
    cancelLatestDraft: async () => { throw new Error("unexpected cancellation"); },
    confirmLatestDraft: async () => { throw new Error("unexpected confirmation"); },
  };
  return { repository, createTransactionDraft, createTransactionCorrectionDraft };
}

describe("Agent Evals: extração coloquial em português", () => {
  it.each([
    {
      utterance: "Torrei 50 conto no mercado",
      expected: { type: "expense", amountCents: 5000, category: "Alimentação", installmentCount: 1 },
    },
    {
      utterance: "Passei 600 em 6x no Nubank no mercado",
      expected: { type: "expense", amountCents: 60000, paymentMethod: "Nubank", installmentCount: 6 },
    },
    {
      utterance: "Caiu 500 do freela hoje",
      expected: { type: "income", amountCents: 50000, installmentCount: 1 },
    },
    {
      utterance: "Gastei 1,5k no mercado",
      expected: { type: "expense", amountCents: 150000, category: "Alimentação" },
    },
    {
      utterance: "Torrei duzentos conto no mercado",
      expected: { type: "expense", amountCents: 20000, category: "Alimentação" },
    },
    {
      utterance: "Gastei uma cinquentinha no mercdo",
      expected: { type: "expense", amountCents: 5000, category: "Alimentação" },
    },
  ])("extrai $utterance", async ({ utterance, expected }) => {
    vi.stubEnv("GROQ_API_KEY", "");
    const { repository, createTransactionDraft } = recordingRepository();

    await runAgent([{ role: "user", content: utterance }], repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    expect(createTransactionDraft).toHaveBeenCalledWith(expect.objectContaining(expected), "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  });

  it("interpreta uma correção contextual de pertencimento a terceiro", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const { repository, createTransactionCorrectionDraft } = recordingRepository();

    await runAgent([{ role: "user", content: "Essa compra era do meu irmão" }], repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    expect(createTransactionCorrectionDraft).toHaveBeenCalledWith(
      { belongsToThirdParty: true },
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
  });

  it("pede esclarecimento quando o meio de pagamento é ambíguo", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const { repository } = recordingRepository();
    repository.createTransactionDraft = async () => {
      throw new Error("AMBIGUOUS_ENTITY:Itaú Conta|Itaú Cartão");
    };

    const result = await runAgent(
      [{ role: "user", content: "Gastei 50 reais no mercado usando o Itaú" }],
      repository,
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );

    expect(result.text).toContain("mais de um meio de pagamento");
    expect(JSON.stringify(result.ui)).toContain("Itaú Conta");
    expect(JSON.stringify(result.ui)).toContain("Itaú Cartão");
  });
});
