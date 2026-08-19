"use client";

import { useMemo } from "react";
import { HttpAgent } from "@ag-ui/client";
import {
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  makeAssistantToolUI,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { useAgUiRuntime } from "@assistant-ui/react-ag-ui";
import { ArrowUp, Mic, Plus, Square } from "lucide-react";
import type { A2UIPayload } from "@/lib/a2ui/schema";
import { A2UIRenderer } from "@/components/a2ui/renderer";

const A2UIToolUI = makeAssistantToolUI<{ payload: A2UIPayload }, { rendered: boolean }>({
  toolName: "render_a2ui",
  display: "standalone",
  render: ({ args }) => args.payload ? <A2UIRenderer payload={args.payload} /> : null,
});

function PlainTextPart() {
  return <span className="messageText"><MessagePartPrimitive.Text /></span>;
}

function UserMessage() {
  return <MessagePrimitive.Root className="message user"><div className="messageContent"><div className="bubble"><MessagePrimitive.Parts components={{ Text: PlainTextPart }} /></div></div></MessagePrimitive.Root>;
}

function AssistantMessage() {
  return <MessagePrimitive.Root className="message assistant">
    <div className="assistantAvatar">U</div>
    <div className="messageContent"><div className="bubble"><MessagePrimitive.Parts components={{ Text: PlainTextPart }} /></div></div>
  </MessagePrimitive.Root>;
}

function Thread() {
  return <ThreadPrimitive.Root className="chatShell">
    <ThreadPrimitive.Viewport className="messages">
      <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
      <AuiIf condition={(state) => state.thread.isRunning}><div className="agentWorking" role="status"><span /><span /><span /><em>Analisando dados financeiros</em></div></AuiIf>
      <ThreadPrimitive.ViewportFooter className="threadFooter">
        <ComposerPrimitive.Root className="composer">
          <button type="button" className="composerIcon" aria-label="Adicionar"><Plus /></button>
          <ComposerPrimitive.Input className="composerInput" placeholder="Mensagem" aria-label="Mensagem" />
          <button type="button" className="composerIcon" aria-label="Áudio"><Mic /></button>
          <AuiIf condition={(state) => !state.thread.isRunning}><ComposerPrimitive.Send className="sendButton" aria-label="Enviar"><ArrowUp /></ComposerPrimitive.Send></AuiIf>
          <AuiIf condition={(state) => state.thread.isRunning}><ComposerPrimitive.Cancel className="sendButton cancelButton" aria-label="Cancelar"><Square /></ComposerPrimitive.Cancel></AuiIf>
        </ComposerPrimitive.Root>
      </ThreadPrimitive.ViewportFooter>
    </ThreadPrimitive.Viewport>
  </ThreadPrimitive.Root>;
}

export function FinanceChat({ provider }: { provider: "groq" | "demo" }) {
  const agent = useMemo(() => new HttpAgent({ url: "/api/agent" }), []);
  const runtime = useAgUiRuntime({ agent, showThinking: false });

  return <AssistantRuntimeProvider runtime={runtime}>
    <A2UIToolUI />
    <div className="assistantFrame">
      <div className={`agentMode ${provider}`}><span />{provider === "groq" ? "Agente Groq" : "Modo demonstração"}</div>
      <Thread />
    </div>
  </AssistantRuntimeProvider>;
}
