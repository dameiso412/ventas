import { useState } from "react";
import { Sparkles, X, Trash2 } from "lucide-react";
import { AIChatBox } from "./AIChatBox";
import { useAIChat } from "@/hooks/useAIChat";

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, sendMessage, isLoading, clearChat, suggestedPrompts } = useAIChat();

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
          title="Asistente IA"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[420px] h-[600px] flex flex-col rounded-lg border border-border shadow-2xl bg-background overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-primary text-primary-foreground shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">Asistente IA</span>
          <span className="text-[10px] opacity-70">Claude Opus</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-1.5 rounded-md hover:bg-primary-foreground/20 transition-colors"
              title="Limpiar chat"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-md hover:bg-primary-foreground/20 transition-colors"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chat Box */}
      <div className="flex-1 min-h-0">
        <AIChatBox
          messages={messages}
          onSendMessage={sendMessage}
          isLoading={isLoading}
          placeholder="Pregunta sobre tus datos..."
          height="100%"
          emptyStateMessage="Pregunta lo que quieras sobre los datos de SacaMedi"
          suggestedPrompts={suggestedPrompts}
        />
      </div>
    </div>
  );
}
