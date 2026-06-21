export interface ProviderListItem {
    name: string;
    latency: number;
    price: string;
    tokensPerSecond: number | null;
    description: string;
    tags: string[];
    models: string[];
    modelCount: number;
}
export interface ProviderDetail {
    name: string;
    intro: string;
    website: string;
    urls: Record<string, string>;
    defaultModel: string;
    models: string[];
    updated_at: string;
}
export interface UseParams {
    provider: string;
    baseUrl: string;
    apiKey: string;
    model?: string;
}
//# sourceMappingURL=provider.d.ts.map