import { demoCards, demoProjections, demoTransactions } from "../data/demo-financial-data";
import type { FinancialRepository } from "./financial-repository";

export const demoFinancialRepository: FinancialRepository = {
  async getDataset() {
    return { cards: demoCards, transactions: demoTransactions, projections: demoProjections };
  },
  async createEntityDraft() { throw new Error("Persistência indisponível no modo demonstração."); },
  async createRenameDraft() { throw new Error("Persistência indisponível no modo demonstração."); },
  async createValueChangeDraft() { throw new Error("Persistência indisponível no modo demonstração."); },
  async createCloseDraft() { throw new Error("Persistência indisponível no modo demonstração."); },
  async createTransactionDraft() { throw new Error("Persistência indisponível no modo demonstração."); },
  async createTransactionCorrectionDraft() { throw new Error("Persistência indisponível no modo demonstração."); },
  async createTransactionVoidDraft() { throw new Error("Persistência indisponível no modo demonstração."); },
  async createInstallmentAnticipationDraft() { throw new Error("Persistência indisponível no modo demonstração."); },
  async getRecentTransactions() { return []; },
  async cancelLatestDraft() { throw new Error("Persistência indisponível no modo demonstração."); },
  async confirmLatestDraft() { throw new Error("Persistência indisponível no modo demonstração."); },
};
