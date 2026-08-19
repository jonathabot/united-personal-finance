import { describe, expect, it } from "vitest";
import { formatCurrency, parseDecimalToCents, splitIntoInstallments } from "./money";

describe("money", () => {
  it("formats integer cents as Brazilian currency", () => {
    expect(formatCurrency(120400)).toBe("R$\u00a01.204,00");
  });

  it("puts rounding differences in the last installment", () => {
    const installments = splitIntoInstallments(10000, 3);

    expect(installments).toEqual([3333, 3333, 3334]);
    expect(installments.reduce((total, value) => total + value, 0)).toBe(10000);
  });

  it("rejects fractional cents", () => {
    expect(() => splitIntoInstallments(100.5, 2)).toThrow();
  });
});

describe("parseDecimalToCents", () => {
  it("converts Brazilian decimal strings without floating point arithmetic", () => {
    expect(parseDecimalToCents("35")).toBe(3500);
    expect(parseDecimalToCents("35,90")).toBe(3590);
    expect(parseDecimalToCents("1.234,56")).toBe(123456);
  });
});
