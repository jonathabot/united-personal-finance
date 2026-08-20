import { EventType, RunAgentInputSchema, type BaseEvent, type Message } from "@ag-ui/core";
import { EventEncoder } from "@ag-ui/encoder";
import { a2uiPayloadSchema } from "@/lib/a2ui/schema";
import { runAgent } from "@/lib/agent/runtime";
import type { ConversationMessage } from "@/lib/agent/conversation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { demoFinancialRepository, SupabaseFinancialRepository, type FinancialRepository } from "@/lib/repositories";

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
  let repository: FinancialRepository = demoFinancialRepository;
  let persistence: { client: Awaited<ReturnType<typeof createClient>>; userId: string } | undefined;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Autenticação necessária." }, { status: 401 });
    repository = new SupabaseFinancialRepository(supabase, user.id);
    persistence = { client: supabase, userId: user.id };
  }
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
  if (persistence) {
    const latestInput = parsed.data.messages.at(-1);
    const { error: threadError } = await persistence.client.from("conversation_threads").upsert({ id: threadId, user_id: persistence.userId, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (threadError) return Response.json({ error: `Não foi possível salvar a conversa: ${threadError.message}` }, { status: 500 });
    const { error: messageError } = await persistence.client.from("conversation_messages").upsert({
      user_id: persistence.userId, thread_id: threadId, role: "user", content: messages.at(-1)?.content ?? "",
      client_message_id: latestInput?.id ?? `${runId}:user`,
    }, { onConflict: "user_id,thread_id,client_message_id", ignoreDuplicates: true });
    if (messageError) return Response.json({ error: `Não foi possível salvar a mensagem: ${messageError.message}` }, { status: 500 });
  }
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: BaseEvent) => controller.enqueue(encoder.encode(eventEncoder.encodeSSE(event)));
      try {
        send({ type: EventType.RUN_STARTED, threadId, runId });
        let result;
        try {
          result = await runAgent(messages, repository, threadId);
        } catch (error) {
          console.error("Agent execution failed", error);
          send({ type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" });
          send({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: "Tive uma falha temporária ao consultar seus dados. Nada foi alterado. Tente novamente em alguns instantes." });
          send({ type: EventType.TEXT_MESSAGE_END, messageId });
          send({ type: EventType.RUN_FINISHED, threadId, runId });
          return;
        }
        send({ type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" });
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

        if (persistence) {
          const { error } = await persistence.client.from("conversation_messages").upsert({
            user_id: persistence.userId, thread_id: threadId, role: "assistant", content: result.text,
            ui_payload: result.ui ?? null, client_message_id: `${runId}:assistant`,
          }, { onConflict: "user_id,thread_id,client_message_id", ignoreDuplicates: true });
          if (error) console.error("Conversation persistence failed", error);
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
