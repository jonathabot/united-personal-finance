import type { inferToolFromIntent } from "../conversation";

export type ExpectedIntent = ReturnType<typeof inferToolFromIntent>;

export type PortugueseIntentEval = {
  id: string;
  utterance: string;
  expectedIntent: ExpectedIntent;
};

export const portugueseIntentEvals: PortugueseIntentEval[] = [
  { id: "slang-spending-conto", utterance: "Torrei 50 conto no mercado", expectedIntent: "create_transaction_draft" },
  { id: "slang-card-installments", utterance: "Passei 600 em 6x no Nubank", expectedIntent: "create_transaction_draft" },
  { id: "slang-income-freela", utterance: "Caiu 500 do freela hoje", expectedIntent: "create_transaction_draft" },
  { id: "overview-next-month", utterance: "Quanto vai sobrar mês que vem?", expectedIntent: "query_financial_overview" },
  { id: "analysis-money", utterance: "Onde tá indo minha grana?", expectedIntent: "analyze_spending" },
  { id: "scenario-ifood", utterance: "E se eu cortar iFood pela metade?", expectedIntent: "simulate_financial_scenario" },
  { id: "context-correction", utterance: "Essa compra era do meu irmão", expectedIntent: "correct_latest_transaction_draft" },
  { id: "slang-void", utterance: "Apaga a última compra", expectedIntent: "void_latest_transaction_draft" },
  { id: "confirmation", utterance: "Pode lançar", expectedIntent: "confirm_financial_change" },
  { id: "cancellation", utterance: "Deixa quieto, não salva", expectedIntent: "cancel_financial_change" },
  { id: "typo-spending", utterance: "Gastei 30 reais no mercdo", expectedIntent: "create_transaction_draft" },
  { id: "regional-spending-pila", utterance: "Gastei 30 pila no mercado", expectedIntent: "create_transaction_draft" },
  { id: "negative-passei", utterance: "Passei no mercado para olhar os preços", expectedIntent: undefined },
  { id: "negative-caiu", utterance: "O dinheiro caiu no chão", expectedIntent: undefined },
  { id: "negative-freela", utterance: "Freela é uma modalidade de trabalho", expectedIntent: undefined },
  { id: "small-talk", utterance: "E aí, tudo bem?", expectedIntent: undefined },
  { id: "unrelated", utterance: "Me conta uma piada", expectedIntent: undefined },
];
