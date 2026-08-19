import type Groq from "groq-sdk";

export const agentToolDefinitions: Groq.Chat.Completions.ChatCompletionTool[] = [
  { type: "function", function: { name: "query_financial_overview", description: "Consulta resumo, faturas e projeção de um mês disponível.", parameters: { type: "object", properties: { month: { type: "string", description: "Mês no formato YYYY-MM" } }, required: ["month"], additionalProperties: false } } },
  { type: "function", function: { name: "create_transaction_draft", description: "Cria uma prévia de despesa, sem persistir.", parameters: { type: "object", properties: { amountCents: { type: "integer" }, description: { type: "string" }, category: { type: "string" }, paymentMethod: { type: "string" } }, required: ["amountCents", "description", "category", "paymentMethod"], additionalProperties: false } } },
  { type: "function", function: { name: "confirm_transaction", description: "Valida a intenção de confirmar um rascunho. Nesta etapa ainda não persiste.", parameters: { type: "object", properties: { draftId: { type: "string" }, confirmed: { type: "boolean", enum: [true] } }, required: ["draftId", "confirmed"], additionalProperties: false } } },
  { type: "function", function: { name: "analyze_spending", description: "Compara gastos por categoria com os dois meses anteriores e encontra oportunidades de economia.", parameters: { type: "object", properties: { month: { type: "string", description: "Mês no formato YYYY-MM" } }, required: ["month"], additionalProperties: false } } },
  { type: "function", function: { name: "simulate_financial_scenario", description: "Simula o efeito de reduzir uma categoria sem alterar dados.", parameters: { type: "object", properties: { month: { type: "string" }, category: { type: "string" }, reductionPercentage: { type: "integer", minimum: 0, maximum: 100 } }, required: ["month", "category", "reductionPercentage"], additionalProperties: false } } },
];

