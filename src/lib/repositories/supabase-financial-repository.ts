import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths, calculateMonthlySummary, createInstallmentSchedule, getStatementMonth, monthKey, type FinanceTransaction, type MonthKey, type MonthlyProjectionInput, type PersistedInstallment } from "../finance";
import type { ChangeEntityValueDraftInput, CloseEntityDraftInput, CorrectTransactionDraftInput, CreateEntityDraftInput, CreateTransactionDraftInput, FinancialChangeDraft, FinancialDataset, FinancialRepository, RecentTransaction } from "./financial-repository";

type EntityRow = { id: string; kind: string; name: string; status: string; closing_day: number | null; due_day: number | null; active_from: string; active_until: string | null };
type RecurringRow = { entity_id: string; amount_cents: number | string; effective_from: string; effective_until: string | null };
type OverrideRow = { entity_id: string; month: string; amount_cents: number | string };
type TransactionRow = { id: string; entity_id: string | null; type: FinanceTransaction["type"]; amount_cents: number | string; occurred_on: string; description: string; category: string; belongs_to_third_party: boolean; status: FinanceTransaction["status"] };
type InstallmentRow = { transaction_id: string; entity_id: string; installment_number: number; statement_month: string; amount_cents: number | string; status: PersistedInstallment["status"] };

function currentMonth(timeZone = "America/Sao_Paulo"): MonthKey {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts();
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return monthKey(year, month);
}

function currentLocalDate(timeZone = "America/Sao_Paulo") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts();
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function monthDate(month: MonthKey) {
  return `${month}-01`;
}

function isEntityActive(entity: EntityRow, month: MonthKey) {
  const date = monthDate(month);
  return entity.status !== "archived" && entity.active_from <= `${month}-31` && (!entity.active_until || entity.active_until >= date);
}

function valueForMonth(entityId: string, month: MonthKey, recurring: RecurringRow[], overrides: OverrideRow[]) {
  const override = overrides.find((item) => item.entity_id === entityId && item.month.startsWith(month));
  if (override) return Number(override.amount_cents);
  return recurring
    .filter((item) => item.entity_id === entityId && item.effective_from <= monthDate(month) && (!item.effective_until || item.effective_until >= monthDate(month)))
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
    .map((item) => Number(item.amount_cents))[0] ?? 0;
}

export class SupabaseFinancialRepository implements FinancialRepository {
  constructor(private readonly client: SupabaseClient, private readonly userId: string) {}

