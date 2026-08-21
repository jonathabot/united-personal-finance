import { redirect } from "next/navigation";
import { WalletCards } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { login, signup } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const supabaseConfigured = isSupabaseConfigured();
  const isE2EPreview = process.env.E2E_LOGIN_PREVIEW === "1";
  if (!supabaseConfigured && !isE2EPreview) redirect("/");
  if (supabaseConfigured) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/");
  }
  const params = await searchParams;
  return <main className="authPage"><section className="authCard">
    <div className="authBrand"><WalletCards /><span>United Finance</span></div>
    <div><h1>Suas finanças, em qualquer lugar.</h1><p>Entre para continuar sua conversa e acessar seus dados com segurança.</p></div>
    {params.error ? <p className="authNotice error" role="alert">{params.error}</p> : null}
    {params.message ? <p className="authNotice success">{params.message}</p> : null}
    <form className="authForm">
      <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
      <label>Senha<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
      <button formAction={login} className="authPrimary">Entrar</button>
      <button formAction={signup} className="authSecondary">Criar conta</button>
    </form>
    <small>Seus dados são isolados por usuário com Row Level Security.</small>
  </section></main>;
}
