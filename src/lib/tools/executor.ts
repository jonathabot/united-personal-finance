import { buildClarification, buildErrorCard, buildFinancialOverview, buildScenarioComparison, buildSpendingAnalysis, buildTransactionConfirmation, type TransactionDraft } from "../a2ui/builders";
import type { A2UIPayload } from "../a2ui/schema";
import { demoCards, demoProjections, demoTransactions } from "../data/demo-financial-data";
import { addMonths, analyzeCategorySpending, calculateMonthlyProjection, calculateMonthlySummary, simulateCategoryReduction, type MonthKey } from "../finance";
import { formatCurrency } from "../money";
import { toolSchemas, type ToolName } from "./schemas";

export type ToolExecutionResult = { text: string; ui?: A2UIPayload };

const localDate = () => "2026-08-19";

function overview(month: MonthKey): ToolExecutionResult {
  const summary = calculateMonthlySummary(demoTransactions, month, demoCards);
  const projectionInput = demoProjections.find((item) => item.month === month);
  const projection = projectionInput ? calculateMonthlyProjection(projectionInput) : undefined;
  const statusLabels = { comfortable: "confortável", attention: "atenção", critical: "crítica" } as const;
  const rows = summary.statements.map((statement) => ({
    name: demoCards.find((card) => card.id === statement.cardId)?.name ?? statement.cardId,
    invoiceCents: statement.totalCents,
    dueDate: statement.dueDate,
  }));
  const projectionText = projection
    ? ` O saldo projetado é ${formatCurrency(projection.projectedBalanceCents)} e a situação é ${statusLabels[projection.status]}.`
    : " Ainda não há premissas de projeção cadastradas para esse mês.";
  return {
    text: `Em ${month}, as faturas somam ${formatCurrency(summary.invoiceTotalCents)} e as despesas pessoais registradas somam ${formatCurrency(summary.personalExpensesCents)}.${projectionText}`,
    ui: projection ? buildFinancialOverview(
      month,
      projection,
      demoProjections.map((item) => {
        const projected = calculateMonthlyProjection(item);
        return { month: item.month, incomeCents: item.incomeCents, expensesCents: projected.committedCents, balanceCents: projected.projectedBalanceCents };
      }),
      rows,
    ) : buildErrorCard(`Não há premissas de projeção cadastradas para ${month}.`),
  };
}

export function executeAgentTool(name: ToolName, rawArguments: unknown): ToolExecutionResult {
  const args = toolSchemas[name].parse(rawArguments) as Record<string, unknown>;
  if (name === "query_financial_overview") return overview(args.month as MonthKey);
  if (name === "create_transaction_draft") {
    const draft: TransactionDraft = {
      id: crypto.randomUUID(), type: "expense", status: "pending", occurredAt: localDate(),
      amountCents: args.amountCents as number, description: args.description as string,
      category: args.category as string, paymentMethod: args.paymentMethod as string,
    };
    return { text: "Preparei o rascunho. Revise os dados antes de confirmar:", ui: buildTransactionConfirmation(draft) };
  }
  if (name === "confirm_transaction") {
    return { text: "A confirmação foi validada, mas o lançamento ainda não foi salvo. A persistência será habilitada com o Supabase." };
  }
  if (name === "analyze_spending") {
    const month = args.month as MonthKey;
    const analysis = analyzeCategorySpending(demoTransactions, month, [addMonths(month, -2), addMonths(month, -1)]);
    const rows = analysis.map((item) => ({ category: item.category, currentCents: item.currentCents, averageCents: item.averageCents, potentialSavingsCents: item.potentialSavingsCents, trend: item.trend }));
    const best = analysis.find((item) => item.potentialSavingsCents > 0);
    return { text: best ? `A maior oportunidade está em ${best.category}: ${formatCurrency(best.potentialSavingsCents)} acima da média recente.` : "Não encontrei gastos acima da média recente.", ui: buildSpendingAnalysis(month, rows) };
  }
  const month = args.month as MonthKey;
  const category = args.category as string;
  const analysis = analyzeCategorySpending(demoTransactions, month, [addMonths(month, -2), addMonths(month, -1)]);
  const categoryData = analysis.find((item) => item.category.localeCompare(category, "pt-BR", { sensitivity: "base" }) === 0);
  if (!categoryData) return { text: `Não encontrei gastos na categoria ${category} em ${month}.`, ui: buildClarification("Escolha uma categoria que tenha gastos no mês.", analysis.filter((item) => item.currentCents > 0).map((item) => item.category)) };
  const projectionInput = demoProjections.find((item) => item.month === month);
  if (!projectionInput) return { text: `Não há projeção cadastrada para ${month}; por isso não consigo simular com segurança.`, ui: buildErrorCard(`Cadastre as premissas financeiras de ${month} antes de executar a simulação.`) };
  const projection = calculateMonthlyProjection(projectionInput);
  const scenario = simulateCategoryReduction({ month, category: categoryData.category, currentCategoryCents: categoryData.currentCents, currentProjectedBalanceCents: projection.projectedBalanceCents, reductionPercentage: args.reductionPercentage as number });
  const rows = [{ scenario: "Atual", categoryCents: categoryData.currentCents, balanceCents: projection.projectedBalanceCents }, { scenario: `Redução de ${args.reductionPercentage}%`, categoryCents: scenario.adjustedCategoryCents, balanceCents: scenario.projectedBalanceCents }];
  return { text: `Reduzindo ${categoryData.category} em ${args.reductionPercentage}%, a economia estimada é ${formatCurrency(scenario.savingsCents)} e o saldo projetado passa para ${formatCurrency(scenario.projectedBalanceCents)}.`, ui: buildScenarioComparison({ month, category: categoryData.category, reductionPercentage: args.reductionPercentage, savingsCents: scenario.savingsCents, rows }) };
}
