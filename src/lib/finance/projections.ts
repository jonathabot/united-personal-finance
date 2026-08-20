import type { MonthlyProjectionInput } from "./types";
import { assertCents } from "./types";

export type HealthThresholds = {
  attentionBalanceCents: number;
  attentionCommittedPercentage: number;
};

export const defaultHealthThresholds: HealthThresholds = {
  attentionBalanceCents: 50000,
  attentionCommittedPercentage: 80,
};

export function calculateMonthlyProjection(
  input: MonthlyProjectionInput,
  thresholds: HealthThresholds = defaultHealthThresholds,
) {
  assertCents(input.incomeCents, "incomeCents");
  assertCents(input.fixedExpensesCents, "fixedExpensesCents");
  assertCents(input.invoiceCents, "invoiceCents");
  assertCents(input.futureInstallmentsCents, "futureInstallmentsCents");
  assertCents(input.variableExpensesCents ?? 0, "variableExpensesCents");
  assertCents(thresholds.attentionBalanceCents, "attentionBalanceCents");

  const committedCents = input.fixedExpensesCents + input.invoiceCents + input.futureInstallmentsCents + (input.variableExpensesCents ?? 0);
  if (!Number.isSafeInteger(committedCents)) throw new RangeError("Projection exceeds the safe integer range.");
  const projectedBalanceCents = input.incomeCents - committedCents;
  const committedIncomePercentage = input.incomeCents === 0
    ? committedCents === 0 ? 0 : 100
    : Math.round((committedCents * 10000) / input.incomeCents) / 100;
  const status = projectedBalanceCents < 0
    ? "critical"
    : projectedBalanceCents < thresholds.attentionBalanceCents || committedIncomePercentage >= thresholds.attentionCommittedPercentage
      ? "attention"
      : "comfortable";

  return { ...input, committedCents, projectedBalanceCents, committedIncomePercentage, status } as const;
}

export function projectMonths(
  inputs: readonly MonthlyProjectionInput[],
  thresholds: HealthThresholds = defaultHealthThresholds,
) {
  return inputs.map((input) => calculateMonthlyProjection(input, thresholds));
}
