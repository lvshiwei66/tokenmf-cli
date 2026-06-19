import { describe, it, expect } from "vitest";
import { queryProvider } from "../providers/ask.js";

describe("ask provider", () => {
  it("returns packcode info", async () => {
    const info = await queryProvider("packcode");
    expect(info.name).toBe("packcode");
    expect(info.baseUrl).toBe("https://api.deepseek.com/openai");
    expect(info.defaultModel).toBe("deepseek-v4-pro");
    expect(info.models).toContain("deepseek-v4-pro");
  });

  it("returns openai info", async () => {
    const info = await queryProvider("openai");
    expect(info.name).toBe("openai");
    expect(info.baseUrl).toBe("https://api.openai.com/v1");
  });

  it("returns anthropic info", async () => {
    const info = await queryProvider("anthropic");
    expect(info.name).toBe("anthropic");
    expect(info.defaultModel).toBe("claude-sonnet-4-20250514");
  });

  it("throws for unknown provider", async () => {
    await expect(queryProvider("unknown")).rejects.toThrow(
      "未知的 Provider: unknown",
    );
  });
});
