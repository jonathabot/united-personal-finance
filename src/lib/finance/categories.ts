import { dateMonth } from "./calendar";
import type { FinanceTransaction, MonthKey } from "./types";

type CategoryTotal = { category: string; amountCents: number };

function categoryKey(category: string) {
  return category
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

function categoryLabel(category: string) {
  const trimmed = category.trim().replace(/\s+/g, " ");
  return trimmed.charAt(0).toLocaleUpperCase("pt-BR") + trimmed.slice(1);
}

function categoryTotals(transactions: readonly FinanceTransaction[], month: MonthKey) {
  const totals = new Map<string, CategoryTotal>();
  for (const transaction of transactions) {
    if (transaction.status !== "confirmed" || transaction.belongsToThirdParty || dateMonth(transaction.occurredAt) !== month) continue;
    const signed = transaction.type === "expense" ? transaction.amountCents : transaction.type === "refund" ? -transaction.amountCents : 0;
    if (signed !== 0) {
      const key = categoryKey(transaction.category);
      const previous = totals.get(key);
      totals.set(key, {
        category: previous?.category ?? categoryLabel(transaction.category),
        amountCents: (previous?.amountCents ?? 0) + signed,
      });
    }
  }
  return totals;
}

export function hasCategorySpendingHistory(
  transactions: readonly FinanceTransaction[],
  months: readonly MonthKey[],
) {
  return months.some((month) => categoryTotals(transactions, month).size > 0);
}

export function analyzeCategorySpending(
  transactions: readonly FinanceTransaction[],
  currentMonth: MonthKey,
  baselineMonths: readonly MonthKey[],
) {
  const current = categoryTotals(transactions, currentMonth);
  const baseline = baselineMonths.map((month) => categoryTotals(transactions, month));
  const categories = new Set([...current.keys(), ...baseline.flatMap((totals) => [...totals.keys()])]);

  return [...categories].map((key) => {
    const category = current.get(key)?.category ?? baseline.find((values) => values.has(key))?.get(key)?.category ?? key;
    const currentCents = current.get(key)?.amountCents ?? 0;
    const baselineTotal = baseline.reduce((total, values) => total + (values.get(key)?.amountCents ?? 0), 0);
    const averageCents = baseline.length ? Math.round(baselineTotal / baseline.length) : 0;
    const differenceCents = currentCents - averageCents;
    return {
      category,
      currentCents,
      averageCents,
      differenceCents,
      // A new category has no historical baseline, so it is not labeled as a
      // savings opportunity until there is something meaningful to compare.
      potentialSavingsCents: averageCents > 0 ? Math.max(0, differenceCents) : 0,
      trend: differenceCents > 0 ? "up" : differenceCents < 0 ? "down" : "stable",
    } as const;
  }).sort((a, b) => b.potentialSavingsCents - a.potentialSavingsCents || a.category.localeCompare(b.category));
}
