/**
 * Browser-safe AI endpoint configuration.
 *
 * The frontend only calls the authenticated TôHiệuQuiz API route. The public
 * OpenAI-compatible gateway and its Bearer token remain server-side bindings.
 */
export const AI_CHAT_API_PATH = '/api/ai/chat' as const;
