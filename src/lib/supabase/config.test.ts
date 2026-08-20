import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseConfig, isSupabaseConfigured } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("Supabase configuration", () => {
  it("requires both public variables", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(isSupabaseConfigured()).toBe(false);
    expect(() => getSupabaseConfig()).toThrow("não está configurado");
  });

  it("returns public SSR configuration without a service key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(getSupabaseConfig()).toEqual({ url: "https://example.supabase.co", publishableKey: "sb_publishable_test" });
  });
});
