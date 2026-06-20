import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
import { codexAppfit } from "../appfits/codex.js";
import { claudeCodeAppfit } from "../appfits/claude-code.js";
import { openclawAppfit } from "../appfits/openclaw.js";
import type { UseParams } from "../types/provider.js";

function useParams(overrides?: Partial<UseParams>): UseParams {
  return {
    provider: "packcode",
    baseUrl: "https://api.deepseek.com/openai",
    apiKey: "sk-test-key-123",
    model: "deepseek-v4-pro",
    ...overrides,
  };
}

describe("Codex Appfit", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tmf-test-codex-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("resolves config.toml and auth.json paths", () => {
    const paths = codexAppfit.resolveConfigPaths(tmpDir);
    expect(paths).toContain(join(tmpDir, "config.toml"));
    expect(paths).toContain(join(tmpDir, "auth.json"));
  });

  it("rewrites config.toml with provider settings", async () => {
    const configToml = `
model_provider = "openai"
model = "gpt-5.1"

[model_providers.openai]
name = "OpenAI"
base_url = "https://api.openai.com/v1"
api_key = "sk-old"
`;
    writeFileSync(join(tmpDir, "config.toml"), configToml);

    await codexAppfit.apply(tmpDir, useParams());

    const result = parseToml(
      readFileSync(join(tmpDir, "config.toml"), "utf-8"),
    ) as Record<string, unknown>;

    expect(result.model_provider).toBe("custom");
    expect(result.model).toBe("deepseek-v4-pro");
    const custom = (result.model_providers as Record<string, unknown>).custom as Record<string, unknown>;
    expect(custom.name).toBe("packcode");
    expect(custom.base_url).toBe("https://api.deepseek.com/openai");
    expect(custom.api_key).toBe("sk-test-key-123");
  });

  it("does not change model when not provided", async () => {
    const configToml = `model_provider = "openai"\nmodel = "gpt-5.1"\n`;
    writeFileSync(join(tmpDir, "config.toml"), configToml);

    await codexAppfit.apply(tmpDir, useParams({ model: undefined }));

    const result = parseToml(
      readFileSync(join(tmpDir, "config.toml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.model).toBe("gpt-5.1");
  });

  it("creates auth.json if it does not exist", async () => {
    writeFileSync(join(tmpDir, "config.toml"), "model_provider = 'openai'\nmodel = 'gpt-5.1'\n");

    await codexAppfit.apply(tmpDir, useParams());

    const authPath = join(tmpDir, "auth.json");
    expect(existsSync(authPath)).toBe(true);
    const auth = JSON.parse(readFileSync(authPath, "utf-8")) as Record<string, unknown>;
    expect(auth.OPENAI_API_KEY).toBe("sk-test-key-123");
  });

  it("updates existing auth.json", async () => {
    writeFileSync(join(tmpDir, "config.toml"), "model_provider = 'openai'\nmodel = 'gpt-5.1'\n");
    writeFileSync(join(tmpDir, "auth.json"), JSON.stringify({ OPENAI_API_KEY: "sk-old" }));

    await codexAppfit.apply(tmpDir, useParams());

    const auth = JSON.parse(readFileSync(join(tmpDir, "auth.json"), "utf-8")) as Record<string, unknown>;
    expect(auth.OPENAI_API_KEY).toBe("sk-test-key-123");
  });
});

describe("Appfit requiredProtocol()", () => {
  it("codex returns openai", () => {
    expect(codexAppfit.requiredProtocol()).toBe("openai");
  });

  it("claude-code returns anthropic", () => {
    expect(claudeCodeAppfit.requiredProtocol()).toBe("anthropic");
  });

  it("openclaw returns undefined", () => {
    expect(openclawAppfit.requiredProtocol()).toBeUndefined();
  });
});

describe("Claude Code Appfit", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tmf-test-cc-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("resolves settings.json path", () => {
    const paths = claudeCodeAppfit.resolveConfigPaths(tmpDir);
    expect(paths).toEqual([join(tmpDir, "settings.json")]);
  });

  it("rewrites settings.json env block with provider settings", async () => {
    const settings = JSON.stringify({
      env: {
        ANTHROPIC_AUTH_TOKEN: "sk-old",
        ANTHROPIC_BASE_URL: "https://api.anthropic.com",
        ANTHROPIC_MODEL: "claude-sonnet-4-20250514",
      },
      otherSetting: "keep-me",
    });
    writeFileSync(join(tmpDir, "settings.json"), settings);

    await claudeCodeAppfit.apply(tmpDir, useParams());

    const result = JSON.parse(
      readFileSync(join(tmpDir, "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    const env = result.env as Record<string, unknown>;
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("sk-test-key-123");
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/openai");
    expect(env.ANTHROPIC_MODEL).toBe("deepseek-v4-pro");
    expect(result.otherSetting).toBe("keep-me");
  });

  it("does not set ANTHROPIC_MODEL when model not provided", async () => {
    writeFileSync(
      join(tmpDir, "settings.json"),
      JSON.stringify({
        env: {
          ANTHROPIC_AUTH_TOKEN: "sk-old",
          ANTHROPIC_MODEL: "claude-sonnet-4-20250514",
        },
      }),
    );

    await claudeCodeAppfit.apply(tmpDir, useParams({ model: undefined }));

    const result = JSON.parse(
      readFileSync(join(tmpDir, "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    const env = result.env as Record<string, unknown>;
    expect(env.ANTHROPIC_MODEL).toBe("claude-sonnet-4-20250514");
  });

  it("creates env block if it does not exist", async () => {
    writeFileSync(
      join(tmpDir, "settings.json"),
      JSON.stringify({ otherSetting: "keep-me" }),
    );

    await claudeCodeAppfit.apply(tmpDir, useParams());

    const result = JSON.parse(
      readFileSync(join(tmpDir, "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    const env = result.env as Record<string, unknown>;
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("sk-test-key-123");
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/openai");
    expect(result.otherSetting).toBe("keep-me");
  });

  it("cleans up stale top-level provider keys from prior buggy runs", async () => {
    const settings = JSON.stringify({
      provider: "anthropic",
      apiKey: "sk-old",
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-4-20250514",
      env: {
        ANTHROPIC_AUTH_TOKEN: "sk-env",
      },
    });
    writeFileSync(join(tmpDir, "settings.json"), settings);

    await claudeCodeAppfit.apply(tmpDir, useParams());

    const result = JSON.parse(
      readFileSync(join(tmpDir, "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.provider).toBeUndefined();
    expect(result.apiKey).toBeUndefined();
    expect(result.baseUrl).toBeUndefined();
    expect(result.model).toBeUndefined();
    const env = result.env as Record<string, unknown>;
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("sk-test-key-123");
  });
});

describe("OpenClaw Appfit", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tmf-test-oc-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("resolves config.yaml path", () => {
    const paths = openclawAppfit.resolveConfigPaths(tmpDir);
    expect(paths).toEqual([join(tmpDir, "config.yaml")]);
  });

  it("rewrites config.yaml with provider settings", async () => {
    const config = `
provider: anthropic
model: claude-sonnet-4-20250514
api_key: sk-old
base_url: https://api.anthropic.com
other_setting: keep-me
`;
    writeFileSync(join(tmpDir, "config.yaml"), config);

    await openclawAppfit.apply(tmpDir, useParams());

    const result = parseYaml(
      readFileSync(join(tmpDir, "config.yaml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.provider).toBe("packcode");
    expect(result.model).toBe("deepseek-v4-pro");
    expect(result.api_key).toBe("sk-test-key-123");
    expect(result.base_url).toBe("https://api.deepseek.com/openai");
    expect(result.other_setting).toBe("keep-me");
  });

  it("does not change model when not provided", async () => {
    writeFileSync(
      join(tmpDir, "config.yaml"),
      "provider: anthropic\nmodel: claude-sonnet-4-20250514\n",
    );

    await openclawAppfit.apply(tmpDir, useParams({ model: undefined }));

    const result = parseYaml(
      readFileSync(join(tmpDir, "config.yaml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.model).toBe("claude-sonnet-4-20250514");
  });
});
