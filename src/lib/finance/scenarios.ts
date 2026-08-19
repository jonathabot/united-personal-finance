import type { MonthKey } from "./types";

export type CategoryScenarioInput = {
  month: MonthKey;
  category: string;
  currentCategoryCents: number;
  currentProjectedBalanceCents: number;
  reductionPercentage: number;
};

export function simulateCategoryReduction(input: CategoryScenarioInput) {
  if (!Number.isSafeInteger(input.currentCategoryCents) || input.currentCategoryCents < 0) {
    throw new RangeError("currentCategoryCents must be a non-negative integer.");
  }
  if (!Number.isSafeInteger(input.currentProjectedBalanceCents)) {
    throw new RangeError("currentProjectedBalanceCents must be a safe integer.");
  }
  if (!Number.isSafeInteger(input.reductionPercentage) || input.reductionPercentage < 0 || input.reductionPercentage > 100) {
    throw new RangeError("reductionPercentage must be an integer between 0 and 100.");
  }
  const savingsCents = Math.floor((input.currentCategoryCents * input.reductionPercentage) / 100);
  const adjustedCategoryCents = input.currentCategoryCents - savingsCents;
  const projectedBalanceCents = input.currentProjectedBalanceCents + savingsCents;
  if (![savingsCents, adjustedCategoryCents, projectedBalanceCents].every(Number.isSafeInteger)) {
    throw new RangeError("Scenario exceeds the safe integer range.");
  }
  return { ...input, savingsCents, adjustedCategoryCents, projectedBalanceCents };
}

