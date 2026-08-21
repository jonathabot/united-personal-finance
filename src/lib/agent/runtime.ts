import Groq from "groq-sdk";
import type { A2UIPayload } from "@/lib/a2ui/schema";
import { parseDecimalToCents } from "@/lib/money";
import { addMonths, monthKey, type MonthKey } from "@/lib/finance";
import { agentToolDefinitions, executeAgentTool, explainFinancialComparison, toolSchemas, type ToolName } from "@/lib/tools";
import { demoFinancialRepository, type FinancialRepository } from "@/lib/repositories";
import { inferToolFromIntent, isCapabilityQuestion, isToolAllowed, unsupportedCapabilityMessage, type ConversationMessage } from "./conversation";

export type AgentResult = { text: string; ui?: A2UIPayload; provider: "demo" | "groq" };

const demoReferenceMonth = "2026-08";

function withProvider(result: { text: string; ui?: A2UIPayload }, provider: AgentResult["provider"]): AgentResult {
  return { ...result, provider };
}

function plainTextModelResponse(content: string) {
  return content
    .replace(/```(?:\w+)?\s*([\s\S]*?)```/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1 ($2)")
    .trim();
}

function currentMonth(timeZone = "America/Sao_Paulo"): MonthKey {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts();
  return monthKey(Number(parts.find((part) => part.type === "year")?.value), Number(parts.find((part) => part.type === "month")?.value));
}

function overviewArgumentsFromMessage(message: string, referenceMonth: MonthKey) {
  const explicitMonth = message.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/);
  const month = explicitMonth
    ? `${explicitMonth[1]}-${explicitMonth[2].padStart(2, "0")}`
    : /mês que vem|mes que vem|próximo mês|proximo mes/i.test(message) ? addMonths(referenceMonth, 1) : referenceMonth;
  return { month };
}

function comparisonArgumentsFromMessage(message: string, referenceMonth: MonthKey) {
  const explicit = [...message.matchAll(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/g)].map((match) => `${match[1]}-${match[2].padStart(2, "0")}` as MonthKey);
  if (explicit.length >= 2) return { monthA: explicit[0], monthB: explicit[1] };
  const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const year = message.match(/\b(20\d{2})\b/)?.[1] ?? referenceMonth.slice(0, 4);
  const named = monthNames.map((name, index) => ({ index: message.search(new RegExp(`\\b${name}\\b`, "i")), month: `${year}-${String(index + 1).padStart(2, "0")}` as MonthKey }))
    .filter((item) => item.index >= 0).sort((a, b) => a.index - b.index).map((item) => item.month);
  if (named.length >= 2) return { monthA: named[0], monthB: named[1] };
  if (/m[eê]s\s+(?:passado|anterior)/i.test(message)) return { monthA: addMonths(referenceMonth, -1), monthB: referenceMonth };
  return { monthA: referenceMonth, monthB: addMonths(referenceMonth, 1) };
}

function latestComparisonMonths(messages: ConversationMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant") continue;
    const match = message.content.match(/\bDe\s+(20\d{2}-\d{2})\s+para\s+(20\d{2}-\d{2}),\s+o saldo projetado\b/i);
    if (match) return { monthA: match[1] as MonthKey, monthB: match[2] as MonthKey };
  }
  return undefined;
}

function contextualComparisonArguments(messages: ConversationMessage[], message: string) {
  const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const match = message.match(/^\s*e\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(20\d{2}))?[?.!\s]*$/i);
  const previous = latestComparisonMonths(messages);
  if (!match || !previous) return undefined;
  const targetMonthNumber = monthNames.findIndex((name) => name.localeCompare(match[1], "pt-BR", { sensitivity: "base" }) === 0) + 1;
  const [previousYear, previousMonthNumber] = previous.monthB.split("-").map(Number);
  const targetYear = match[2] ? Number(match[2]) : targetMonthNumber <= previousMonthNumber ? previousYear + 1 : previousYear;
  return { monthA: previous.monthB, monthB: `${targetYear}-${String(targetMonthNumber).padStart(2, "0")}` as MonthKey };
}

