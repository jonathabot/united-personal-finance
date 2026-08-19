import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/money";
import type { CategoryVisualData } from "./category-breakdown";

export function SavingsOpportunityTable({ data }: { data: CategoryVisualData[] }) {
  return <section className="uiCard savingsCard"><div className="visualHeader"><div><span className="eyebrow">Comparação histórica</span><h3>Oportunidades de economia</h3></div></div>
    <div className="tableWrap"><table><thead><tr><th>Categoria</th><th>Atual</th><th>Média</th><th>Oportunidade</th></tr></thead><tbody>{data.map((item) => { const Trend = item.trend === "up" ? ArrowUpRight : item.trend === "down" ? ArrowDownRight : Minus; return <tr key={item.category}><td><span className={`trend ${item.trend}`}><Trend />{item.category}</span></td><td>{formatCurrency(item.currentCents)}</td><td>{formatCurrency(item.averageCents)}</td><td className="savingValue">{item.potentialSavingsCents ? formatCurrency(item.potentialSavingsCents) : "—"}</td></tr>; })}</tbody></table></div>
  </section>;
}
