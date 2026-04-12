/**
 * LLM invocation stub.
 * The original used the Manus Forge API. This can be replaced with
 * OpenAI, Anthropic, or any other LLM provider.
 * Currently returns an empty response so the webhook gracefully skips AI scoring.
 */
export async function invokeLLM(params: {
  messages: Array<{ role: string; content: string }>;
}): Promise<{ choices: Array<{ message: { content: string } }> }> {
  console.warn("[LLM] AI scoring is not configured. Skipping.");
  return { choices: [{ message: { content: "" } }] };
}
