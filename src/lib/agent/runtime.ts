import Groq from "groq-sdk";
import type { A2UIPayload } from "@/lib/a2ui/schema";
import { parseDecimalToCents } from "@/lib/money";
import { agentToolDefinitions, executeAgentTool, toolSchemas, type ToolName } from "@/lib/tools";
import { isCapabilityQuestion, isToolAllowed, unsupportedCapabilityMessage, type ConversationMessage } from "./conversation";

export type AgentResult = { text: string; ui?: A2UIPayload; provider: "demo" | "groq" };

const demoReferenceMonth = "2026-08";

function withProvider(result: { text: string; ui?: A2UIPayload }, provider: AgentResult["provider"]): AgentResult {
  return { ...result, provider };
}

function demoResult(messages: ConversationMessage[]): AgentResult {
  const message = messages.at(-1)?.content ?? "";
  const month = message.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/)?.slice(1).map((value, index) => index ? value.padStart(2, "0") : value).join("-") ?? demoReferenceMonth;
  if (/\b(e se|simula|simule|cenário|cenario|metade)\b/i.test(message)) {
    const category = /delivery/i.test(message) ? "Delivery" : /mercado/i.test(message) ? "Mercado" : "Delivery";
    const percentage = /metade/i.test(message) ? 50 : Number(message.match(/(\d{1,3})\s*%/)?.[1] ?? 20);
    return withProvider(executeAgentTool("simulate_financial_scenario", { month, category, reductionPercentage: percentage }), "demo");
  }
  if (/\b(economizar|economia|gastando|gastos?|categoria|reduzir|cortar|onde.*dinheiro)\b/i.test(message)) {
    return withProvider(executeAgentTool("analyze_spending", { month }), "demo");
  }
  if (/fatura|cart(ã|a)o|parcelas|finanças|financeiro|resumo|situação|saldo|mês que vem|mes que vem|próximo mês|proximo mes|vou ficar|vai sobrar/i.test(message) && !/gastei|comprei/i.test(message)) {
    const requestedMonth = /mês que vem|mes que vem|próximo mês|proximo mes/i.test(message)
      ? "2026-09"
      : month;
    return withProvider(executeAgentTool("query_financial_overview", { month: requestedMonth }), "demo");
  }
  const amount = message.match(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i)?.[1];
  if (/gastei|comprei|paguei/i.test(message) && amount) {
    return withProvider(executeAgentTool("create_transaction_draft", {
      amountCents: parseDecimalToCents(amount), description: message,
      category: /almo|restaurante|mercado/i.test(message) ? "Alimentação" : "A confirmar",
      paymentMethod: /nubank/i.test(message) ? "Nubank" : /ita[uú]/i.test(message) ? "Itaú" : "Não informado",
    }), "demo");
  }
  if (/\b(confirmo|confirmar|confirma)\b/i.test(message)) return withProvider(executeAgentTool("confirm_transaction", { draftId: "conversation-draft", confirmed: true }), "demo");
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|teste)[!.?\s]*$/i.test(message)) return { text: "Olá! Posso consultar, analisar e simular suas finanças demonstrativas ou preparar um lançamento.", provider: "demo" };
  return { text: "Não entendi qual operação financeira você deseja. Posso mostrar um resumo, analisar gastos, simular economias ou preparar uma despesa.", provider: "demo" };
}

export async function runAgent(messages: ConversationMessage[]): Promise<AgentResult> {
  const latestUserMessage = messages.at(-1)?.content ?? "";
  if (isCapabilityQuestion(latestUserMessage)) return { text: "Posso consultar resumos e faturas, projetar o saldo, analisar categorias, simular reduções de gastos e preparar lançamentos para revisão. Os números vêm do motor TypeScript; nesta etapa os dados são demonstrativos e confirmações ainda não são persistidas.", provider: process.env.GROQ_API_KEY ? "groq" : "demo" };
  if (!process.env.GROQ_API_KEY) return demoResult(messages);

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await client.chat.completions.create({
    model: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
    messages: [{ role: "system", content: `Você é o assistente do United Personal Finance. Responda em português.
Use as tools para qualquer cálculo ou consulta financeira; nunca faça aritmética financeira por conta própria.
Os dados disponíveis são uma demonstração com referência em agosto de 2026. Quando o usuário não disser o mês, use 2026-08.
Para "mês que vem" a partir da referência, use 2026-09. Para comparações e economia, use analyze_spending. Para hipóteses, use simulate_financial_scenario.
Crie apenas rascunhos de lançamentos. Nunca afirme que algo foi persistido. Use valores inteiros em centavos.
Não acione tools para cumprimentos ou conversa geral. Se faltar uma informação indispensável, peça esclarecimento.` }, ...messages],
    tools: agentToolDefinitions,
    tool_choice: "auto",
    temperature: 0,
  });
  const answer = completion.choices[0]?.message;
  const call = answer?.tool_calls?.[0];
  if (!call || call.type !== "function") return { text: answer?.content || "Não consegui interpretar esse pedido.", provider: "groq" };
  if (!(call.function.name in toolSchemas)) return { text: "A operação solicitada não existe.", provider: "groq" };
  if (!isToolAllowed(call.function.name, latestUserMessage)) return { text: unsupportedCapabilityMessage(latestUserMessage), provider: "groq" };
  const rawArguments: unknown = JSON.parse(call.function.arguments);
  return withProvider(executeAgentTool(call.function.name as ToolName, rawArguments), "groq");
}
