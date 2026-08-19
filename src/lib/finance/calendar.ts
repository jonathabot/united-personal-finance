import type { MonthKey } from "./types";

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const monthPattern = /^(\d{4})-(\d{2})$/;

export function parseLocalDate(value: string) {
  const match = datePattern.exec(value);
  if (!match) throw new TypeError("Date must use YYYY-MM-DD.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > maxDay) throw new RangeError("Invalid calendar date.");
  return { year, month, day };
}

export function monthKey(year: number, month: number): MonthKey {
  if (!Number.isSafeInteger(year) || !Number.isSafeInteger(month) || month < 1 || month > 12) {
    throw new RangeError("Invalid year or month.");
  }
  return `${year}-${String(month).padStart(2, "0")}` as MonthKey;
}

export function parseMonth(value: MonthKey) {
  const match = monthPattern.exec(value);
  if (!match) throw new TypeError("Month must use YYYY-MM.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new RangeError("Invalid calendar month.");
  return { year, month };
}

export function addMonths(value: MonthKey, offset: number): MonthKey {
  if (!Number.isSafeInteger(offset)) throw new TypeError("Month offset must be an integer.");
  const { year, month } = parseMonth(value);
  const absolute = year * 12 + month - 1 + offset;
  const nextYear = Math.floor(absolute / 12);
  const nextMonth = ((absolute % 12) + 12) % 12 + 1;
  return monthKey(nextYear, nextMonth);
}

export function dateMonth(value: string): MonthKey {
  const { year, month } = parseLocalDate(value);
  return monthKey(year, month);
}

