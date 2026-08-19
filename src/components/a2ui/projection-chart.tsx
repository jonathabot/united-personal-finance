import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/money";
import type { ProjectionPoint } from "@/lib/a2ui/builders";

export function ProjectionChart({ data }: { data: ProjectionPoint[] }) {
  return <section className="uiCard chartCard" aria-label="Projeção financeira mensal">
    <div className="visualHeader"><div><span className="eyebrow">Próximos meses</span><h3>Projeção financeira</h3></div></div>
    <div className="chartCanvas" aria-hidden="true"><ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e0db" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(value) => `${Math.round(Number(value) / 100000)}k`} />
        <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ borderRadius: 12, borderColor: "#e3e0db" }} />
        <Legend iconType="circle" iconSize={8} />
        <Line type="monotone" dataKey="incomeCents" name="Receita" stroke="#2e7357" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="expensesCents" name="Comprometido" stroke="#c98225" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="balanceCents" name="Saldo" stroke="#547ea8" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer></div>
    <table className="srOnly"><caption>Dados da projeção financeira</caption><thead><tr><th>Mês</th><th>Receita</th><th>Comprometido</th><th>Saldo</th></tr></thead><tbody>{data.map((point) => <tr key={point.month}><td>{point.month}</td><td>{formatCurrency(point.incomeCents)}</td><td>{formatCurrency(point.expensesCents)}</td><td>{formatCurrency(point.balanceCents)}</td></tr>)}</tbody></table>
  </section>;
}
