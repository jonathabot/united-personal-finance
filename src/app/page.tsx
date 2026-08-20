import { FinanceChat } from "@/components/chat/finance-chat";
import { CreditCard, History, MessageSquarePlus, Settings2, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./login/actions";

export default async function Home() {
  let initial = "L";
  let conversation: { threadId: string; messages: Array<{ id: string; role: "user" | "assistant"; content: string }> } | undefined;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    initial = (user.user_metadata.display_name || user.email || "U").charAt(0).toUpperCase();
    const { data: thread } = await supabase.from("conversation_threads").select("id").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (thread) {
      const { data: rows } = await supabase.from("conversation_messages").select("id,role,content").eq("thread_id", thread.id).in("role", ["user", "assistant"]).order("created_at", { ascending: true }).limit(40);
      conversation = { threadId: thread.id, messages: (rows ?? []).map((row) => ({ id: row.id, role: row.role as "user" | "assistant", content: row.content })) };
    }
  }
  return <main className="appShell">
    <aside className="navRail" aria-label="Navegação principal">
      <div className="railTop">
        <a className="railBrand" href="#" aria-label="United Finance">U</a>
        <button className="railButton active" aria-label="Nova conversa"><MessageSquarePlus /></button>
        <button className="railButton" aria-label="Conversas"><History /></button>
        <button className="railButton" aria-label="Faturas"><CreditCard /></button>
      </div>
      <div className="railBottom"><button className="railButton" aria-label="Configurações"><Settings2 /></button><form action={logout}><button className="railAvatar" title="Sair" aria-label="Sair">{initial}</button></form></div>
    </aside>
    <section className="workspace">
      <header className="appHeader">
        <div className="mobileMenu"><span /><span /><span /></div>
        <a className="appTitle" href="#"><WalletCards className="desktopLogo" />United Finance</a>
        <form action={logout}><button className="mobileAvatar" title="Sair" aria-label="Sair">{initial}</button></form>
      </header>
      <FinanceChat provider={process.env.GROQ_API_KEY ? "groq" : "demo"} model={process.env.GROQ_MODEL ?? "openai/gpt-oss-20b"} conversation={conversation} />
    </section>
  </main>;
}
