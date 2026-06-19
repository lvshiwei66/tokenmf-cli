import type { ProviderInfo } from "../types/provider.js";

const MOCK_PROVIDERS: Record<string, ProviderInfo> = {
  packcode: {
    name: "packcode",
    baseUrl: "https://api.deepseek.com/openai",
    defaultModel: "deepseek-v4-pro",
    models: ["deepseek-v4-pro", "deepseek-v4-lite"],
    intro: "深度求索 DeepSeek V4 旗舰模型，综合能力强",
  },
  openai: {
    name: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.1",
    models: ["gpt-5.1", "gpt-5.1-mini", "gpt-5"],
    intro: "OpenAI GPT-5.1 系列，业界领先",
  },
  anthropic: {
    name: "anthropic",
    baseUrl: "https://api.anthropic.com",
    defaultModel: "claude-sonnet-4-20250514",
    models: [
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
      "claude-haiku-4-20250514",
    ],
    intro: "Anthropic Claude 4 系列，安全可靠",
  },
};

export async function queryProvider(name: string): Promise<ProviderInfo> {
  const info = MOCK_PROVIDERS[name];
  if (!info) {
    throw new Error(`未知的 Provider: ${name}`);
  }
  return { ...info };
}
