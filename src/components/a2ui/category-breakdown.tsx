import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/money";

export type CategoryVisualData = { category: string; currentCents: number; averageCents: number; potentialSavingsCents: number; trend: string };
const colors = ["#2e7357", "#6b9b87", "#c98225", "#547ea8", "#9b7bb5", "#b65f5f"];

export function CategoryBreakdown({ data }: { data: CategoryVisualData[] }) {
  const visible = data.filter((item) => item.currentCents > 0);
  const total = visible.reduce((sum, item) => sum + item.currentCents, 0);
  return <section className="uiCard chartCard" aria-label="Distribuição dos gastos por categoria">
    <div className="visualHeader"><div><span className="eyebrow">Mês atual</span><h3>Gastos por categoria</h3></div><strong>{formatCurrency(total)}</strong></div>
    <div className="donutLayout"><div className="donutCanvas" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={visible} dataKey="currentCents" nameKey="category" innerRadius="58%" outerRadius="82%" paddingAngle={2}>{visible.map((item, index) => <Cell key={item.category} fill={colors[index % colors.length]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(Number(value))} /></PieChart></ResponsiveContainer></div>
      <ul className="chartLegend">{visible.map((item, index) => <li key={item.category}><span style={{ background: colors[index % colors.length] }} /> <span>{item.category}</span><strong>{formatCurrency(item.currentCents)}</strong></li>)}</ul>
    </div>
  </section>;
}
