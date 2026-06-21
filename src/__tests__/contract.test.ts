/**
 * Provider 类型契约测试（CLI 侧）
 *
 * 使用 API 响应样本 JSON 验证 CLI 类型定义与实际 API 输出兼容。
 * 当 API 响应 shape 变化而 CLI 类型未同步时，编译期会失败。
 */
import { describe, it, expect } from "vitest";
import type { ProviderListItem, ProviderDetail } from "../types/provider.js";

// ── 模拟 API 响应样本 ───────────────────────────────────

const listResponseSample: { providers: ProviderListItem[]; total: number } = {
  providers: [
    {
      name: "deepseek",
      latency: 200,
      price: "$1.04",
      tokensPerSecond: null,
      description: "深度求索 DeepSeek V4 旗舰模型，综合能力强。",
      tags: ["国产", "高性价比"],
      models: ["deepseek-v4-pro", "deepseek-v4-lite"],
      modelCount: 2,
    },
  ],
  total: 1,
};

const detailResponseSample: ProviderDetail = {
  name: "deepseek",
  intro: "深度求索 DeepSeek V4 旗舰模型，综合能力强。适合代码生成与推理任务。",
  website: "https://platform.deepseek.com",
  urls: {
    default: "https://api.deepseek.com",
    openai: "https://api.deepseek.com/v1",
    anthropic: "https://api.deepseek.com/anthropic",
  },
  defaultModel: "deepseek-v4-pro",
  models: ["deepseek-v4-pro", "deepseek-v4-lite"],
  updated_at: "Jun 19, 2026 16:30",
};

describe("CLI Provider 类型契约", () => {
  it("ProviderListItem 可接受标准 API list 响应", () => {
    // 编译期验证：样本数据满足 CLI 类型
    const item: ProviderListItem = listResponseSample.providers[0];
    expect(item.name).toBe("deepseek");
    expect(item.modelCount).toBe(2);
  });

  it("ProviderDetail 可接受标准 API detail 响应", () => {
    const detail: ProviderDetail = detailResponseSample;
    expect(detail.name).toBe("deepseek");
    expect(detail.website).toBe("https://platform.deepseek.com");
  });

  it("ProviderListItem 所有必要字段非空", () => {
    const item = listResponseSample.providers[0];
    expect(item.name.length).toBeGreaterThan(0);
    expect(item.price.length).toBeGreaterThan(0);
    expect(item.description.length).toBeGreaterThan(0);
    expect(item.models.length).toBeGreaterThan(0);
  });

  it("ProviderDetail 所有必要字段非空", () => {
    const detail = detailResponseSample;
    expect(detail.name.length).toBeGreaterThan(0);
    expect(detail.intro.length).toBeGreaterThan(0);
    expect(detail.defaultModel.length).toBeGreaterThan(0);
    expect(Object.keys(detail.urls).length).toBeGreaterThan(0);
  });
});
