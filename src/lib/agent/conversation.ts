import { z } from "zod";

export const conversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

export const agentRequestSchema = z.object({
  threadId: z.string().uuid(),
  messages: z.array(conversationMessageSchema).min(1).max(40),
}).refine((value) => value.messages.at(-1)?.role === "user", {
  message: "A última mensagem deve ser do usuário.",
  path: ["messages"],
});

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;

const transactionIntent = /\b(gastei|comprei|paguei|anota|anote|registra|registre|lança|lance|despesa|compra)\b/i;
const invoiceIntent = /\b(fatura|faturas|cartão|cartões|parcelas?|vencimento)\b/i;
const overviewIntent = /\b(finanças|financeiro|resumo|visão geral|situação|saldo|mês que vem|mes que vem|próximo mês|proximo mes|projeção|projecao|vou ficar|vai sobrar)\b/i;
const analysisIntent = /\b(economizar|economia|gastando|gastos?|categoria|reduzir|cortar|onde.*dinheiro)\b/i;
const simulationIntent = /\b(e se|simula|simule|cenário|cenario|reduzir.*%|metade)\b/i;
const confirmationIntent = /\b(confirmo|confirmar|confirma|pode salvar|pode lançar)\b/i;

export function isToolAllowed(toolName: string, latestUserMessage: string) {
  if (toolName === "create_transaction_draft") return transactionIntent.test(latestUserMessage);
  if (toolName === "query_financial_overview") return invoiceIntent.test(latestUserMessage) || overviewIntent.test(latestUserMessage);
  if (toolName === "analyze_spending") return analysisIntent.test(latestUserMessage);
  if (toolName === "simulate_financial_scenario") return simulationIntent.test(latestUserMessage);
  if (toolName === "confirm_transaction") return confirmationIntent.test(latestUserMessage);
  return false;
}

export function unsupportedCapabilityMessage(message: string) {
  if (/\b(mês que vem|mes que vem|próximo mês|proximo mes|projeção|projecao|vou ficar|vai sobrar)\b/i.test(message)) {
    return "Entendi que você quer uma projeção, mas a tool não recebeu dados válidos para calculá-la com segurança.";
  }
  if (/\b(economizar|economia|gastando demais|reduzir gastos|cortar gastos)\b/i.test(message)) {
    return "Entendi que você quer encontrar oportunidades de economia, mas a análise não pôde ser executada com segurança.";
  }
  return "Entendi. Pode me dizer qual movimentação ou informação financeira você quer consultar?";
}

export function isCapabilityQuestion(message: string) {
  return /\b(o que (você|voce) (pode|consegue) fazer|como (você|voce) pode ajudar|quais (são|sao) suas (funções|funcoes|capacidades))\b/i.test(message);
}
