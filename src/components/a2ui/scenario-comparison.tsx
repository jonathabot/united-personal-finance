import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/money";

type ScenarioData = { month: string; category: string; reductionPercentage: number; savingsCents: number; rows: { scenario: string; categoryCents: number; balanceCents: number }[] };

export function ScenarioComparison({ data }: { data: ScenarioData }) {
  return <section className="uiCard chartCard scenarioCard" aria-label={`Comparação de cenário para ${data.category}`}>
    <div className="visualHeader"><div><span className="eyebrow">Simulação sem alterar dados</span><h3>Reduzir {data.category} em {data.reductionPercentage}%</h3></div><div className="savingCallout"><span>Economia</span><strong>{formatCurrency(data.savingsCents)}</strong></div></div>
    <div className="chartCanvas" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.rows} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e0db" /><XAxis dataKey="scenario" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(value) => `${Math.round(Number(value) / 100)} `} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Legend /><Bar dataKey="categoryCents" name={data.category} fill="#c98225" radius={[5, 5, 0, 0]} /><Bar dataKey="balanceCents" name="Saldo projetado" fill="#2e7357" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
  </section>;
}
