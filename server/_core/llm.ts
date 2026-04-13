import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env";
import { SYSTEM_PROMPT, TOOLS, executeTool } from "./ai-tools";

let _client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!ENV.anthropicApiKey) return null;
  if (!_client) _client = new Anthropic({ apiKey: ENV.anthropicApiKey });
  return _client;
}

/**
 * Simple LLM invocation (backward compat for webhook scoring).
 * Returns OpenAI-shaped response for existing callers.
 */
export async function invokeLLM(params: {
  messages: Array<{ role: string; content: string }>;
}): Promise<{ choices: Array<{ message: { content: string } }> }> {
  const client = getClient();
  if (!client) {
    console.warn("[LLM] ANTHROPIC_API_KEY not set. Skipping.");
    return { choices: [{ message: { content: "" } }] };
  }

  const systemMsg = params.messages.find(m => m.role === "system");
  const userMsgs = params.messages.filter(m => m.role !== "system");

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 256,
    system: systemMsg?.content || undefined,
    messages: userMsgs.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  const text = response.content.find(b => b.type === "text")?.text ?? "";
  return { choices: [{ message: { content: text } }] };
}

/**
 * Chat LLM with tool-use loop for the AI assistant.
 * Handles multiple rounds of tool calls until Claude produces a final text response.
 */
export async function invokeChatLLM(params: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<{ content: string }> {
  const client = getClient();
  if (!client) {
    return { content: "El asistente IA no esta configurado. Configura ANTHROPIC_API_KEY para activarlo." };
  }

  // Build the messages array for Anthropic
  const messages: Anthropic.Messages.MessageParam[] = params.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  const MAX_TOOL_ROUNDS = 10;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    // If stop_reason is "end_turn" or no tool_use blocks, extract text and return
    if (response.stop_reason === "end_turn" || !response.content.some(b => b.type === "tool_use")) {
      const text = response.content
        .filter(b => b.type === "text")
        .map(b => (b as Anthropic.Messages.TextBlock).text)
        .join("");
      return { content: text || "No pude generar una respuesta." };
    }

    // Add assistant response to messages
    messages.push({ role: "assistant", content: response.content });

    // Execute each tool call and collect results
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const result = await executeTool(block.name, block.input as Record<string, any>);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    // Add tool results as user message
    messages.push({ role: "user", content: toolResults });
  }

  return { content: "Se alcanzo el limite de iteraciones. Intenta una pregunta mas especifica." };
}
