import { buildClarification, buildErrorCard, buildFinancialChangeConfirmation, buildFinancialOverview, buildFinancialTable, buildScenarioComparison, buildSpendingAnalysis, buildTransactionConfirmation, type TransactionDraft } from "../a2ui/builders";
import type { A2UIPayload } from "../a2ui/schema";
import { addMonths, analyzeCategorySpending, calculateMonthlyProjection, calculateMonthlySummary, simulateCategoryReduction, type MonthKey } from "../finance";
import { formatCurrency } from "../money";
import { demoFinancialRepository, type FinancialRepository } from "../repositories";
import { toolSchemas, type ToolName } from "./schemas";

export type ToolExecutionResult = { text: string; ui?: A2UIPayload };

const localDate = (timeZone = "America/Sao_Paulo") => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts();
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
};

async function overview(month: MonthKey, repository: FinancialRepository): Promise<ToolExecutionResult> {
  const { cards, transactions, projections, installments = [] } = await repository.getDataset();
  if (!cards.length && !transactions.length && projections.every((item) => item.incomeCents === 0 && item.fixedExpensesCents === 0)) {
    return { text: "Sua conta ainda não possui dados financeiros.", ui: buildClarification("Comece cadastrando seu salário, um cartão ou um gasto fixo pelo chat.", ["Cadastrar salário", "Cadastrar cartão", "Cadastrar gasto fixo"]) };
  }
  const summary = calculateMonthlySummary(transactions, month, cards, installments);
  const projectionInput = projections.find((item) => item.month === month);
  const projection = projectionInput ? calculateMonthlyProjection(projectionInput) : undefined;
  const statusLabels = { comfortable: "confortável", attention: "atenção", critical: "crítica" } as const;
  const rows = summary.statements.map((statement) => ({
    name: cards.find((card) => card.id === statement.cardId)?.name ?? statement.cardId,
    invoiceCents: statement.totalCents,
    dueDate: statement.dueDate,
    futureCents: installments.filter((item) => item.entityId === statement.cardId && item.statementMonth > month && item.status !== "voided").reduce((sum, item) => sum + item.amountCents, 0),
  }));
  const projectionText = projection
    ? ` O saldo projetado é ${formatCurrency(projection.projectedBalanceCents)} e a situação é ${statusLabels[projection.status]}.`
    : " Ainda não há premissas de projeção cadastradas para esse mês.";
  return {
    text: `Em ${month}, as faturas somam ${formatCurrency(summary.invoiceTotalCents)} e as despesas pessoais registradas somam ${formatCurrency(summary.personalExpensesCents)}.${projectionText}`,
    ui: projection ? buildFinancialOverview(
      month,
      projection,
      projections.map((item) => {
        const projected = calculateMonthlyProjection(item);
        return { month: item.month, incomeCents: item.incomeCents, expensesCents: projected.committedCents, balanceCents: projected.projectedBalanceCents };
      }),
      rows,
    ) : buildErrorCard(`Não há premissas de projeção cadastradas para ${month}.`),
  };
}

