import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { LLMProvider } from './api-key';

export function getModel(apiKey: string, provider: LLMProvider = 'anthropic'): LanguageModel {
  if (provider === 'groq') {
    const groq = createOpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    return groq('llama-3.3-70b-versatile') as unknown as LanguageModel;
  }

  const anthropic = createAnthropic({ apiKey });
  return anthropic('claude-3-5-sonnet-20240620') as unknown as LanguageModel;
}

// Backward compat
export function getAnthropicModel(apiKey: string): LanguageModel {
  return getModel(apiKey, 'anthropic');
}
