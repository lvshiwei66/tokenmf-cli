import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { askAction } from "../commands/ask.js";
import type { ProviderDetail } from "../types/provider.js";

const mockDetail: ProviderDetail = {
  name: "packcode",
  intro: "DeepSeek V4 flagship model. Suitable for code generation and reasoning tasks.",
  website: "https://platform.deepseek.com",
  urls: { default: "https://api.deepseek.com/openai", openai: "https://api.deepseek.com/openai" },
  defaultModel: "deepseek-v4-pro",
  models: ["deepseek-v4-pro", "deepseek-v4-lite"],
  updated_at: "Jun 19, 2026 16:30",
};

let mockResult: ProviderDetail | { code: string; message: string; statusCode?: number } = mockDetail;

vi.mock("../providers/api.js", () => ({
  fetchProviderInfo: vi.fn(() => {
    return mockResult;
  }),
}));

describe("askAction", () => {
  let stdout: string[] = [];
  let stderr: string[] = [];
  const origLog = console.log;
  const origErr = console.error;

  beforeEach(() => {
    stdout = [];
    stderr = [];
    console.log = (...args: unknown[]) => { stdout.push(args.map(String).join(" ")); };
    console.error = (...args: unknown[]) => { stderr.push(args.map(String).join(" ")); };
    mockResult = mockDetail;
  });

  afterEach(() => {
    console.log = origLog;
    console.error = origErr;
    vi.clearAllMocks();
  });

  it("renders provider detail", async () => {
    await askAction("packcode", {
      getConfig: () => Promise.resolve(null),
      getApiUrl: () => "https://test.api",
    }, { debug: false });

    const output = stdout.join("\n");
    expect(output).toContain("🔍 packcode");
    expect(output).toContain("Intro: DeepSeek V4 flagship model. Suitable for code generation and reasoning tasks.");
    expect(output).toContain("Website: https://platform.deepseek.com");
    expect(output).toContain("Default model: deepseek-v4-pro");
    expect(output).toContain("API URL (default): https://api.deepseek.com/openai");
    expect(output).toContain("Available models: deepseek-v4-pro, deepseek-v4-lite");
    expect(output).toContain("Updated: Jun 19, 2026 16:30");
  });

  it("shows 404 error for unknown provider", async () => {
    mockResult = { code: "NOT_FOUND", message: "❌ Provider not found: unknown" };

    await askAction("unknown", {
      getConfig: () => Promise.resolve(null),
      getApiUrl: () => "https://test.api",
    }, { debug: false });

    expect(stderr.join("\n")).toContain("Provider not found: unknown");
  });

  it("shows network error on fetch failure", async () => {
    mockResult = { code: "NETWORK", message: "❌ Please check network connection" };

    await askAction("packcode", {
      getConfig: () => Promise.resolve(null),
      getApiUrl: () => "https://test.api",
    }, { debug: false });

    expect(stderr.join("\n")).toContain("Please check network connection");
  });

  it("shows 429 rate limit error", async () => {
    mockResult = { code: "RATE_LIMITED", message: "❌ Too many requests, please try again later" };

    await askAction("packcode", {
      getConfig: () => Promise.resolve(null),
      getApiUrl: () => "https://test.api",
    }, { debug: false });

    expect(stderr.join("\n")).toContain("Too many requests");
  });

  it("outputs debug info when --debug is set", async () => {
    mockResult = { code: "SERVER_ERROR", message: "❌ Service error (status: 500), please try again later", statusCode: 500 };

    await askAction("packcode", {
      getConfig: () => Promise.resolve(null),
      getApiUrl: () => "https://test.api",
    }, { debug: true });

    const debugOutput = stderr.join("\n");
    expect(debugOutput).toContain("[Debug]");
    expect(debugOutput).toContain("500");
  });

  it("omits empty fields from output", async () => {
    mockResult = {
      name: "minimal",
      intro: "",
      website: "",
      urls: {},
      defaultModel: "",
      models: [],
      updated_at: "",
    };

    await askAction("minimal", {
      getConfig: () => Promise.resolve(null),
      getApiUrl: () => "https://test.api",
    }, { debug: false });

    const output = stdout.join("\n");
    expect(output).toContain("🔍 minimal");
    expect(output).not.toContain("Intro:");
    expect(output).not.toContain("Website:");
    expect(output).not.toContain("Default model:");
  });
});
