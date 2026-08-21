import { describe, expect, it } from "vitest";
import { inferToolFromIntent } from "../conversation";
import { portugueseIntentEvals } from "./portuguese-intent-cases";

describe("Agent Evals: intenções financeiras em português", () => {
  it.each(portugueseIntentEvals)("$id: $utterance", ({ utterance, expectedIntent }) => {
    expect(inferToolFromIntent(utterance)).toBe(expectedIntent);
  });
});
