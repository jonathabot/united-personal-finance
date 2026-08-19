import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";
import { formatCurrency } from "@/lib/money";
import type { FinancialHealthData } from "@/lib/a2ui/builders";

const statusContent = {
  comfortable: { label: "Confortável", Icon: CheckCircle2 },
  attention: { label: "Atenção", Icon: AlertTriangle },
  critical: { label: "Crítica", Icon: CircleAlert },
};

export function FinancialHealthCard({ data }: { data: FinancialHealthData }) {
  const { label, Icon } = statusContent[data.status];
  return <section className={`uiCard healthCard ${data.status}`} aria-label={`Saúde financeira de ${data.month}: ${label}`}>
    <div className="visualHeader"><div><span className="eyebrow">Saúde financeira</span><h3>{data.month}</h3></div><span className="statusPill"><Icon />{label}</span></div>
    <strong className="heroValue">{formatCurrency(data.projectedBalanceCents)}</strong><span className="heroLabel">saldo projetado</span>
    <dl className="metricGrid">
      <div><dt>Receita</dt><dd>{formatCurrency(data.incomeCents)}</dd></div>
      <div><dt>Comprometido</dt><dd>{formatCurrency(data.committedCents)}</dd></div>
      <div><dt>Renda comprometida</dt><dd>{data.committedIncomePercentage.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</dd></div>
    </dl>
  </section>;
}
