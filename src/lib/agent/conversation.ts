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

const transactionIntent = /\b(gastei|gasto|gastos|comprei|paguei|recebi|ganhei|estorno|estornar|transferi|transferência|transferencia|anota|anote|registra|registre|lança|lance|despesa|despesas|receita|compra|compras|transação|transacao|transações|transacoes)\b/i;
const invoiceIntent = /\b(fatura|faturas|cartão|cartões|parcelas?|vencimento)\b/i;
const overviewIntent = /\b(finanças|financeiro|resumo|visão geral|situação|saldo|mês que vem|mes que vem|próximo mês|proximo mes|projeção|projecao|vou ficar|vai sobrar)\b/i;
const analysisIntent = /\b(economizar|economia|gastando|gastos?|categoria|reduzir|cortar|onde.*dinheiro)\b/i;
const simulationIntent = /\b(e se|simula|simule|cenário|cenario|reduzir.*%|metade)\b/i;
const comparisonIntent = /\b(compare|comparar|comparação|comparacao|diferença|diferenca|evolução|evolucao)\b.*\b(mês|mes|20\d{2}|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/i;
const confirmationIntent = /\b(confirmo|confirmar|confirma|pode salvar|pode lançar)\b/i;
const cancellationIntent = /\b(cancele|cancelar|cancela|descarte|não salve|nao salve)\b/i;
const valueChangeIntent = /\b(aumentou|aumente|diminuiu|reduza|alter(?:e|ou)|mude).*(?:r\$|reais|valor)|\b(?:salário|salario|internet|energia|água|agua|academia).*(?:passa|passou|será|sera).*r\$/i;
const closeEntityIntent = /\b(quitei|quitar|quite|encerre|encerrar|remova|retire).*(?:próxim|proxim|futur|tabela|m[eê]s)|\b(quitei|quitar|quite)\b/i;
const entityCreateIntent = /\b(cadastre|cadastrar|crie|criar|adicione|adicionar|novo|nova|meu salário|meu salario).*(salário|salario|cartão|cartao|fixo|fixa|internet|energia|água|agua|academia|empréstimo|emprestimo|reserva|conta)\b|\b(meu salário|meu salario)\s+(é|e)(?:\s|$)/i;
const renameEntityIntent = /\b(mude|altere|renomeie|troque).*(nome|para)\b/i;
const transactionCorrectionIntent = /\b(na verdade|corrija|corrige|corrigir|mude|altere|troque|marque).*(?:r\$|reais|valor|categoria|descrição|descricao|data|meio\s+de\s+pagamento|pagamento|cartão|cartao|conta|terceiro|pessoal)|\b(?:categoria|descrição|descricao|data|meio\s+de\s+pagamento).*(?:para|é|e)\b/i;
const transactionVoidIntent = /\b(desfaça|desfaca|desfazer|estorne|estornar|anule|anular|exclua|remova|cancele|cancelar)\b.*\b(?:lançamento|lancamento|transação|transacao|despesa|compra)\b/i;
const anticipationIntent = /\b(antecipe|antecipar|antecipação|antecipacao)\b.*\b(parcelas?|últimas?|ultimas?)\b/i;
const historyIntent = /\b(histórico|historico|lançamentos recentes|lancamentos recentes|minhas transações|minhas transacoes)\b/i;

export function isToolAllowed(toolName: string, latestUserMessage: string) {
  if (toolName === "create_transaction_draft") return transactionIntent.test(latestUserMessage);
  if (toolName === "query_financial_overview") return invoiceIntent.test(latestUserMessage) || overviewIntent.test(latestUserMessage);
  if (toolName === "compare_financial_months") return comparisonIntent.test(latestUserMessage);
  if (toolName === "analyze_spending") return analysisIntent.test(latestUserMessage);
  if (toolName === "simulate_financial_scenario") return simulationIntent.test(latestUserMessage);
  if (toolName === "confirm_transaction") return confirmationIntent.test(latestUserMessage);
  if (toolName === "create_financial_entity_draft") return entityCreateIntent.test(latestUserMessage);
  if (toolName === "rename_financial_entity_draft") return renameEntityIntent.test(latestUserMessage);
  if (toolName === "confirm_financial_change") return confirmationIntent.test(latestUserMessage);
  if (toolName === "cancel_financial_change") return cancellationIntent.test(latestUserMessage);
  if (toolName === "change_financial_entity_value_draft") return valueChangeIntent.test(latestUserMessage);
  if (toolName === "close_financial_entity_draft") return closeEntityIntent.test(latestUserMessage);
  if (toolName === "correct_latest_transaction_draft") return transactionCorrectionIntent.test(latestUserMessage);
  if (toolName === "void_latest_transaction_draft") return transactionVoidIntent.test(latestUserMessage);
  if (toolName === "anticipate_installments_draft") return anticipationIntent.test(latestUserMessage);
  if (toolName === "query_transaction_history") return historyIntent.test(latestUserMessage);
  return false;
}

export function inferToolFromIntent(message: string) {
  if (transactionVoidIntent.test(message)) return "void_latest_transaction_draft" as const;
  if (anticipationIntent.test(message)) return "anticipate_installments_draft" as const;
  if (historyIntent.test(message)) return "query_transaction_history" as const;
  if (transactionCorrectionIntent.test(message)) return "correct_latest_transaction_draft" as const;
  if (renameEntityIntent.test(message)) return "rename_financial_entity_draft" as const;
  if (cancellationIntent.test(message)) return "cancel_financial_change" as const;
  if (confirmationIntent.test(message)) return "confirm_financial_change" as const;
  if (closeEntityIntent.test(message)) return "close_financial_entity_draft" as const;
  if (valueChangeIntent.test(message)) return "change_financial_entity_value_draft" as const;
  if (entityCreateIntent.test(message)) return "create_financial_entity_draft" as const;
  if (simulationIntent.test(message)) return "simulate_financial_scenario" as const;
  if (comparisonIntent.test(message)) return "compare_financial_months" as const;
  if (transactionIntent.test(message)) return "create_transaction_draft" as const;
  if (analysisIntent.test(message)) return "analyze_spending" as const;
  if (invoiceIntent.test(message) || overviewIntent.test(message)) return "query_financial_overview" as const;
  return undefined;
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
