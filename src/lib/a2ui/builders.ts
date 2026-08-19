import type { A2UIComponent, A2UIPayload, TableColumn } from "./schema";

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
    { key: "dueDate", label: "Vencimento", format: "date" },
  ];
  return surface(`overview-${month}`, [
    { id: "health", component: "FinancialHealthCard", dataPath: "/health" },
    { id: "projection", component: "ProjectionChart", dataPath: "/projection" },
    { id: "invoices", component: "FinanceDataTable", title: `Faturas de ${month}`, columnsPath: "/columns", rowsPath: "/invoices" },
  ], { health, projection, columns, invoices });
}

export function buildSpendingAnalysis(month: string, categories: Record<string, unknown>[]): A2UIPayload {
  return surface(`analysis-${month}`, [
    { id: "categories", component: "CategoryBreakdown", dataPath: "/categories" },
    { id: "opportunities", component: "SavingsOpportunityTable", dataPath: "/categories" },
  ], { categories });
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

export type TransactionDraft = {
  id: string;
  type: "expense";
  amountCents: number;
  description: string;
  category: string;
  paymentMethod: string;
  occurredAt: string;
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
