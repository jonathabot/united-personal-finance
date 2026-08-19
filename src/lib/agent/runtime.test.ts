import { afterEach, describe, expect, it, vi } from "vitest";
import { runAgent } from "./runtime";

afterEach(() => vi.unstubAllEnvs());

describe("demo agent tool routing", () => {
  it("routes next-month questions to the financial overview", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const result = await runAgent([{ role: "user", content: "Vou ficar apertado no próximo mês?" }]);

    expect(result.provider).toBe("demo");
    expect(result.text).toContain("2026-09");
    expect(result.text).toContain("saldo projetado");
    expect(result.ui).toBeDefined();
  });

  it("routes savings questions to category analysis", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const result = await runAgent([{ role: "user", content: "No que posso economizar?" }]);

    expect(result.text).toContain("Delivery");
    expect(result.ui).toBeDefined();
  });

  it("routes hypothetical questions to scenario simulation", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const result = await runAgent([{ role: "user", content: "E se eu reduzir delivery pela metade?" }]);

    expect(result.text).toContain("50%");
    expect(result.text).toContain("economia estimada");
  });
});
