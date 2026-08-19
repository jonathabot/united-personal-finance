import { splitIntoInstallments } from "../money";
import { addMonths, parseMonth } from "./calendar";
import type { Installment, MonthKey } from "./types";

export function createInstallmentSchedule(totalCents: number, count: number, firstStatementMonth: MonthKey): Installment[] {
  return splitIntoInstallments(totalCents, count).map((amountCents, index) => ({
    number: index + 1,
    amountCents,
    statementMonth: addMonths(firstStatementMonth, index),
  }));
}

function monthIndex(value: MonthKey) {
  const { year, month } = parseMonth(value);
  return year * 12 + month;
}

export function summarizeInstallments(schedule: readonly Installment[], statementMonth: MonthKey) {
  const selectedMonth = monthIndex(statementMonth);
  const currentCents = schedule
    .filter((installment) => monthIndex(installment.statementMonth) === selectedMonth)
    .reduce((total, installment) => total + installment.amountCents, 0);
  const futureCents = schedule
    .filter((installment) => monthIndex(installment.statementMonth) > selectedMonth)
    .reduce((total, installment) => total + installment.amountCents, 0);

  if (![currentCents, futureCents].every(Number.isSafeInteger)) {
    throw new RangeError("Installment totals exceed the safe integer range.");
  }

  return { statementMonth, currentCents, futureCents };
}