function claimedComparisonDirection(message: string) {
  if (!/\bpor\s+que\b/i.test(message)) return undefined;
  if (/\b(melhorou|aumentou|subiu)\b/i.test(message)) return "improved" as const;
  if (/\b(piorou|diminuiu|caiu)\b/i.test(message)) return "worsened" as const;
  return undefined;
}

function scenarioArgumentsFromMessage(message: string, referenceMonth: MonthKey) {
  const reductionPercentage = /metade/i.test(message) ? 50 : Number(message.match(/(\d{1,3})\s*%/)?.[1] ?? 20);
  const rawCategory = message.match(/(?:reduzir|reduza|cortar|corte)\s+(?:os?\s+gastos?\s+(?:com|de|em)\s+)?(.+?)(?:\s+em\s+\d{1,3}\s*%|\s+pela\s+metade|[?.!,]|$)/i)?.[1]?.trim();
  if (!rawCategory) return undefined;
  const category = /restaurante|mercado|alimenta|refei|almoço|almoco|jantar|sorvete/i.test(rawCategory)
    ? "Alimentação"
    : rawCategory.charAt(0).toLocaleUpperCase("pt-BR") + rawCategory.slice(1);
  return { month: overviewArgumentsFromMessage(message, referenceMonth).month, category, reductionPercentage };
}

function fixedExpenseArgumentsFromMessage(message: string, referenceMonth: MonthKey) {
  if (!/\b(gasto(?:s)? fixo(?:s)?|internet|energia|água|agua|academia)\b/i.test(message)) return undefined;
  const amount = message.match(/r\$\s*([\d.]+(?:,\d{1,2})?)/i)?.[1];
  const dueDay = message.match(/(?:vencimento|vence|todo dia)\s*(?:no\s*)?(?:dia\s*)?(\d{1,2})\b/i)?.[1];
  if (!amount || !dueDay) return undefined;

  const explicitMonth = message.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/);
  const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const namedMonth = monthNames.findIndex((name) => new RegExp(`\\b${name}\\b`, "i").test(message));
  const namedYear = message.match(/\b(20\d{2})\b/)?.[1];
  const effectiveFrom = explicitMonth
    ? `${explicitMonth[1]}-${explicitMonth[2].padStart(2, "0")}`
    : namedMonth >= 0 && namedYear ? `${namedYear}-${String(namedMonth + 1).padStart(2, "0")}` : referenceMonth;
  const rawName = message.match(/(?:adicione|cadastre|crie)\s+(.+?)\s+de\s+r\$/i)?.[1]
    ?.replace(/^(?:o|a|um|uma)\s+/i, "")
    .replace(/\s+(?:aos?|nos?)\s+gastos?\s+fixos?$/i, "")
    .trim();
  if (!rawName) return undefined;
  const name = rawName.charAt(0).toLocaleUpperCase("pt-BR") + rawName.slice(1);
  return { kind: "fixed_expense" as const, name, amountCents: parseDecimalToCents(amount), effectiveFrom, dueDay: Number(dueDay) };
}

