"use client";

import { CheckCircle2 } from "lucide-react";
import { useAui } from "@assistant-ui/react";

export function FinancialChangeConfirmation({ data }: { data: { title: string; fields: { label: string; value: string }[] } }) {
  const aui = useAui();
  const send = (text: string) => void aui.thread.append({ role: "user", content: [{ type: "text", text }] });
  return <section className="uiCard confirmation changeConfirmation">
    <div className="visualHeader"><div><span className="eyebrow">Alteração pendente</span><h3>{data.title}</h3></div><CheckCircle2 /></div>
    <dl>{data.fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
    <p>Revise antes de aplicar. Sem confirmação, o rascunho expira automaticamente em 24 horas.</p>
    <div className="confirmationActions">
      <button type="button" className="secondary" onClick={() => send("cancelar")}>Cancelar</button>
      <button type="button" onClick={() => send("confirmar")}>Confirmar</button>
    </div>
  </section>;
}
