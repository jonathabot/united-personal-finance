"use client";

import { createContext, useContext, type ReactNode } from "react";

type ChatActions = { setComposerText: (text: string) => void };

const ChatActionsContext = createContext<ChatActions | null>(null);

export function ChatActionsProvider({ value, children }: { value: ChatActions; children: ReactNode }) {
  return <ChatActionsContext.Provider value={value}>{children}</ChatActionsContext.Provider>;
}

export function useChatActions() {
  const value = useContext(ChatActionsContext);
  if (!value) throw new Error("ChatActionsProvider não encontrado.");
  return value;
}