  private normalize(value: string) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
  }

  async createEntityDraft(input: CreateEntityDraftInput, threadId: string): Promise<FinancialChangeDraft> {
    const payload = { ...input, normalizedName: this.normalize(input.name), effectiveFrom: `${input.effectiveFrom}-01` };
    const { data, error } = await this.client.from("pending_financial_changes").insert({
      user_id: this.userId, client_thread_id: threadId, action: "create_entity", payload,
    }).select("id,action,payload").single();
    if (error) throw new Error(`Não foi possível criar o rascunho: ${error.message}`);
    return data as FinancialChangeDraft;
  }

  async createRenameDraft(currentName: string, newName: string, threadId: string): Promise<FinancialChangeDraft> {
    const normalized = this.normalize(currentName);
    let { data: entity } = await this.client.from("financial_entities").select("id,name").eq("normalized_name", normalized).maybeSingle();
    if (!entity) {
      const { data: alias } = await this.client.from("financial_entity_aliases").select("entity_id").eq("normalized_alias", normalized).maybeSingle();
      if (alias) ({ data: entity } = await this.client.from("financial_entities").select("id,name").eq("id", alias.entity_id).maybeSingle());
    }
    if (!entity) throw new Error(`Não encontrei uma entidade chamada ${currentName}.`);
    const payload = { entityId: entity.id, currentName: entity.name, newName, newNormalizedName: this.normalize(newName) };
    const { data, error } = await this.client.from("pending_financial_changes").insert({
      user_id: this.userId, client_thread_id: threadId, action: "rename_entity", payload,
    }).select("id,action,payload").single();
    if (error) throw new Error(`Não foi possível criar o rascunho: ${error.message}`);
    return data as FinancialChangeDraft;
  }

  private async findEntity(name: string) {
    const normalized = this.normalize(name);
    let { data: entity } = await this.client.from("financial_entities").select("id,name,kind,closing_day,due_day").eq("normalized_name", normalized).maybeSingle();
    if (!entity) {
      const { data: alias } = await this.client.from("financial_entity_aliases").select("entity_id").eq("normalized_alias", normalized).maybeSingle();
      if (alias) ({ data: entity } = await this.client.from("financial_entities").select("id,name,kind,closing_day,due_day").eq("id", alias.entity_id).maybeSingle());
    }
    if (!entity) {
      const { data: candidates } = await this.client.from("financial_entities").select("id,name,kind,closing_day,due_day").ilike("normalized_name", `%${normalized}%`).eq("status", "active").limit(5);
      if ((candidates?.length ?? 0) > 1) throw new Error(`AMBIGUOUS_ENTITY:${candidates!.map((item) => item.name).join("|")}`);
      if (candidates?.length === 1) entity = candidates[0];
    }
    if (!entity) throw new Error(`ENTITY_NOT_FOUND:${name}`);
    return entity;
  }

  async createValueChangeDraft(input: ChangeEntityValueDraftInput, threadId: string): Promise<FinancialChangeDraft> {
    const entity = await this.findEntity(input.name);
    const payload = { entityId: entity.id, name: entity.name, amountCents: input.amountCents, effectiveFrom: `${input.effectiveFrom}-01` };
    const { data, error } = await this.client.from("pending_financial_changes").insert({ user_id: this.userId, client_thread_id: threadId, action: "update_value", payload }).select("id,action,payload").single();
    if (error) throw new Error(`Não foi possível criar o rascunho: ${error.message}`);
    return data as FinancialChangeDraft;
  }

  async createCloseDraft(input: CloseEntityDraftInput, threadId: string): Promise<FinancialChangeDraft> {
    const entity = await this.findEntity(input.name);
    const payload = { entityId: entity.id, name: entity.name, inactiveFrom: `${input.inactiveFrom}-01`, status: input.status };
    const { data, error } = await this.client.from("pending_financial_changes").insert({ user_id: this.userId, client_thread_id: threadId, action: "close_entity", payload }).select("id,action,payload").single();
    if (error) throw new Error(`Não foi possível criar o rascunho: ${error.message}`);
    return data as FinancialChangeDraft;
  }

  async createTransactionDraft(input: CreateTransactionDraftInput, threadId: string): Promise<FinancialChangeDraft> {
    let entityId: string | null = null;
    if (input.paymentMethod !== "Não informado") {
      const entity = await this.findEntity(input.paymentMethod);
      if (entity.kind !== "credit_card" && entity.kind !== "account") {
        throw new Error(`${input.paymentMethod} não é um cartão ou uma conta de pagamento.`);
      }
      entityId = entity.id;
      if (input.type === "transfer" && entity.kind !== "account") throw new Error(`INVALID_TRANSFER_ACCOUNT:origem:${entity.name}:${entity.kind}`);
    }
    if (input.installmentCount > 1 && (input.type !== "expense" || !entityId || input.paymentMethod === "Não informado")) {
      throw new Error("Compras parceladas exigem um cartão cadastrado.");
    }
    let installmentSchedule: ReturnType<typeof createInstallmentSchedule> = [];
    if (input.installmentCount > 1) {
      const entity = await this.findEntity(input.paymentMethod);
      if (!entity.closing_day || !entity.due_day) throw new Error("O cartão não possui fechamento e vencimento válidos.");
      const firstStatementMonth = getStatementMonth(input.occurredOn, { id: entity.id, name: entity.name, closingDay: entity.closing_day, dueDay: entity.due_day });
      installmentSchedule = createInstallmentSchedule(input.amountCents, input.installmentCount, firstStatementMonth);
    }
    let destinationEntityId: string | null = null;
    if (input.type === "transfer") {
      if (!input.destinationPaymentMethod) throw new Error("Transferências exigem uma conta de destino.");
      const destination = await this.findEntity(input.destinationPaymentMethod);
      if (destination.kind !== "account") throw new Error(`INVALID_TRANSFER_ACCOUNT:destino:${destination.name}:${destination.kind}`);
      if (destination.id === entityId) throw new Error("Origem e destino da transferência devem ser diferentes.");
      destinationEntityId = destination.id;
    }
    let relatedTransactionId: string | null = null;
    if (input.type === "refund" && entityId) {
      const { data: related } = await this.client.from("transactions").select("id").eq("entity_id", entityId).eq("type", "expense").eq("status", "confirmed")
        .order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
      relatedTransactionId = related?.id ?? null;
    }
    const payload = { ...input, entityId, destinationEntityId, relatedTransactionId, installmentSchedule };
    const { data, error } = await this.client.from("pending_financial_changes").insert({
      user_id: this.userId, client_thread_id: threadId, action: "create_transaction", payload,
    }).select("id,action,payload").single();
    if (error) throw new Error(`Não foi possível criar o rascunho: ${error.message}`);
    return data as FinancialChangeDraft;
  }

  private async latestTransactionInThread(threadId: string) {
    const { data: changes, error: changeError } = await this.client.from("pending_financial_changes")
      .select("result").eq("client_thread_id", threadId).eq("action", "create_transaction").eq("status", "confirmed")
      .order("confirmed_at", { ascending: false }).limit(20);
    if (changeError) throw new Error(`Não foi possível localizar o último lançamento: ${changeError.message}`);
    const transactionId = (changes ?? []).map((change) => (change.result as Record<string, unknown> | null)?.referenceId).find((id): id is string => typeof id === "string");
    if (!transactionId) throw new Error("Não encontrei um lançamento confirmado nesta conversa.");
    const { data, error } = await this.client.from("transactions").select("id,entity_id,amount_cents,occurred_on,description,category,belongs_to_third_party,status").eq("id", transactionId).single();
    if (error || !data) throw new Error("O último lançamento não está mais disponível.");
    if (data.status === "voided") throw new Error("O último lançamento já foi desfeito.");
    return { id: data.id as string, entityId: data.entity_id as string | null, amountCents: Number(data.amount_cents), occurredOn: data.occurred_on as string, description: data.description as string, category: data.category as string, belongsToThirdParty: Boolean(data.belongs_to_third_party) };
  }

  async createTransactionCorrectionDraft(input: CorrectTransactionDraftInput, threadId: string): Promise<FinancialChangeDraft> {
    const transaction = await this.latestTransactionInThread(threadId);
    let entityId = transaction.entityId;
    let paymentMethod: string | undefined;
    let previousPaymentMethod: string | undefined;
    if (input.paymentMethod) {
      if (transaction.entityId) {
        const { data: previousEntity } = await this.client.from("financial_entities").select("name").eq("id", transaction.entityId).maybeSingle();
        previousPaymentMethod = previousEntity?.name as string | undefined;
      }
      const entity = await this.findEntity(input.paymentMethod);
      if (entity.kind !== "credit_card" && entity.kind !== "account") throw new Error("O novo meio de pagamento deve ser uma conta ou cartão.");
      entityId = entity.id; paymentMethod = entity.name;
    }
    const payload = { transactionId: transaction.id, previousDescription: transaction.description, description: input.description ?? transaction.description,
      previousAmountCents: transaction.amountCents, amountCents: input.amountCents ?? transaction.amountCents,
      previousCategory: transaction.category, category: input.category ?? transaction.category,
      previousOccurredOn: transaction.occurredOn, occurredOn: input.occurredOn ?? transaction.occurredOn,
      previousEntityId: transaction.entityId, entityId, previousPaymentMethod, paymentMethod,
      previousBelongsToThirdParty: transaction.belongsToThirdParty, belongsToThirdParty: input.belongsToThirdParty ?? transaction.belongsToThirdParty };
    const { data, error } = await this.client.from("pending_financial_changes").insert({ user_id: this.userId, client_thread_id: threadId, action: "update_transaction", payload }).select("id,action,payload").single();
    if (error) throw new Error(`Não foi possível criar a correção: ${error.message}`);
    return data as FinancialChangeDraft;
  }

  async createTransactionVoidDraft(threadId: string): Promise<FinancialChangeDraft> {
    const transaction = await this.latestTransactionInThread(threadId);
    const payload = { transactionId: transaction.id, description: transaction.description, amountCents: transaction.amountCents, category: transaction.category };
    const { data, error } = await this.client.from("pending_financial_changes").insert({ user_id: this.userId, client_thread_id: threadId, action: "void_transaction", payload }).select("id,action,payload").single();
    if (error) throw new Error(`Não foi possível criar o desfazimento: ${error.message}`);
    return data as FinancialChangeDraft;
  }

  async createInstallmentAnticipationDraft(count: number, threadId: string): Promise<FinancialChangeDraft> {
    const transaction = await this.latestTransactionInThread(threadId);
    if (!transaction.entityId) throw new Error("O lançamento não está associado a um cartão.");
    const { data: card } = await this.client.from("financial_entities").select("id,name,closing_day,due_day").eq("id", transaction.entityId).eq("kind", "credit_card").single();
    if (!card?.closing_day || !card.due_day) throw new Error("O cartão não possui calendário válido.");
    const { data: rows, error } = await this.client.from("installments").select("id,installment_number,statement_month,amount_cents")
      .eq("transaction_id", transaction.id).eq("status", "scheduled").order("installment_number", { ascending: false }).limit(count);
    if (error || !rows?.length) throw new Error("Não encontrei parcelas futuras para antecipar.");
    if (rows.length < count) throw new Error(`Existem apenas ${rows.length} parcelas disponíveis para antecipação.`);
    const payload = { transactionId: transaction.id, description: transaction.description, count, installmentIds: rows.map((row) => row.id),
      installments: rows.map((row) => ({ number: row.installment_number, statementMonth: row.statement_month, amountCents: Number(row.amount_cents) })),
      targetStatementMonth: getStatementMonth(currentLocalDate(), { id: card.id, name: card.name, closingDay: card.closing_day, dueDay: card.due_day }) };
    const { data, error: insertError } = await this.client.from("pending_financial_changes").insert({ user_id: this.userId, client_thread_id: threadId, action: "anticipate_installments", payload }).select("id,action,payload").single();
    if (insertError) throw new Error(`Não foi possível preparar a antecipação: ${insertError.message}`);
    return data as FinancialChangeDraft;
  }

  async getRecentTransactions(limit: number): Promise<RecentTransaction[]> {
    const [{ data: rows, error }, { data: entities }] = await Promise.all([
      this.client.from("transactions").select("id,entity_id,type,amount_cents,occurred_on,description,category,status").order("created_at", { ascending: false }).limit(limit),
      this.client.from("financial_entities").select("id,name"),
    ]);
    if (error) throw new Error(`Não foi possível consultar o histórico: ${error.message}`);
    const names = new Map((entities ?? []).map((item) => [item.id, item.name]));
    return (rows ?? []).map((row) => ({ id: row.id, type: row.type, amountCents: Number(row.amount_cents), occurredOn: row.occurred_on,
      description: row.description, category: row.category, paymentMethod: names.get(row.entity_id) ?? "—", status: row.status }));
  }

  async cancelLatestDraft(threadId: string): Promise<void> {
    const { error } = await this.client.rpc("cancel_financial_change", { p_client_thread_id: threadId });
    if (error) throw new Error(`Não foi possível cancelar o rascunho: ${error.message}`);
  }

  async confirmLatestDraft(threadId: string): Promise<{ action: string; referenceId: string }> {
    const { data: draft, error: draftError } = await this.client.from("pending_financial_changes").select("id,action,payload").eq("client_thread_id", threadId).in("status", ["pending", "confirmed"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (draftError || !draft) throw new Error("Não encontrei um rascunho pendente nesta conversa.");
    const installmentCount = Number((draft.payload as Record<string, unknown> | null)?.installmentCount ?? 1);
    const rpc = draft.action === "create_transaction" && installmentCount > 1 ? "confirm_installment_transaction"
      : draft.action === "update_transaction" || draft.action === "void_transaction" ? "confirm_transaction_revision"
        : draft.action === "anticipate_installments" ? "confirm_installment_anticipation"
          : draft.action === "create_transaction" && (draft.payload as Record<string, unknown>)?.type !== "expense" ? "confirm_extended_transaction" : "confirm_financial_change";
    const { data, error } = await this.client.rpc(rpc, { p_draft_id: draft.id });
    if (error) throw new Error(`Não foi possível confirmar a mudança: ${error.message}`);
    return data as { action: string; referenceId: string };
  }

  async getDataset(): Promise<FinancialDataset> {
    const [entitiesResult, recurringResult, overridesResult, transactionsResult, installmentsResult] = await Promise.all([
      this.client.from("financial_entities").select("id,kind,name,status,closing_day,due_day,active_from,active_until"),
      this.client.from("recurring_values").select("entity_id,amount_cents,effective_from,effective_until"),
      this.client.from("monthly_overrides").select("entity_id,month,amount_cents"),
      this.client.from("transactions").select("id,entity_id,type,amount_cents,occurred_on,description,category,belongs_to_third_party,status"),
      this.client.from("installments").select("transaction_id,entity_id,installment_number,statement_month,amount_cents,status"),
    ]);
    const error = [entitiesResult.error, recurringResult.error, overridesResult.error, transactionsResult.error, installmentsResult.error].find(Boolean);
    if (error) throw new Error(`Não foi possível consultar os dados financeiros: ${error.message}`);

    const entities = (entitiesResult.data ?? []) as EntityRow[];
    const recurring = (recurringResult.data ?? []) as RecurringRow[];
    const overrides = (overridesResult.data ?? []) as OverrideRow[];
    const installmentRows = (installmentsResult.data ?? []) as InstallmentRow[];
    const installments: PersistedInstallment[] = installmentRows.map((row) => ({ transactionId: row.transaction_id, entityId: row.entity_id, number: row.installment_number, statementMonth: row.statement_month.slice(0, 7) as MonthKey, amountCents: Number(row.amount_cents), status: row.status }));
    const cards = entities
      .filter((entity) => entity.kind === "credit_card" && entity.closing_day && entity.due_day)
      .map((entity) => ({ id: entity.id, name: entity.name, closingDay: entity.closing_day as number, dueDay: entity.due_day as number }));
    const cardIds = new Set(cards.map((card) => card.id));
    const transactions: FinanceTransaction[] = ((transactionsResult.data ?? []) as TransactionRow[]).map((row) => ({
      id: row.id, type: row.type, amountCents: Number(row.amount_cents), occurredAt: row.occurred_on,
      description: row.description, category: row.category, belongsToThirdParty: row.belongs_to_third_party,
      status: row.status, creditCardId: row.entity_id && cardIds.has(row.entity_id) ? row.entity_id : undefined,
    }));
    const firstMonth = currentMonth();
    const months = Array.from({ length: 12 }, (_, index) => addMonths(firstMonth, index));
    const projections: MonthlyProjectionInput[] = months.map((month) => {
      const active = entities.filter((entity) => isEntityActive(entity, month));
      const monthlyTransactions = transactions.filter((transaction) => transaction.status === "confirmed" && !transaction.belongsToThirdParty && transaction.occurredAt.slice(0, 7) === month);
      const recurringIncomeCents = active.filter((entity) => entity.kind === "income").reduce((sum, entity) => sum + valueForMonth(entity.id, month, recurring, overrides), 0);
      const adHocIncomeCents = monthlyTransactions.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amountCents, 0);
      const incomeCents = recurringIncomeCents + adHocIncomeCents;
      const fixedExpensesCents = active.filter((entity) => entity.kind === "fixed_expense" || entity.kind === "loan").reduce((sum, entity) => sum + valueForMonth(entity.id, month, recurring, overrides), 0);
      const invoiceCents = calculateMonthlySummary(transactions, month, cards, installments).invoiceTotalCents;
      const futureInstallmentsCents = 0;
      const directExpenseCents = monthlyTransactions.filter((transaction) => !transaction.creditCardId).reduce((sum, transaction) =>
        sum + (transaction.type === "expense" ? transaction.amountCents : transaction.type === "refund" ? -transaction.amountCents : 0), 0);
      const variableExpensesCents = Math.max(0, directExpenseCents);
      return { month, incomeCents, fixedExpensesCents, invoiceCents, futureInstallmentsCents, variableExpensesCents };
    });
    return { cards, transactions, projections, installments };
  }
}
