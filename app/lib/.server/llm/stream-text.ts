import { streamText as _streamText, convertToCoreMessages } from 'ai';
import { getAPIKey, getProvider } from '~/lib/.server/llm/api-key';
import { getModel } from '~/lib/.server/llm/model';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
}

export type Messages = Message[];
export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

export function streamText(messages: Messages, env: Env, options?: StreamingOptions) {
  const provider = getProvider(env);
  const apiKey = getAPIKey(env, provider);
  const model = getModel(apiKey, provider);

  // Only send anthropic-beta header for Anthropic
  const extraHeaders = provider === 'anthropic'
    ? { 'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15' }
    : {};

  return _streamText({
    model,
    system: getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    headers: extraHeaders,
    messages: convertToCoreMessages(messages as any),
    ...options,
  });
}
