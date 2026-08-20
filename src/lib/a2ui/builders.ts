import type { A2UIComponent, A2UIPayload, TableColumn } from "./schema";
import { formatCurrency } from "../money";

const catalogId = "https://united.finance/a2ui/catalog/v1.json" as const;

function surface(surfaceId: string, component: A2UIComponent | A2UIComponent[], data: Record<string, unknown>): A2UIPayload {
  return [
    { kind: "createSurface", version: "v0.9.1", surfaceId, catalogId },
    { kind: "updateComponents", version: "v0.9.1", surfaceId, components: Array.isArray(component) ? component : [component] },
    { kind: "updateDataModel", version: "v0.9.1", surfaceId, data },
  ];
}

export type FinancialHealthData = {
  month: string;
  incomeCents: number;
  committedCents: number;
  projectedBalanceCents: number;
  committedIncomePercentage: number;
  status: "comfortable" | "attention" | "critical";
  fixedExpensesCents?: number;
  invoiceCents?: number;
  futureInstallmentsCents?: number;
  variableExpensesCents?: number;
};

export type ProjectionPoint = {
  month: string;
  incomeCents: number;
  expensesCents: number;
  balanceCents: number;
};

export function buildFinancialOverview(
  month: string,
  health: FinancialHealthData,
  projection: ProjectionPoint[],
  invoices: Record<string, unknown>[],
): A2UIPayload {
  const columns: TableColumn[] = [
    { key: "name", label: "Cartão", format: "text" },
    { key: "invoiceCents", label: "Fatura", format: "currency" },
    { key: "futureCents", label: "Parcelas futuras", format: "currency" },
    { key: "dueDate", label: "Vencimento", format: "date" },
  ];
  const assumptionColumns: TableColumn[] = [
    { key: "premise", label: "Premissa", format: "text" },
    { key: "value", label: "Valor", format: "text" },
  ];
  const assumptions = [
    { premise: "Receitas consideradas", value: formatCurrency(health.incomeCents) },
    { premise: "Despesas fixas e empréstimos", value: formatCurrency(health.fixedExpensesCents ?? 0) },
    { premise: "Faturas do mês", value: formatCurrency(health.invoiceCents ?? 0) },
    { premise: "Despesas variáveis fora dos cartões", value: formatCurrency(health.variableExpensesCents ?? 0) },
    { premise: "Parcelas futuras adicionais", value: formatCurrency(health.futureInstallmentsCents ?? 0) },
    { premise: "Limites de atenção", value: "Saldo < R$ 500 ou comprometimento ≥ 80%" },
  ];
  return surface(`overview-${month}`, [
    { id: "health", component: "FinancialHealthCard", dataPath: "/health" },
    { id: "projection", component: "ProjectionChart", dataPath: "/projection" },
    { id: "invoices", component: "FinanceDataTable", title: `Faturas de ${month}`, columnsPath: "/columns", rowsPath: "/invoices" },
    { id: "assumptions", component: "FinanceDataTable", title: "Premissas do cálculo", columnsPath: "/assumptionColumns", rowsPath: "/assumptions" },
  ], { health, projection, columns, invoices, assumptionColumns, assumptions });
}

export function buildSpendingAnalysis(month: string, categories: Record<string, unknown>[], baselineMonths: string[] = []): A2UIPayload {
  const premiseColumns: TableColumn[] = [{ key: "premise", label: "Premissa", format: "text" }, { key: "value", label: "Período", format: "text" }];
  const premises = [{ premise: "Mês analisado", value: month }, { premise: "Média histórica", value: baselineMonths.join(" e ") }, { premise: "Exclusões", value: "Terceiros, transferências e lançamentos desfeitos" }];
  return surface(`analysis-${month}`, [
    { id: "categories", component: "CategoryBreakdown", dataPath: "/categories" },
    { id: "opportunities", component: "SavingsOpportunityTable", dataPath: "/categories" },
    { id: "analysis-premises", component: "FinanceDataTable", title: "Premissas da comparação", columnsPath: "/premiseColumns", rowsPath: "/premises" },
  ], { categories, premiseColumns, premises });
}

export function buildScenarioComparison(data: Record<string, unknown>): A2UIPayload {
  return surface(`scenario-${String(data.month)}`, { id: "scenario", component: "ScenarioComparison", dataPath: "/scenario" }, { scenario: data });
}

export function buildClarification(message: string, options: string[] = []): A2UIPayload {
  return surface("clarification", { id: "clarification", component: "ClarificationCard", dataPath: "/clarification" }, { clarification: { message, options } });
}

export function buildErrorCard(message: string): A2UIPayload {
  return surface("controlled-error", { id: "error", component: "ErrorCard", dataPath: "/error" }, { error: { message } });
}

export function buildFinancialChangeConfirmation(data: { title: string; fields: { label: string; value: string }[] }): A2UIPayload {
  return surface(`financial-change-${crypto.randomUUID()}`, { id: "change", component: "FinancialChangeConfirmation", dataPath: "/change" }, { change: data });
}

export type TransactionDraft = {
  id: string;
  type: "expense" | "income" | "refund" | "transfer";
  amountCents: number;
  description: string;
  category: string;
  paymentMethod: string;
  occurredAt: string;
  installmentCount: number;
  belongsToThirdParty: boolean;
  destinationPaymentMethod?: string;
  status: "pending";
};

export function buildTransactionConfirmation(transaction: TransactionDraft): A2UIPayload {
  const surfaceId = `transaction-${transaction.id}`;
  return surface(
    surfaceId,
    { id: "root", component: "TransactionConfirmation", title: "Confirme o lançamento", transactionPath: "/transaction" },
    { transaction },
  );
}

export function buildInvoiceTable(): A2UIPayload {
  const columns: TableColumn[] = [
    { key: "name", label: "Cartão", format: "text" },
    { key: "invoiceCents", label: "Fatura atual", format: "currency" },
    { key: "futureCents", label: "Parcelas futuras", format: "currency" },
    { key: "dueDate", label: "Vencimento", format: "date" },
  ];
  const rows = [
    { name: "Itaú", invoiceCents: 120400, futureCents: 63573, dueDate: "10 set" },
    { name: "Nubank", invoiceCents: 42000, futureCents: 18000, dueDate: "15 set" },
  ];
  return surface(
    "invoice-summary",
    { id: "root", component: "FinanceDataTable", title: "Visão geral das faturas", columnsPath: "/columns", rowsPath: "/rows" },
    { columns, rows },
  );
}

export function buildFinancialTable(
  surfaceId: string,
  title: string,
  columns: TableColumn[],
  rows: Record<string, unknown>[],
): A2UIPayload {
  return surface(
    surfaceId,
    { id: "root", component: "FinanceDataTable", title, columnsPath: "/columns", rowsPath: "/rows" },
    { columns, rows },
  );
}
