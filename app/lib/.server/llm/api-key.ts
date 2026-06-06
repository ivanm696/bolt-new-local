import { env } from 'node:process';

export type LLMProvider = 'anthropic' | 'groq';

export function getAPIKey(cloudflareEnv: Env, provider: LLMProvider = 'anthropic'): string {
  if (provider === 'groq') {
    return env.GROQ_API_KEY || (cloudflareEnv as any).GROQ_API_KEY || '';
  }
  return env.ANTHROPIC_API_KEY || cloudflareEnv.ANTHROPIC_API_KEY || '';
}

export function getProvider(cloudflareEnv: Env): LLMProvider {
  // Auto-detect: if only Groq key is set, use Groq
  const hasAnthropic = !!(env.ANTHROPIC_API_KEY || cloudflareEnv.ANTHROPIC_API_KEY);
  const hasGroq = !!(env.GROQ_API_KEY || (cloudflareEnv as any).GROQ_API_KEY);

  if (!hasAnthropic && hasGroq) return 'groq';
  return 'anthropic';
}
