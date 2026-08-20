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
import { ChatActionsProvider } from "./chat-actions";

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

function Thread({ provider, model }: { provider: "groq" | "demo"; model: string }) {
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
        <p className="providerNote">{provider === "groq" ? `Assistente financeiro com Groq · ${model}` : "Assistente financeiro em modo demonstração local"}</p>
      </ThreadPrimitive.ViewportFooter>
    </ThreadPrimitive.Viewport>
  </ThreadPrimitive.Root>;
}

type PersistedConversation = { threadId: string; messages: Array<{ id: string; role: "user" | "assistant"; content: string }> };

export function FinanceChat({ provider, model, conversation }: { provider: "groq" | "demo"; model: string; conversation?: PersistedConversation }) {
  const agent = useMemo(() => new HttpAgent({
    url: "/api/agent",
    threadId: conversation?.threadId,
    initialMessages: conversation?.messages.map((message) => ({ id: message.id, role: message.role, content: message.content })),
  }), [conversation]);
  const runtime = useAgUiRuntime({ agent, showThinking: false });
  const chatActions = useMemo(() => ({ setComposerText: (text: string) => runtime.thread.composer.setText(text) }), [runtime]);

  return <AssistantRuntimeProvider runtime={runtime}>
    <ChatActionsProvider value={chatActions}>
      <A2UIToolUI />
      <div className="assistantFrame"><Thread provider={provider} model={model} /></div>
    </ChatActionsProvider>
  </AssistantRuntimeProvider>;
}
