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
  const repository: FinancialRepository = {
    getDataset: async () => ({ cards: [], transactions: [], projections: [] }),
    createEntityDraft: async () => { throw new Error("unexpected entity draft"); },
    createRenameDraft: async () => { throw new Error("unexpected rename draft"); },
    createValueChangeDraft: async () => { throw new Error("unexpected value draft"); },
    createCloseDraft: async () => { throw new Error("unexpected close draft"); },
    createTransactionDraft,
    cancelLatestDraft: async () => { throw new Error("unexpected cancellation"); },
    confirmLatestDraft: async () => { throw new Error("unexpected confirmation"); },
  };
  return { repository, createTransactionDraft };
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
  ])("extrai $utterance", async ({ utterance, expected }) => {
    vi.stubEnv("GROQ_API_KEY", "");
    const { repository, createTransactionDraft } = recordingRepository();

    await runAgent([{ role: "user", content: utterance }], repository, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    expect(createTransactionDraft).toHaveBeenCalledWith(expect.objectContaining(expected), "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  });
});
