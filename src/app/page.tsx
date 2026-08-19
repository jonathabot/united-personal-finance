import { FinanceChat } from "@/components/chat/finance-chat";
import { CreditCard, History, MessageSquarePlus, Settings2, WalletCards } from "lucide-react";

export default function Home() {
  return <main className="appShell">
    <aside className="navRail" aria-label="Navegação principal">
      <div className="railTop">
        <a className="railBrand" href="#" aria-label="United Finance">U</a>
        <button className="railButton active" aria-label="Nova conversa"><MessageSquarePlus /></button>
        <button className="railButton" aria-label="Conversas"><History /></button>
        <button className="railButton" aria-label="Faturas"><CreditCard /></button>
      </div>
      <div className="railBottom"><button className="railButton" aria-label="Configurações"><Settings2 /></button><div className="railAvatar">L</div></div>
    </aside>
    <section className="workspace">
      <header className="appHeader">
        <div className="mobileMenu"><span /><span /><span /></div>
        <a className="appTitle" href="#"><WalletCards className="desktopLogo" />United Finance</a>
        <div className="mobileAvatar">L</div>
      </header>
      <FinanceChat provider={process.env.GROQ_API_KEY ? "groq" : "demo"} />
    </section>
  </main>;
}
