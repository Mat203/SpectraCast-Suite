export type LlmProvider = 'openai' | 'anthropic' | 'google';

export const LLM_PROVIDERS: Array<{ id: LlmProvider; label: string }> = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'google', label: 'Google Gemini' },
];

export const LLM_MODELS: Record<LlmProvider, string[]> = {
  openai: ['gpt-5.5', 'gpt-5.4-mini', 'other'],
  anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'other'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash','gemini-2.5-flash-lite', 'other'],
};
