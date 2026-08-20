import type { CreditCardConfig, FinanceTransaction, MonthlyProjectionInput, PersistedInstallment } from "../finance";

export type FinancialDataset = {
  cards: CreditCardConfig[];
  transactions: FinanceTransaction[];
  projections: MonthlyProjectionInput[];
  installments?: PersistedInstallment[];
};

export type CreateEntityDraftInput = {
  kind: "income" | "credit_card" | "fixed_expense" | "loan" | "reserve" | "account";
  name: string;
  amountCents?: number;
  effectiveFrom: string;
  closingDay?: number;
  dueDay?: number;
};

export type ChangeEntityValueDraftInput = { name: string; amountCents: number; effectiveFrom: string };
export type CloseEntityDraftInput = { name: string; inactiveFrom: string; status: "inactive" | "settled" };
export type CreateTransactionDraftInput = {
  type: "expense" | "income" | "refund" | "transfer";
  amountCents: number;
  description: string;
  category: string;
  paymentMethod: string;
  occurredOn: string;
  installmentCount: number;
  belongsToThirdParty: boolean;
  destinationPaymentMethod?: string;
};
export type CorrectTransactionDraftInput = { amountCents?: number; category?: string; description?: string; occurredOn?: string; paymentMethod?: string; belongsToThirdParty?: boolean };
export type RecentTransaction = { id: string; type: string; amountCents: number; occurredOn: string; description: string; category: string; paymentMethod: string; status: string };

export type FinancialChangeDraft = { id: string; action: "create_entity" | "rename_entity" | "update_value" | "close_entity" | "create_transaction" | "update_transaction" | "void_transaction" | "anticipate_installments"; payload: Record<string, unknown> };

export interface FinancialRepository {
  getDataset(): Promise<FinancialDataset>;
  createEntityDraft(input: CreateEntityDraftInput, threadId: string): Promise<FinancialChangeDraft>;
  createRenameDraft(currentName: string, newName: string, threadId: string): Promise<FinancialChangeDraft>;
  createValueChangeDraft(input: ChangeEntityValueDraftInput, threadId: string): Promise<FinancialChangeDraft>;
  createCloseDraft(input: CloseEntityDraftInput, threadId: string): Promise<FinancialChangeDraft>;
  createTransactionDraft?(input: CreateTransactionDraftInput, threadId: string): Promise<FinancialChangeDraft>;
  createTransactionCorrectionDraft?(input: CorrectTransactionDraftInput, threadId: string): Promise<FinancialChangeDraft>;
  createTransactionVoidDraft?(threadId: string): Promise<FinancialChangeDraft>;
  createInstallmentAnticipationDraft?(count: number, threadId: string): Promise<FinancialChangeDraft>;
  getRecentTransactions?(limit: number): Promise<RecentTransaction[]>;
  cancelLatestDraft(threadId: string): Promise<void>;
  confirmLatestDraft(threadId: string): Promise<{ action: string; referenceId: string }>;
}
