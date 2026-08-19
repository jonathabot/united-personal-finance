"use client";

import { a2uiPayloadSchema, tableColumnSchema, type A2UIPayload, type TableColumn } from "@/lib/a2ui/schema";
import { formatCurrency } from "@/lib/money";
import { a2uiCatalog } from "./catalog";
import type { FinancialHealthData, ProjectionPoint } from "@/lib/a2ui/builders";
import type { CategoryVisualData } from "./category-breakdown";

function atPath(data: Record<string, unknown>, path: string) {
  return path.split("/").filter(Boolean).reduce<unknown>((value, key) =>
    value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, data);
}

function DataTable({ title, columns, rows }: { title: string; columns: TableColumn[]; rows: Record<string, unknown>[] }) {
  const display = (value: unknown, format: TableColumn["format"]) => {
    if (format === "currency" && typeof value === "number") return formatCurrency(value);
    return String(value ?? "—");
  };
  return (
    <section className="uiCard">
      <h3>{title}</h3>
      <div className="tableWrap"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column.key}>{display(row[column.key], column.format)}</td>)}</tr>)}</tbody>
      </table></div>
    </section>
  );
}

function TransactionConfirmation({ transaction }: { transaction: Record<string, unknown> }) {
  return (
    <section className="uiCard confirmation">
      <dl>
        <div><dt>Valor</dt><dd>{formatCurrency(Number(transaction.amountCents))}</dd></div>
        <div><dt>Cartão</dt><dd>{String(transaction.paymentMethod)}</dd></div>
        <div><dt>Categoria</dt><dd>{String(transaction.category)}</dd></div>
        <div><dt>Data</dt><dd>Hoje</dd></div>
      </dl>
      <div className="confirmationActions"><button className="secondary" disabled>Editar</button><button disabled title="Persistência será conectada com o Supabase">Confirmar</button></div>
    </section>
  );
}

export function A2UIRenderer({ payload }: { payload: A2UIPayload }) {
  const parsed = a2uiPayloadSchema.safeParse(payload);
  if (!parsed.success) return <p className="uiError">Não foi possível renderizar esta resposta.</p>;
  const components = parsed.data.find((item) => item.kind === "updateComponents")?.components ?? [];
  const data = parsed.data.find((item) => item.kind === "updateDataModel")?.data ?? {};
  return <>{components.map((component) => {
    if (component.component === "FinanceDataTable") {
      const columns = tableColumnSchema.array().parse(atPath(data, component.columnsPath));
      const rows = atPath(data, component.rowsPath) as Record<string, unknown>[];
      return <DataTable key={component.id} title={component.title} columns={columns} rows={rows} />;
    }
    if (component.component === "TransactionConfirmation") {
      return <TransactionConfirmation key={component.id} transaction={atPath(data, component.transactionPath) as Record<string, unknown>} />;
    }
    if (component.component === "FinancialHealthCard") return <a2uiCatalog.FinancialHealthCard key={component.id} data={atPath(data, component.dataPath) as FinancialHealthData} />;
    if (component.component === "ProjectionChart") return <a2uiCatalog.ProjectionChart key={component.id} data={atPath(data, component.dataPath) as ProjectionPoint[]} />;
    if (component.component === "CategoryBreakdown") return <a2uiCatalog.CategoryBreakdown key={component.id} data={atPath(data, component.dataPath) as CategoryVisualData[]} />;
    if (component.component === "SavingsOpportunityTable") return <a2uiCatalog.SavingsOpportunityTable key={component.id} data={atPath(data, component.dataPath) as CategoryVisualData[]} />;
    if (component.component === "ScenarioComparison") return <a2uiCatalog.ScenarioComparison key={component.id} data={atPath(data, component.dataPath) as never} />;
    if (component.component === "ClarificationCard") return <a2uiCatalog.ClarificationCard key={component.id} data={atPath(data, component.dataPath) as never} />;
    if (component.component === "ErrorCard") return <a2uiCatalog.ErrorCard key={component.id} data={atPath(data, component.dataPath) as never} />;
    const value = atPath(data, component.valuePath);
    return <section className="uiCard kpi" key={component.id}><span>{component.label}</span><strong>{String(value)}</strong></section>;
  })}</>;
}
