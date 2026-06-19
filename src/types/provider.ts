export interface ProviderInfo {
  name: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  intro: string;
}

export interface UseParams {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model?: string;
}
