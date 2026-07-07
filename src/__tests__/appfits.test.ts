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

describe("Codex Appfit — advanced features", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tmf-test-codex-adv-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("supports --models (uses first model only, Codex has no fallback chain)", async () => {
    writeFileSync(
      join(tmpDir, "config.toml"),
      'model_provider = "openai"\nmodel = "gpt-5.1"\n',
    );

    await codexAppfit.apply(tmpDir, useParams({
      models: ["deepseek-v4-pro", "deepseek-v4-lite"],
      model: undefined,
    }));

    const result = parseToml(
      readFileSync(join(tmpDir, "config.toml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.model).toBe("deepseek-v4-pro");
  });

  it("--models[0] takes priority over --model", async () => {
    writeFileSync(
      join(tmpDir, "config.toml"),
      'model_provider = "openai"\n',
    );

    await codexAppfit.apply(tmpDir, useParams({
      model: "ignored-model",
      models: ["primary-model"],
    }));

    const result = parseToml(
      readFileSync(join(tmpDir, "config.toml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.model).toBe("primary-model");
  });

  it("sets model_reasoning_effort when effortLevel is provided", async () => {
    writeFileSync(
      join(tmpDir, "config.toml"),
      'model_provider = "openai"\nmodel = "gpt-5.1"\n',
    );

    await codexAppfit.apply(tmpDir, useParams({ effortLevel: "xhigh" }));

    const result = parseToml(
      readFileSync(join(tmpDir, "config.toml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.model_reasoning_effort).toBe("xhigh");
  });

  it("does not set model_reasoning_effort when not provided", async () => {
    writeFileSync(
      join(tmpDir, "config.toml"),
      'model_provider = "openai"\nmodel_reasoning_effort = "high"\n',
    );

    await codexAppfit.apply(tmpDir, useParams({ effortLevel: undefined }));

    const result = parseToml(
      readFileSync(join(tmpDir, "config.toml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.model_reasoning_effort).toBe("high");
  });

  it("sets nested TOML keys from --env (simple boolean)", async () => {
    writeFileSync(
      join(tmpDir, "config.toml"),
      'model_provider = "openai"\n',
    );

    await codexAppfit.apply(tmpDir, useParams({
      env: { "features.browser_use": "true" },
    }));

    const result = parseToml(
      readFileSync(join(tmpDir, "config.toml"), "utf-8"),
    ) as Record<string, unknown>;
    const features = result.features as Record<string, unknown>;
    expect(features.browser_use).toBe(true);
  });

  it("sets nested TOML keys from --env (integer)", async () => {
    writeFileSync(
      join(tmpDir, "config.toml"),
      'model_provider = "openai"\n',
    );

    await codexAppfit.apply(tmpDir, useParams({
      env: { "timeout_ms": "30000" },
    }));

    const result = parseToml(
      readFileSync(join(tmpDir, "config.toml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.timeout_ms).toBe(30000);
  });

  it("preserves existing features when adding new ones", async () => {
    writeFileSync(
      join(tmpDir, "config.toml"),
      'model_provider = "openai"\n' +
      '\n' +
      '[features]\n' +
      'fast_mode = true\n',
    );

    await codexAppfit.apply(tmpDir, useParams({
      env: { "features.browser_use": "true" },
    }));

    const result = parseToml(
      readFileSync(join(tmpDir, "config.toml"), "utf-8"),
    ) as Record<string, unknown>;
    const features = result.features as Record<string, unknown>;
    expect(features.fast_mode).toBe(true);
    expect(features.browser_use).toBe(true);
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

describe("Claude Code Appfit — advanced features", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tmf-test-cc-adv-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("supports --models with fallback chain", async () => {
    writeFileSync(
      join(tmpDir, "settings.json"),
      JSON.stringify({}),
    );

    await claudeCodeAppfit.apply(tmpDir, useParams({
      models: ["claude-sonnet-5", "claude-haiku-4-5"],
      model: undefined,
    }));

    const result = JSON.parse(
      readFileSync(join(tmpDir, "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    const env = result.env as Record<string, unknown>;
    expect(env.ANTHROPIC_MODEL).toBe("claude-sonnet-5");
    expect(result.model).toBe("claude-sonnet-5");
    expect(result.fallbackModel).toEqual(["claude-haiku-4-5"]);
  });

  it("supports --models with single model (no fallback)", async () => {
    writeFileSync(
      join(tmpDir, "settings.json"),
      JSON.stringify({ fallbackModel: ["old-fallback"] }),
    );

    await claudeCodeAppfit.apply(tmpDir, useParams({
      models: ["claude-sonnet-5"],
      model: undefined,
    }));

    const result = JSON.parse(
      readFileSync(join(tmpDir, "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.fallbackModel).toBeUndefined();
  });

  it("preserves existing non-managed env vars", async () => {
    writeFileSync(
      join(tmpDir, "settings.json"),
      JSON.stringify({
        env: {
          CUSTOM_USER_VAR: "keep-me",
          BASH_DEFAULT_TIMEOUT_MS: "300000",
          ANTHROPIC_AUTH_TOKEN: "sk-old",
        },
      }),
    );

    await claudeCodeAppfit.apply(tmpDir, useParams());

    const result = JSON.parse(
      readFileSync(join(tmpDir, "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    const env = result.env as Record<string, unknown>;
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("sk-test-key-123");
    expect(env.CUSTOM_USER_VAR).toBe("keep-me");
    expect(env.BASH_DEFAULT_TIMEOUT_MS).toBe("300000");
  });

  it("supports custom env vars via params.env", async () => {
    writeFileSync(
      join(tmpDir, "settings.json"),
      JSON.stringify({}),
    );

    await claudeCodeAppfit.apply(tmpDir, useParams({
      env: {
        ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-5-20250929",
        ANTHROPIC_BETAS: "feature-x,feature-y",
      },
    }));

    const result = JSON.parse(
      readFileSync(join(tmpDir, "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    const env = result.env as Record<string, unknown>;
    expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe("claude-sonnet-5-20250929");
    expect(env.ANTHROPIC_BETAS).toBe("feature-x,feature-y");
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("sk-test-key-123");
    expect(env.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/openai");
  });

  it("supports effortLevel via params.effortLevel", async () => {
    writeFileSync(
      join(tmpDir, "settings.json"),
      JSON.stringify({}),
    );

    await claudeCodeAppfit.apply(tmpDir, useParams({
      effortLevel: "xhigh",
    }));

    const result = JSON.parse(
      readFileSync(join(tmpDir, "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.effortLevel).toBe("xhigh");
  });

  it("does not overwrite effortLevel when not provided", async () => {
    writeFileSync(
      join(tmpDir, "settings.json"),
      JSON.stringify({ effortLevel: "high" }),
    );

    await claudeCodeAppfit.apply(tmpDir, useParams({ effortLevel: undefined }));

    const result = JSON.parse(
      readFileSync(join(tmpDir, "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.effortLevel).toBe("high");
  });

  it("--models takes priority over --model", async () => {
    writeFileSync(
      join(tmpDir, "settings.json"),
      JSON.stringify({}),
    );

    await claudeCodeAppfit.apply(tmpDir, useParams({
      model: "ignored-model",
      models: ["primary-model", "fallback-model"],
    }));

    const result = JSON.parse(
      readFileSync(join(tmpDir, "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    const env = result.env as Record<string, unknown>;
    expect(env.ANTHROPIC_MODEL).toBe("primary-model");
    expect(result.model).toBe("primary-model");
    expect(result.fallbackModel).toEqual(["fallback-model"]);
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

  it("removes ANTHROPIC_MODEL when model and models not provided", async () => {
    writeFileSync(
      join(tmpDir, "settings.json"),
      JSON.stringify({
        env: {
          ANTHROPIC_AUTH_TOKEN: "sk-old",
          ANTHROPIC_MODEL: "claude-sonnet-4-20250514",
          CUSTOM_VAR: "keep-me",
        },
      }),
    );

    await claudeCodeAppfit.apply(tmpDir, useParams({ model: undefined }));

    const result = JSON.parse(
      readFileSync(join(tmpDir, "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    const env = result.env as Record<string, unknown>;
    // Managed model key is removed when not explicitly set
    expect(env.ANTHROPIC_MODEL).toBeUndefined();
    // Non-managed vars preserved
    expect(env.CUSTOM_VAR).toBe("keep-me");
    // Auth and baseUrl still updated
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("sk-test-key-123");
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
    // provider, apiKey, baseUrl are cleaned up
    expect(result.provider).toBeUndefined();
    expect(result.apiKey).toBeUndefined();
    expect(result.baseUrl).toBeUndefined();
    // model is now intentionally set (was previously deleted by cleanup,
    // but the new appfit writes it as a top-level field)
    expect(result.model).toBe("deepseek-v4-pro");
    const env = result.env as Record<string, unknown>;
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("sk-test-key-123");
  });
});

describe("OpenClaw Appfit — advanced features", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tmf-test-oc-adv-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("supports --models with fallbacks array", async () => {
    writeFileSync(
      join(tmpDir, "config.yaml"),
      "provider: anthropic\nmodel: claude-sonnet-4-20250514\n",
    );

    await openclawAppfit.apply(tmpDir, useParams({
      models: ["primary-model", "fallback-a", "fallback-b"],
      model: undefined,
    }));

    const result = parseYaml(
      readFileSync(join(tmpDir, "config.yaml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.model).toBe("primary-model");
    expect(result.fallbacks).toEqual(["fallback-a", "fallback-b"]);
  });

  it("clears fallbacks when only one model in --models", async () => {
    writeFileSync(
      join(tmpDir, "config.yaml"),
      "provider: anthropic\nmodel: old\nfallbacks:\n  - fb1\n  - fb2\n",
    );

    await openclawAppfit.apply(tmpDir, useParams({
      models: ["single-model"],
      model: undefined,
    }));

    const result = parseYaml(
      readFileSync(join(tmpDir, "config.yaml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.fallbacks).toBeUndefined();
  });

  it("supports --effort via model_reasoning_effort", async () => {
    writeFileSync(
      join(tmpDir, "config.yaml"),
      "provider: anthropic\n",
    );

    await openclawAppfit.apply(tmpDir, useParams({ effortLevel: "high" }));

    const result = parseYaml(
      readFileSync(join(tmpDir, "config.yaml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.model_reasoning_effort).toBe("high");
  });

  it("supports --env for dotted key (boolean)", async () => {
    writeFileSync(
      join(tmpDir, "config.yaml"),
      "provider: anthropic\n",
    );

    await openclawAppfit.apply(tmpDir, useParams({
      env: { "features.sandbox": "true" },
    }));

    const result = parseYaml(
      readFileSync(join(tmpDir, "config.yaml"), "utf-8"),
    ) as Record<string, unknown>;
    const features = result.features as Record<string, unknown>;
    expect(features.sandbox).toBe(true);
  });

  it("supports --env for dotted key (integer)", async () => {
    writeFileSync(
      join(tmpDir, "config.yaml"),
      "provider: anthropic\n",
    );

    await openclawAppfit.apply(tmpDir, useParams({
      env: { "session.timeout": "30000" },
    }));

    const result = parseYaml(
      readFileSync(join(tmpDir, "config.yaml"), "utf-8"),
    ) as Record<string, unknown>;
    expect(result.session).toEqual({ timeout: 30000 });
  });

  it("preserves existing nested keys when adding new ones via --env", async () => {
    writeFileSync(
      join(tmpDir, "config.yaml"),
      "provider: anthropic\nfeatures:\n  existing: true\n",
    );

    await openclawAppfit.apply(tmpDir, useParams({
      env: { "features.new_key": "hello" },
    }));

    const result = parseYaml(
      readFileSync(join(tmpDir, "config.yaml"), "utf-8"),
    ) as Record<string, unknown>;
    const features = result.features as Record<string, unknown>;
    expect(features.existing).toBe(true);
    expect(features.new_key).toBe("hello");
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
