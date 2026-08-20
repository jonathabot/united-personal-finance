"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(128) });

function credentials(formData: FormData) {
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) redirect(`/login?error=${encodeURIComponent("Informe um e-mail válido e uma senha com pelo menos 8 caracteres.")}`);
  return parsed.data;
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials(formData));
  if (error) redirect(`/login?error=${encodeURIComponent("E-mail ou senha inválidos.")}`);
  redirect("/");
}

export async function signup(formData: FormData) {
  const data = credentials(formData);
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ ...data, options: { emailRedirectTo: `${origin}/auth/callback` } });
  if (error) redirect(`/login?error=${encodeURIComponent("Não foi possível criar a conta.")}`);
  redirect(`/login?message=${encodeURIComponent("Confira seu e-mail para confirmar a conta.")}`);
}

export async function logout() {
  if (!isSupabaseConfigured()) redirect("/");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
