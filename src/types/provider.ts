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

/**
 * Model assignments by role for Claude Code's ANTHROPIC_DEFAULT_*_MODEL env vars.
 * Positional: --models <opus> <sonnet> <haiku> [default]
 * Key-value: --models opus=X,sonnet=Y,haiku=Z
 */
export interface RoleModels {
  opus?: string;
  sonnet?: string;
  haiku?: string;
}

export interface UseParams {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model?: string;
  /** Multiple models: first is primary (ANTHROPIC_MODEL), rest form fallback chain */
  models?: string[];
  /** Model assignments by role (haiku, sonnet, opus) for Claude Code */
  roleModels?: RoleModels;
  /** Custom environment variables to merge into settings.json env block */
  env?: Record<string, string>;
  /** Effort level: low, medium, high, xhigh */
  effortLevel?: string;
}

// --- Settings (stored in ~/.tmf/store/used.json) ---

export interface ProviderSettings {
  apiKey?: string;
  model?: string;
  urls?: Record<string, string>;
}

export interface Settings {
  providers?: Record<string, ProviderSettings>;
  clientId?: string;
}

// --- Test command types ---

export interface TestParams {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface TestResult {
  accessible: boolean;
  latencyMs: number | null;
  tokenUsage: { prompt: number; completion: number; total: number } | null;
  throughput: number | null;
}

export type TestErrorCode =
  | "NO_BASE_URL"
  | "NO_API_KEY"
  | "UNREACHABLE"
  | "AUTH_FAILED"
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "NO_USAGE"
  | "NETWORK_ERROR"
  | "EMPTY_PROMPT";

export const TEST_EXIT_CODES: Record<TestErrorCode, number> = {
  NO_BASE_URL: 2,
  NO_API_KEY: 3,
  UNREACHABLE: 4,
  AUTH_FAILED: 5,
  BAD_REQUEST: 6,
  FORBIDDEN: 7,
  NOT_FOUND: 8,
  RATE_LIMITED: 9,
  SERVER_ERROR: 10,
  NO_USAGE: 11,
  NETWORK_ERROR: 12,
  EMPTY_PROMPT: 13,
};

export class TestError extends Error {
  constructor(
    message: string,
    public readonly code: TestErrorCode,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "TestError";
  }

  get exitCode(): number {
    return TEST_EXIT_CODES[this.code];
  }
}