function accountArgumentsFromMessage(message: string, referenceMonth: MonthKey) {
  const match = message.match(/(?:cadastre|cadastrar|crie|criar|adicione|adicionar)\s+(?:uma?\s+)?conta(?:\s+(?:chamada|com\s+o\s+nome))?\s+["']?(.+?)["']?[.!]?$/i);
  const name = match?.[1]?.trim();
  return name ? { kind: "account" as const, name, effectiveFrom: referenceMonth } : undefined;
}

function effectiveMonthFromMessage(message: string, referenceMonth: MonthKey): MonthKey {
  const explicit = message.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/);
  if (explicit) return `${explicit[1]}-${explicit[2].padStart(2, "0")}` as MonthKey;
  const names = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const index = names.findIndex((name) => new RegExp(`\\b${name}\\b`, "i").test(message));
  const year = message.match(/\b(20\d{2})\b/)?.[1];
  if (index >= 0) return `${year ?? referenceMonth.slice(0, 4)}-${String(index + 1).padStart(2, "0")}` as MonthKey;
  return /próxim|proxim|mês que vem|mes que vem/i.test(message) ? addMonths(referenceMonth, 1) : referenceMonth;
}

function valueChangeArgumentsFromMessage(message: string, referenceMonth: MonthKey) {
  const amount = message.match(/r\$\s*([\d.]+(?:,\d{1,2})?)/i)?.[1];
  if (!amount) return undefined;
  const knownName = message.match(/\b(salário|salario|internet|energia|água|agua|academia)\b/i)?.[1];
  if (!knownName) return undefined;
  const name = /^sal[aá]rio$/i.test(knownName) ? "Salário" : knownName.charAt(0).toLocaleUpperCase("pt-BR") + knownName.slice(1);
  return { name, amountCents: parseDecimalToCents(amount), effectiveFrom: effectiveMonthFromMessage(message, referenceMonth) };
}

function closeArgumentsFromMessage(message: string, referenceMonth: MonthKey) {
  const name = message.match(/(?:quitei|quite|quitar|encerre|encerrar|remova|retire)\s+(?:o|a)?\s*([^,;.]+?)(?:\s+(?:então|entao|a partir|dos?|das?)\b|[,;.]|$)/i)?.[1]?.trim();
  if (!name) return undefined;
  return { name, inactiveFrom: effectiveMonthFromMessage(message, referenceMonth), status: /quit/i.test(message) ? "settled" as const : "inactive" as const };
}

function renameArgumentsFromMessage(message: string) {
  const match = message.match(/(?:mude|altere|renomeie|troque)(?:\s+o\s+nome)?\s+(?:do|da)?\s*["']?(.+?)["']?\s+para\s+["']?(.+?)["']?[.!]?$/i);
  return match ? { currentName: match[1].trim(), newName: match[2].trim() } : undefined;
}

function transactionCorrectionArgumentsFromMessage(message: string) {
  const amount = message.match(/r\$\s*([\d.]+(?:,\d{1,2})?)|\b(\d+(?:[.,]\d{1,2})?)\s*reais?\b/i);
  const category = message.match(/categoria\s+(?:para|é|e)\s+["']?([^,.;]+)["']?/i)?.[1]?.trim();
  const description = message.match(/descri(?:ç|c)ão\s+(?:para|é|e)\s+["']?([^,.;]+)["']?/i)?.[1]?.trim();
  const occurredOn = message.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  const paymentMethod = message.match(/(?:cartão|cartao|conta|pagamento)\s+(?:para|é|e)\s+["']?([^,.;]+)["']?/i)?.[1]?.trim();
  const result: { amountCents?: number; category?: string; description?: string; occurredOn?: string; paymentMethod?: string; belongsToThirdParty?: boolean } = {};
  const amountText = amount?.[1] ?? amount?.[2];
  if (amountText) result.amountCents = parseDecimalToCents(amountText);
  if (category) result.category = category;
  if (description) result.description = description;
  if (occurredOn) result.occurredOn = occurredOn;
  if (paymentMethod) result.paymentMethod = paymentMethod;
  if (/\b(?:não|nao)\s+(?:é|e|foi|pertence)\s+(?:de|para)\s+(?:um\s+)?terceiro|\b(?:despesa|compra|lançamento|lancamento)\s+pessoal\b|\b(?:é|e)\s+(?:meu|minha)\b/i.test(message)) result.belongsToThirdParty = false;
  else if (/\b(?:é|e|foi|pertence)\s+(?:de|para)\s+(?:um\s+)?terceiro|para meu|para minha/i.test(message)) result.belongsToThirdParty = true;
  return Object.keys(result).length ? result : undefined;
}

async function demoResult(messages: ConversationMessage[], repository: FinancialRepository, threadId: string): Promise<AgentResult> {
  const message = messages.at(-1)?.content ?? "";
  const referenceMonth = repository === demoFinancialRepository ? demoReferenceMonth as MonthKey : currentMonth();
  const month = message.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/)?.slice(1).map((value, index) => index ? value.padStart(2, "0") : value).join("-") ?? referenceMonth;
  if (/\b(e se|simula|simule|cenário|cenario|metade)\b/i.test(message)) {
    const category = /delivery/i.test(message) ? "Delivery" : /mercado/i.test(message) ? "Mercado" : "Delivery";
    const percentage = /metade/i.test(message) ? 50 : Number(message.match(/(\d{1,3})\s*%/)?.[1] ?? 20);
    return withProvider(await executeAgentTool("simulate_financial_scenario", { month, category, reductionPercentage: percentage }, repository, threadId), "demo");
  }
  if (/\b(economizar|economia|gastando|gastos?|categoria|reduzir|cortar|onde.*dinheiro)\b/i.test(message)) {
    return withProvider(await executeAgentTool("analyze_spending", { month }, repository, threadId), "demo");
  }
  if (/fatura|cart(ã|a)o|parcelas|finanças|financeiro|resumo|situação|saldo|mês que vem|mes que vem|próximo mês|proximo mes|vou ficar|vai sobrar/i.test(message) && !/gastei|comprei/i.test(message)) {
    const requestedMonth = /mês que vem|mes que vem|próximo mês|proximo mes/i.test(message)
      ? addMonths(referenceMonth, 1)
      : month;
    return withProvider(await executeAgentTool("query_financial_overview", { month: requestedMonth }, repository, threadId), "demo");
  }
  const amount = message.match(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i)?.[1];
  if (/gastei|comprei|paguei/i.test(message) && amount) {
    const installmentCount = Number(message.match(/\b(\d{1,3})\s*(?:x|vezes|parcelas?)\b/i)?.[1] ?? 1);
    return withProvider(await executeAgentTool("create_transaction_draft", {
      amountCents: parseDecimalToCents(amount), description: message,
      category: /almo|restaurante|mercado/i.test(message) ? "Alimentação" : "A confirmar",
      paymentMethod: /nubank/i.test(message) ? "Nubank" : /ita[uú]/i.test(message) ? "Itaú" : "Não informado",
      installmentCount,
    }, repository, threadId), "demo");
  }
  if (/\b(confirmo|confirmar|confirma)\b/i.test(message)) return withProvider(await executeAgentTool("confirm_financial_change", { confirmed: true }, repository, threadId), "demo");
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|teste)[!.?\s]*$/i.test(message)) return { text: "Olá! Posso consultar, analisar e simular suas finanças demonstrativas ou preparar um lançamento.", provider: "demo" };
  return { text: "Não entendi qual operação financeira você deseja. Posso mostrar um resumo, analisar gastos, simular economias ou preparar uma despesa.", provider: "demo" };
}

export async function runAgent(messages: ConversationMessage[], repository: FinancialRepository = demoFinancialRepository, threadId = crypto.randomUUID()): Promise<AgentResult> {
  const latestUserMessage = messages.at(-1)?.content ?? "";
  const persistentData = repository !== demoFinancialRepository;
  const referenceMonth = persistentData ? currentMonth() : demoReferenceMonth as MonthKey;
  const explicitIntent = inferToolFromIntent(latestUserMessage);
  const comparisonExplanation = !explicitIntent ? claimedComparisonDirection(latestUserMessage) : undefined;
  const previousComparison = comparisonExplanation ? latestComparisonMonths(messages) : undefined;
  if (comparisonExplanation && previousComparison) {
    return withProvider(await explainFinancialComparison(previousComparison.monthA, previousComparison.monthB, comparisonExplanation, repository), process.env.GROQ_API_KEY ? "groq" : "demo");
  }
  const comparisonFollowUp = !explicitIntent ? contextualComparisonArguments(messages, latestUserMessage) : undefined;
  if (comparisonFollowUp) {
    return withProvider(await executeAgentTool("compare_financial_months", comparisonFollowUp, repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
  }
  if (explicitIntent === "correct_latest_transaction_draft") {
    const args = transactionCorrectionArgumentsFromMessage(latestUserMessage);
    if (args) return withProvider(await executeAgentTool(explicitIntent, args, repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
  }
  if (explicitIntent === "void_latest_transaction_draft") {
    return withProvider(await executeAgentTool(explicitIntent, { confirmedIntent: true }, repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
  }
  if (explicitIntent === "anticipate_installments_draft") {
    const count = Number(latestUserMessage.match(/\b(\d{1,3})\b/)?.[1] ?? 1);
    return withProvider(await executeAgentTool(explicitIntent, { count }, repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
  }
  if (explicitIntent === "query_transaction_history") {
    return withProvider(await executeAgentTool(explicitIntent, { limit: 20 }, repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
  }
  if (explicitIntent === "compare_financial_months") {
    return withProvider(await executeAgentTool(explicitIntent, comparisonArgumentsFromMessage(latestUserMessage, referenceMonth), repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
  }
  if (explicitIntent === "query_financial_overview") {
    return withProvider(await executeAgentTool(explicitIntent, overviewArgumentsFromMessage(latestUserMessage, referenceMonth), repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
  }
  if (explicitIntent === "analyze_spending") {
    return withProvider(await executeAgentTool(explicitIntent, overviewArgumentsFromMessage(latestUserMessage, referenceMonth), repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
  }
  if (explicitIntent === "simulate_financial_scenario") {
    const scenarioArguments = scenarioArgumentsFromMessage(latestUserMessage, referenceMonth);
    if (scenarioArguments) return withProvider(await executeAgentTool(explicitIntent, scenarioArguments, repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
  }
  if (explicitIntent === "confirm_financial_change") {
    return withProvider(await executeAgentTool("confirm_financial_change", { confirmed: true }, repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
  }
  if (explicitIntent === "cancel_financial_change") {
    return withProvider(await executeAgentTool("cancel_financial_change", { cancelled: true }, repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
  }
  if (explicitIntent === "change_financial_entity_value_draft") {
    const args = valueChangeArgumentsFromMessage(latestUserMessage, referenceMonth);
    if (args) return withProvider(await executeAgentTool(explicitIntent, args, repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
  }
  if (explicitIntent === "close_financial_entity_draft") {
    const args = closeArgumentsFromMessage(latestUserMessage, referenceMonth);
    if (args) return withProvider(await executeAgentTool(explicitIntent, args, repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
  }
  if (explicitIntent === "rename_financial_entity_draft") {
    const args = renameArgumentsFromMessage(latestUserMessage);
    if (args) return withProvider(await executeAgentTool(explicitIntent, args, repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
  }
  if (explicitIntent === "create_financial_entity_draft") {
    const accountArguments = accountArgumentsFromMessage(latestUserMessage, referenceMonth);
    if (accountArguments) {
      return withProvider(await executeAgentTool("create_financial_entity_draft", accountArguments, repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
    }
    const fixedExpenseArguments = fixedExpenseArgumentsFromMessage(latestUserMessage, referenceMonth);
    if (fixedExpenseArguments) {
      return withProvider(await executeAgentTool("create_financial_entity_draft", fixedExpenseArguments, repository, threadId), process.env.GROQ_API_KEY ? "groq" : "demo");
    }
  }
  if (isCapabilityQuestion(latestUserMessage)) return { text: `Posso consultar resumos e faturas, projetar o saldo, analisar categorias, simular reduções de gastos e preparar alterações para revisão. Os números vêm do motor TypeScript e ${persistentData ? "as consultas já usam sua conta Supabase; cadastros e renomeações são salvos somente após confirmação" : "nesta etapa os dados são demonstrativos"}.`, provider: process.env.GROQ_API_KEY ? "groq" : "demo" };
  if (!process.env.GROQ_API_KEY) return demoResult(messages, repository, threadId);

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await client.chat.completions.create({
    model: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
    messages: [{ role: "system", content: `Você é o assistente do United Personal Finance. Responda em português.
Use as tools para qualquer cálculo ou consulta financeira; nunca faça aritmética financeira por conta própria.
Os dados vêm ${persistentData ? "da conta Supabase autenticada do usuário" : "de uma demonstração"}. Quando o usuário não disser o mês, use ${referenceMonth}.
Para "mês que vem", use ${addMonths(referenceMonth, 1)}. Para comparações e economia, use analyze_spending. Para hipóteses, use simulate_financial_scenario.
Para comparar dois meses, use compare_financial_months. Todas as respostas analíticas devem informar as premissas calculadas pelas tools.
Para cadastrar salário, cartão, gasto fixo, empréstimo, reserva ou conta, use create_financial_entity_draft. Para renomear, use rename_financial_entity_draft.
Para alterar um valor recorrente com vigência, use change_financial_entity_value_draft. Para quitar ou encerrar sem apagar o histórico, use close_financial_entity_draft. Para desistir de um rascunho, use cancel_financial_change.
Para compras parceladas, informe installmentCount em create_transaction_draft. O valor é sempre o total da compra, nunca o valor de uma parcela.
Sugira uma categoria específica a partir da descrição (por exemplo, tênis é Vestuário e sorvete é Alimentação). Nunca envie "?", "A confirmar" ou "Não informado" como categoria; se não houver base suficiente para sugerir, peça a categoria antes de chamar a tool.
Para corrigir valor ou categoria do último lançamento confirmado, use correct_latest_transaction_draft. Para desfazê-lo sem apagar o histórico, use void_latest_transaction_draft. Ambas apenas preparam uma prévia e exigem confirmação posterior.
Use create_transaction_draft também para receitas avulsas, estornos e transferências. Marque belongsToThirdParty quando a despesa for de outra pessoa. Transferências exigem origem em paymentMethod e destino em destinationPaymentMethod e não são receita nem despesa.
Para antecipar parcelas futuras do último parcelamento, use anticipate_installments_draft. Para histórico, use query_transaction_history.
Quando o usuário disser confirmar após um card de alteração financeira, use confirm_financial_change. Nunca afirme que um rascunho foi salvo antes dessa confirmação.
Use valores inteiros em centavos e meses no formato YYYY-MM. Se faltar valor, vigência, fechamento ou vencimento indispensável, peça esclarecimento antes da tool.
Sempre considere todo o histórico recebido. Se sua mensagem anterior pediu uma informação ausente e o usuário responder apenas "dia 18", "Nubank", "agosto" ou outra resposta curta, combine essa resposta com o pedido financeiro anterior e execute a tool apropriada; não trate como uma nova conversa.
Não acione tools para cumprimentos ou conversa geral. Se faltar uma informação indispensável, peça esclarecimento.
Responda em texto simples, sem Markdown, asteriscos, crases ou títulos com #.` }, ...messages],
    tools: agentToolDefinitions,
    tool_choice: "auto",
    temperature: 0,
  });
  const answer = completion.choices[0]?.message;
  const call = answer?.tool_calls?.[0];
  if (!call || call.type !== "function") return { text: plainTextModelResponse(answer?.content || "Não consegui interpretar esse pedido."), provider: "groq" };
  if (!(call.function.name in toolSchemas)) return { text: "A operação solicitada não existe.", provider: "groq" };
  const recentUserContext = messages.filter((message) => message.role === "user").slice(-4).map((message) => message.content).join(" ");
  if (!isToolAllowed(call.function.name, latestUserMessage) && !isToolAllowed(call.function.name, recentUserContext)) {
    const intendedTool = inferToolFromIntent(latestUserMessage);
    if (intendedTool === "query_financial_overview") {
      return withProvider(await executeAgentTool(intendedTool, overviewArgumentsFromMessage(latestUserMessage, referenceMonth), repository, threadId), "groq");
    }
    return { text: unsupportedCapabilityMessage(latestUserMessage), provider: "groq" };
  }
  try {
    const rawArguments: unknown = JSON.parse(call.function.arguments);
    return withProvider(await executeAgentTool(call.function.name as ToolName, rawArguments, repository, threadId), "groq");
  } catch (error) {
    const intendedTool = inferToolFromIntent(latestUserMessage);
    if (intendedTool === "query_financial_overview") {
      return withProvider(await executeAgentTool(intendedTool, overviewArgumentsFromMessage(latestUserMessage, referenceMonth), repository, threadId), "groq");
    }
    throw error;
  }
}