export async function executeAgentTool(name: ToolName, rawArguments: unknown, repository: FinancialRepository = demoFinancialRepository, threadId = crypto.randomUUID()): Promise<ToolExecutionResult> {
  const args = toolSchemas[name].parse(rawArguments) as Record<string, unknown>;
  if (name === "create_transaction_draft" && /^(\?|a confirmar|não informado|nao informado|desconhecid[oa])$/i.test(String(args.category).trim())) {
    return { text: "Preciso confirmar a categoria antes de preparar o lançamento.", ui: buildClarification("Qual categoria descreve melhor esta despesa?", ["Alimentação", "Vestuário", "Transporte", "Lazer", "Saúde", "Moradia", "Outros"]) };
  }
  if (name === "create_financial_entity_draft") {
    const draft = await repository.createEntityDraft({
      kind: args.kind as "income" | "credit_card" | "fixed_expense" | "loan" | "reserve" | "account",
      name: args.name as string, amountCents: args.amountCents as number | undefined,
      effectiveFrom: args.effectiveFrom as string, closingDay: args.closingDay as number | undefined, dueDay: args.dueDay as number | undefined,
    }, threadId);
    const labels = { income: "Receita", credit_card: "Cartão", fixed_expense: "Gasto fixo", loan: "Empréstimo", reserve: "Reserva", account: "Conta" };
    const fields = [{ label: "Tipo", value: labels[args.kind as keyof typeof labels] }, { label: "Nome", value: args.name as string }, { label: "Vigência", value: args.effectiveFrom as string }];
    if (typeof args.amountCents === "number") fields.push({ label: "Valor", value: formatCurrency(args.amountCents) });
    if (args.closingDay) fields.push({ label: "Fechamento", value: `Dia ${args.closingDay}` });
    if (args.dueDay) fields.push({ label: "Vencimento", value: `Dia ${args.dueDay}` });
    return { text: "Preparei a alteração abaixo. Ela ainda não foi aplicada.", ui: buildFinancialChangeConfirmation({ title: `Cadastrar ${args.name}`, fields: [...fields, { label: "Rascunho", value: draft.id.slice(0, 8) }] }) };
  }
  if (name === "rename_financial_entity_draft") {
    const draft = await repository.createRenameDraft(args.currentName as string, args.newName as string, threadId);
    return { text: "Preparei a renomeação. O nome anterior será preservado como apelido.", ui: buildFinancialChangeConfirmation({ title: "Renomear item financeiro", fields: [{ label: "Nome atual", value: args.currentName as string }, { label: "Novo nome", value: args.newName as string }, { label: "Rascunho", value: draft.id.slice(0, 8) }] }) };
  }
  if (name === "change_financial_entity_value_draft") {
    const draft = await repository.createValueChangeDraft({ name: args.name as string, amountCents: args.amountCents as number, effectiveFrom: args.effectiveFrom as string }, threadId);
    return { text: "Preparei a alteração de valor. O histórico anterior será preservado.", ui: buildFinancialChangeConfirmation({ title: `Atualizar ${args.name}`, fields: [{ label: "Novo valor", value: formatCurrency(args.amountCents as number) }, { label: "A partir de", value: args.effectiveFrom as string }, { label: "Rascunho", value: draft.id.slice(0, 8) }] }) };
  }
  if (name === "close_financial_entity_draft") {
    const draft = await repository.createCloseDraft({ name: args.name as string, inactiveFrom: args.inactiveFrom as string, status: args.status as "inactive" | "settled" }, threadId);
    return { text: "Preparei o encerramento. Os meses anteriores continuarão no histórico.", ui: buildFinancialChangeConfirmation({ title: `${args.status === "settled" ? "Quitar" : "Encerrar"} ${args.name}`, fields: [{ label: "Sem cobranças a partir de", value: args.inactiveFrom as string }, { label: "Rascunho", value: draft.id.slice(0, 8) }] }) };
  }
  if (name === "cancel_financial_change") {
    await repository.cancelLatestDraft(threadId);
    return { text: "Rascunho cancelado. Nenhum dado financeiro foi alterado." };
  }
  if (name === "confirm_financial_change") {
    const confirmed = await repository.confirmLatestDraft(threadId);
    if (["create_transaction", "update_transaction", "void_transaction", "anticipate_installments"].includes(confirmed.action)) {
      const refreshed = await overview(localDate().slice(0, 7) as MonthKey, repository);
      const label = confirmed.action === "void_transaction" ? "Lançamento desfeito" : confirmed.action === "update_transaction" ? "Correção confirmada e salva" : confirmed.action === "anticipate_installments" ? "Parcelas antecipadas" : "Lançamento confirmado e salvo";
      return { text: `${label}. Referência: ${confirmed.referenceId.slice(0, 8)}. ${refreshed.text}`, ui: refreshed.ui };
    }
    return { text: `Alteração confirmada e salva com segurança. Referência: ${confirmed.referenceId.slice(0, 8)}.` };
  }
  if (name === "query_financial_overview") return overview(args.month as MonthKey, repository);
  if (name === "compare_financial_months") {
    const { projections } = await repository.getDataset();
    const monthA = args.monthA as MonthKey;
    const monthB = args.monthB as MonthKey;
    const inputA = projections.find((item) => item.month === monthA);
    const inputB = projections.find((item) => item.month === monthB);
    if (!inputA || !inputB) return { text: "Não há premissas suficientes para comparar os dois meses.", ui: buildErrorCard(`A comparação exige projeções disponíveis para ${monthA} e ${monthB}.`) };
    const a = calculateMonthlyProjection(inputA);
    const b = calculateMonthlyProjection(inputB);
    const delta = b.projectedBalanceCents - a.projectedBalanceCents;
    const direction = delta > 0 ? "aumenta" : delta < 0 ? "diminui" : "permanece igual";
    const statusLabels = { comfortable: "Confortável", attention: "Atenção", critical: "Crítica" } as const;
    const rows = [a, b].map((item) => ({ month: item.month, incomeCents: item.incomeCents, committedCents: item.committedCents, balanceCents: item.projectedBalanceCents, status: statusLabels[item.status] }));
    return {
      text: `De ${monthA} para ${monthB}, o saldo projetado ${direction}${delta ? ` em ${formatCurrency(Math.abs(delta))}` : ""}, passando de ${formatCurrency(a.projectedBalanceCents)} para ${formatCurrency(b.projectedBalanceCents)}.`,
      ui: buildFinancialTable(`comparison-${monthA}-${monthB}`, `Comparação ${monthA} × ${monthB}`, [
        { key: "month", label: "Mês", format: "text" }, { key: "incomeCents", label: "Receita", format: "currency" },
        { key: "committedCents", label: "Comprometido", format: "currency" }, { key: "balanceCents", label: "Saldo", format: "currency" },
        { key: "status", label: "Situação", format: "badge" },
      ], rows),
    };
  }
  if (name === "create_transaction_draft") {
    const occurredAt = localDate();
    let persisted: { id: string };
    try {
      persisted = repository === demoFinancialRepository ? { id: crypto.randomUUID() } : await repository.createTransactionDraft!({
        type: args.type as "expense" | "income" | "refund" | "transfer",
        amountCents: args.amountCents as number, description: args.description as string,
        category: args.category as string, paymentMethod: args.paymentMethod as string, occurredOn: occurredAt,
        installmentCount: args.installmentCount as number,
        belongsToThirdParty: args.belongsToThirdParty as boolean,
        destinationPaymentMethod: args.destinationPaymentMethod as string | undefined,
      }, threadId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("AMBIGUOUS_ENTITY:")) {
        const options = message.slice("AMBIGUOUS_ENTITY:".length).split("|");
        return { text: "Encontrei mais de um meio de pagamento compatível.", ui: buildClarification("Qual deles você quis dizer?", options) };
      }
      if (message.startsWith("ENTITY_NOT_FOUND:")) {
        const entityName = message.slice("ENTITY_NOT_FOUND:".length);
        return {
          text: `Não encontrei ${entityName} entre suas contas e cartões. Nenhum dado foi alterado.`,
          ui: buildClarification(
            `Cadastre ${entityName} primeiro ou refaça o lançamento usando uma conta ou cartão já cadastrado.`,
            [`Cadastre uma conta chamada ${entityName}`, "Mostre meu resumo financeiro"],
          ),
        };
      }
      if (message.startsWith("INVALID_TRANSFER_ACCOUNT:")) {
        const [, role, entityName] = message.split(":");
        return {
          text: `${entityName} existe, mas não foi cadastrada como conta. Nenhum dado foi alterado.`,
          ui: buildClarification(
            `A ${role} de uma transferência precisa ser do tipo Conta. Escolha uma conta válida ou corrija o cadastro de ${entityName}.`,
            ["Mostre meu resumo financeiro"],
          ),
        };
      }
      throw error;
    }
    const draft: TransactionDraft = {
      id: persisted.id, type: args.type as "expense" | "income" | "refund" | "transfer", status: "pending", occurredAt,
      amountCents: args.amountCents as number, description: args.description as string,
      category: args.category as string, paymentMethod: args.paymentMethod as string,
      installmentCount: args.installmentCount as number,
      belongsToThirdParty: args.belongsToThirdParty as boolean,
      destinationPaymentMethod: args.destinationPaymentMethod as string | undefined,
    };
    return { text: "Preparei o rascunho. Revise os dados antes de confirmar:", ui: buildTransactionConfirmation(draft) };
  }
  if (name === "confirm_transaction") {
    const confirmed = await repository.confirmLatestDraft(threadId);
    const refreshed = await overview(localDate().slice(0, 7) as MonthKey, repository);
    return { text: `Despesa confirmada e salva. Referência: ${confirmed.referenceId.slice(0, 8)}. ${refreshed.text}`, ui: refreshed.ui };
  }
  if (name === "correct_latest_transaction_draft") {
    const draft = await repository.createTransactionCorrectionDraft!({ amountCents: args.amountCents as number | undefined, category: args.category as string | undefined,
      description: args.description as string | undefined, occurredOn: args.occurredOn as string | undefined, paymentMethod: args.paymentMethod as string | undefined,
      belongsToThirdParty: args.belongsToThirdParty as boolean | undefined }, threadId);
    const payload = draft.payload;
    const fields = [{ label: "Descrição", value: String(payload.description) }];
    if (payload.previousAmountCents !== payload.amountCents) {
      fields.push({ label: "Valor anterior", value: formatCurrency(Number(payload.previousAmountCents)) }, { label: "Novo valor", value: formatCurrency(Number(payload.amountCents)) });
    }
    if (payload.previousCategory !== payload.category) {
      fields.push({ label: "Categoria anterior", value: String(payload.previousCategory) }, { label: "Nova categoria", value: String(payload.category) });
    }
    if (payload.previousDescription !== payload.description) fields.push({ label: "Descrição anterior", value: String(payload.previousDescription) }, { label: "Nova descrição", value: String(payload.description) });
    if (payload.previousOccurredOn !== payload.occurredOn) fields.push({ label: "Data anterior", value: String(payload.previousOccurredOn) }, { label: "Nova data", value: String(payload.occurredOn) });
    if (payload.paymentMethod && payload.previousEntityId !== payload.entityId) {
      if (payload.previousPaymentMethod) fields.push({ label: "Meio anterior", value: String(payload.previousPaymentMethod) });
      fields.push({ label: "Novo meio de pagamento", value: String(payload.paymentMethod) });
    }
    if (payload.previousBelongsToThirdParty !== payload.belongsToThirdParty) fields.push({ label: "Pertence a terceiro", value: payload.belongsToThirdParty ? "Sim" : "Não" });
    return { text: "Preparei a correção do último lançamento. Ela ainda não foi aplicada.", ui: buildFinancialChangeConfirmation({ title: "Corrigir lançamento", fields }) };
  }
  if (name === "void_latest_transaction_draft") {
    const draft = await repository.createTransactionVoidDraft!(threadId);
    return { text: "Preparei o desfazimento do último lançamento. Ele ainda continua válido até você confirmar.", ui: buildFinancialChangeConfirmation({ title: "Desfazer lançamento", fields: [
      { label: "Descrição", value: String(draft.payload.description) }, { label: "Valor", value: formatCurrency(Number(draft.payload.amountCents)) }, { label: "Categoria", value: String(draft.payload.category) },
    ] }) };
  }
  if (name === "anticipate_installments_draft") {
    const draft = await repository.createInstallmentAnticipationDraft!(args.count as number, threadId);
    const total = (draft.payload.installments as Array<{ amountCents: number }>).reduce((sum, item) => sum + item.amountCents, 0);
    return { text: "Preparei a antecipação das parcelas. O cronograma original será preservado na auditoria.", ui: buildFinancialChangeConfirmation({ title: "Antecipar parcelas", fields: [
      { label: "Compra", value: String(draft.payload.description) }, { label: "Quantidade", value: String(draft.payload.count) },
      { label: "Valor antecipado", value: formatCurrency(total) }, { label: "Fatura de destino", value: String(draft.payload.targetStatementMonth) },
    ] }) };
  }
  if (name === "query_transaction_history") {
    const rows = await repository.getRecentTransactions!(args.limit as number);
    return { text: rows.length ? `Encontrei ${rows.length} lançamentos recentes.` : "Ainda não há lançamentos no histórico.", ui: buildFinancialTable("transaction-history", "Histórico de lançamentos", [
      { key: "occurredOn", label: "Data", format: "date" }, { key: "description", label: "Descrição", format: "text" },
      { key: "type", label: "Tipo", format: "badge" }, { key: "category", label: "Categoria", format: "text" },
      { key: "paymentMethod", label: "Meio", format: "text" }, { key: "amountCents", label: "Valor", format: "currency" },
      { key: "status", label: "Status", format: "badge" },
    ], rows) };
  }
  if (name === "analyze_spending") {
    const { transactions } = await repository.getDataset();
    const month = args.month as MonthKey;
    const analysis = analyzeCategorySpending(transactions, month, [addMonths(month, -2), addMonths(month, -1)]);
    const rows = analysis.map((item) => ({ category: item.category, currentCents: item.currentCents, averageCents: item.averageCents, potentialSavingsCents: item.potentialSavingsCents, trend: item.trend }));
    const best = analysis.find((item) => item.potentialSavingsCents > 0);
    const baselineMonths = [addMonths(month, -2), addMonths(month, -1)];
    return { text: best ? `A maior oportunidade está em ${best.category}: ${formatCurrency(best.potentialSavingsCents)} acima da média de ${baselineMonths.join(" e ")}.` : `Não encontrei gastos acima da média de ${baselineMonths.join(" e ")}.`, ui: buildSpendingAnalysis(month, rows, baselineMonths) };
  }
  const month = args.month as MonthKey;
  const category = args.category as string;
  const { transactions, projections } = await repository.getDataset();
  const analysis = analyzeCategorySpending(transactions, month, [addMonths(month, -2), addMonths(month, -1)]);
  const categoryData = analysis.find((item) => item.category.localeCompare(category, "pt-BR", { sensitivity: "base" }) === 0);
  if (!categoryData) return { text: `Não encontrei gastos na categoria ${category} em ${month}.`, ui: buildClarification("Escolha uma categoria que tenha gastos no mês.", analysis.filter((item) => item.currentCents > 0).map((item) => item.category)) };
  const projectionInput = projections.find((item) => item.month === month);
  if (!projectionInput) return { text: `Não há projeção cadastrada para ${month}; por isso não consigo simular com segurança.`, ui: buildErrorCard(`Cadastre as premissas financeiras de ${month} antes de executar a simulação.`) };
  const projection = calculateMonthlyProjection(projectionInput);
  const scenario = simulateCategoryReduction({ month, category: categoryData.category, currentCategoryCents: categoryData.currentCents, currentProjectedBalanceCents: projection.projectedBalanceCents, reductionPercentage: args.reductionPercentage as number });
  const rows = [{ scenario: "Atual", categoryCents: categoryData.currentCents, balanceCents: projection.projectedBalanceCents }, { scenario: `Redução de ${args.reductionPercentage}%`, categoryCents: scenario.adjustedCategoryCents, balanceCents: scenario.projectedBalanceCents }];
  return { text: `Reduzindo ${categoryData.category} em ${args.reductionPercentage}%, a economia estimada é ${formatCurrency(scenario.savingsCents)} e o saldo projetado passa de ${formatCurrency(projection.projectedBalanceCents)} para ${formatCurrency(scenario.projectedBalanceCents)}. Nenhum dado será alterado.`, ui: buildScenarioComparison({ month, category: categoryData.category, reductionPercentage: args.reductionPercentage, savingsCents: scenario.savingsCents, currentCategoryCents: categoryData.currentCents, currentProjectedBalanceCents: projection.projectedBalanceCents, rows }) };
}
