import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import type { Message } from "@/components/AIChatBox";

export const SUGGESTED_PROMPTS = [
  "Dame un resumen de los KPIs de este mes",
  "Cuales closers tienen mejor close rate?",
  "Hay leads sin asignar o con respuesta lenta?",
  "Diagnostica los cuellos de botella del funnel",
];

export function useAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
    },
    onError: (error) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Error: ${error.message}. Intenta de nuevo.`,
      }]);
    },
  });

  const sendMessage = useCallback((content: string) => {
    const userMessage: Message = { role: "user", content };
    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      chatMutation.mutate({
        messages: newMessages
          .filter(m => m.role !== "system")
          .map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      });
      return newMessages;
    });
  }, [chatMutation]);

  const clearChat = useCallback(() => setMessages([]), []);

  return {
    messages,
    sendMessage,
    isLoading: chatMutation.isPending,
    clearChat,
    suggestedPrompts: SUGGESTED_PROMPTS,
  };
}
