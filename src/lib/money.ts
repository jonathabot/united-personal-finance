export function formatCurrency(cents: number, locale = "pt-BR", currency = "BRL") {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError("Money must be represented as an integer number of cents.");
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function parseDecimalToCents(value: string): number {
  const normalized = value.trim().replace(/\s/g, "").replace(".", "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new TypeError("Money must be a positive decimal with at most two decimal places.");
  }
  const [whole, decimal = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new RangeError("Money exceeds the safe integer range.");
  return cents;
}

export function splitIntoInstallments(totalCents: number, count: number): number[] {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new RangeError("The total must be a positive integer number of cents.");
  }

  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new RangeError("The installment count must be a positive integer.");
  }

  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;

  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? base + remainder : base,
  );
}
