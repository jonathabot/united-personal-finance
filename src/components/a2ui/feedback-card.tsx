import { AlertCircle, HelpCircle } from "lucide-react";

export function ClarificationCard({ data }: { data: { message: string; options?: string[] } }) {
  return <section className="uiCard feedbackCard"><HelpCircle /><div><h3>Preciso de uma informação</h3><p>{data.message}</p>{data.options?.length ? <div className="optionList">{data.options.map((option) => <span key={option}>{option}</span>)}</div> : null}</div></section>;
}

export function ErrorCard({ data }: { data: { message: string } }) {
  return <section className="uiCard feedbackCard errorCard" role="alert"><AlertCircle /><div><h3>Não foi possível concluir</h3><p>{data.message}</p></div></section>;
}
