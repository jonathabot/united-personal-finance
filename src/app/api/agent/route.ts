import { EventType, RunAgentInputSchema, type BaseEvent, type Message } from "@ag-ui/core";
import { EventEncoder } from "@ag-ui/encoder";
import { a2uiPayloadSchema } from "@/lib/a2ui/schema";
import { runAgent } from "@/lib/agent/runtime";
import type { ConversationMessage } from "@/lib/agent/conversation";

function textContent(message: Message) {
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "";
  return message.content
    .filter((part): part is { type: "text"; text: string } =>
      typeof part === "object" && part !== null && part.type === "text" && "text" in part && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

export async function POST(request: Request) {
  const parsed = RunAgentInputSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Entrada AG-UI inválida." }, { status: 400 });

  const messages: ConversationMessage[] = parsed.data.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({ role: message.role as "user" | "assistant", content: textContent(message) }))
    .filter((message) => message.content.trim())
    .slice(-40);

  if (!messages.length || messages.at(-1)?.role !== "user") {
    return Response.json({ error: "A última mensagem deve ser do usuário." }, { status: 400 });
  }

  const eventEncoder = new EventEncoder({ accept: request.headers.get("accept") ?? "text/event-stream" });
  const encoder = new TextEncoder();
  const { threadId, runId } = parsed.data;
  const messageId = crypto.randomUUID();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: BaseEvent) => controller.enqueue(encoder.encode(eventEncoder.encodeSSE(event)));
      try {
        send({ type: EventType.RUN_STARTED, threadId, runId });
        send({ type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" });
        const result = await runAgent(messages);
        send({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: result.text });
        send({ type: EventType.TEXT_MESSAGE_END, messageId });

        if (result.ui) {
          const toolCallId = crypto.randomUUID();
          const payload = a2uiPayloadSchema.parse(result.ui);
          send({ type: EventType.TOOL_CALL_START, toolCallId, toolCallName: "render_a2ui", parentMessageId: messageId });
          send({ type: EventType.TOOL_CALL_ARGS, toolCallId, delta: JSON.stringify({ payload }) });
          send({ type: EventType.TOOL_CALL_END, toolCallId });
          send({ type: EventType.TOOL_CALL_RESULT, messageId: crypto.randomUUID(), toolCallId, content: JSON.stringify({ rendered: true }), role: "tool" });
        }

        send({ type: EventType.RUN_FINISHED, threadId, runId });
      } catch (error) {
        send({ type: EventType.RUN_ERROR, message: error instanceof Error ? error.message : "Erro inesperado" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": eventEncoder.getContentType(),
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
