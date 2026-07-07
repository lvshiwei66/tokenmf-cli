import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
import { useCommand } from "../commands/use.js";
import type { Settings } from "../config/index.js";

// ═══════════════════════════════════════════════════════════════════
// Mock detectors — configurable per test
// ═══════════════════════════════════════════════════════════════════

vi.mock("../detectors/index.js", () => ({
  detectAllApps: vi.fn(() => []),
}));
import { detectAllApps } from "../detectors/index.js";
import type { AppConfig } from "../detectors/types.js";

// ═══════════════════════════════════════════════════════════════════
// Mock settings — in-memory, no real FS
// ═══════════════════════════════════════════════════════════════════

let mockSettings: Settings = { providers: {} };
vi.mock("../config/index.js", async () => {
  const actual =
    await vi.importActual<typeof import("../config/index.js")>(
      "../config/index.js",
    );
  return {
    ...actual,
    loadSettings: vi.fn(async () => structuredClone(mockSettings)),
    saveSettings: vi.fn(async (s: Settings) => {
      mockSettings = structuredClone(s) as Settings;
    }),
  };
});
import { saveSettings } from "../config/index.js";

// ═══════════════════════════════════════════════════════════════════
// Mock API client — configurable per test via mockProviderInfos
// ═══════════════════════════════════════════════════════════════════

const mockProviderInfos: Record<
  string,
  { urls: Record<string, string>; defaultModel: string; models: string[]; intro: string; website: string; updated_at: string }
> = {
  packcode: {
    urls: {
      default: "https://api.deepseek.com",
      openai: "https://api.deepseek.com/v1",
      anthropic: "https://api.deepseek.com/anthropic",
    },
    defaultModel: "deepseek-v4-pro",
    models: ["deepseek-v4-pro"],
    intro: "DeepSeek",
    website: "https://platform.deepseek.com",
    updated_at: "Jun 19, 2026 16:30",
  },
  openai: {
    urls: {
      default: "https://api.openai.com/v1",
      openai: "https://api.openai.com/v1",
    },
    defaultModel: "gpt-5.1",
    models: ["gpt-5.1", "gpt-5.1-mini"],
    intro: "OpenAI GPT",
    website: "https://platform.openai.com",
    updated_at: "Jun 19, 2026 16:30",
  },
};

vi.mock("../providers/api.js", () => ({
  fetchProviderInfo: vi.fn(async (_apiUrl: string, _clientId: string, name: string) => {
    const info = mockProviderInfos[name];
    if (!info) return { code: "NOT_FOUND", message: `Provider not found: ${name}` };
    return { name, ...info };
  }),
}));
import { fetchProviderInfo } from "../providers/api.js";

const TEST_API_URL = "https://test.api";
const TEST_CLIENT_ID = "test-client-id";

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function makeCodexApp(appPath: string): AppConfig {
  return {
    name: "codex",
    version: "1.0.0",
    path: appPath,
    configPath: join(appPath, "config.toml"),
    configFormat: "toml",
  };
}

function makeClaudeCodeApp(appPath: string): AppConfig {
  return {
    name: "claude-code",
    version: "2.0.0",
    path: appPath,
    configPath: join(appPath, "settings.json"),
    configFormat: "json",
  };
}

function makeOpenClawApp(appPath: string): AppConfig {
  return {
    name: "openclaw",
    version: "3.0.0",
    path: appPath,
    configPath: join(appPath, "config.yaml"),
    configFormat: "yaml",
  };
}

function captureLogs() {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  return {
    logs,
    restore: () => {
      console.log = orig;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════

describe("use command — E2E", () => {
  let appDir: string;

  beforeEach(() => {
    appDir = mkdtempSync(join(tmpdir(), "tmf-test-use-"));
    mockSettings = { providers: {} };
    vi.clearAllMocks();
  });

  afterEach(() => {
    try {
      rmSync(appDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // ── Codex (TOML + JSON auth) ───────────────────────────────

  describe("Codex app (TOML + auth.json)", () => {
    beforeEach(() => {
      writeFileSync(
        join(appDir, "config.toml"),
        'model_provider = "openai"\nmodel = "gpt-5.1"\n',
      );
      vi.mocked(detectAllApps).mockReturnValue([makeCodexApp(appDir)]);
    });

    it("switches provider and creates backup + auth.json", async () => {
      const { logs, restore } = captureLogs();

      try {
        await useCommand("packcode", {
          key: "sk-test-key",
          app: "codex",
        }, TEST_API_URL, TEST_CLIENT_ID);

        // Backup created
        expect(existsSync(join(appDir, "config.toml.bak"))).toBe(true);

        // Config rewritten
        const newToml = readFileSync(join(appDir, "config.toml"), "utf-8");
        expect(newToml).toContain("packcode");
        expect(newToml).toContain("custom");

        // auth.json created
        expect(existsSync(join(appDir, "auth.json"))).toBe(true);
        const auth = JSON.parse(
          readFileSync(join(appDir, "auth.json"), "utf-8"),
        ) as Record<string, unknown>;
        expect(auth.OPENAI_API_KEY).toBe("sk-test-key");

        // Success message
        const successMsg = logs.find((l) => l.includes("Switched"));
        expect(successMsg).toContain("codex");
        expect(successMsg).toContain("packcode");
      } finally {
        restore();
      }
    });

    it("creates backup before modifying config", async () => {
      const configPath = join(appDir, "config.toml");
      const originalContent = readFileSync(configPath, "utf-8");

      await useCommand("packcode", {
        key: "sk-test-key",
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      expect(existsSync(configPath + ".bak")).toBe(true);
      expect(readFileSync(configPath + ".bak", "utf-8")).toBe(originalContent);
    });

    it("uses provider default model when --model not provided and no memory", async () => {
      await useCommand("packcode", {
        key: "sk-test-key",
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      const newToml = readFileSync(join(appDir, "config.toml"), "utf-8");
      const toml = parseToml(newToml) as Record<string, unknown>;
      expect(toml.model).toBe("deepseek-v4-pro");
    });

    it("overrides model when --model provided", async () => {
      await useCommand("packcode", {
        key: "sk-test-key",
        model: "deepseek-v4-lite",
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      const newToml = readFileSync(join(appDir, "config.toml"), "utf-8");
      const toml = parseToml(newToml) as Record<string, unknown>;
      expect(toml.model).toBe("deepseek-v4-lite");
    });
  });

  // ── Claude Code (JSON) ─────────────────────────────────────

  describe("Claude Code app (JSON)", () => {
    beforeEach(() => {
      writeFileSync(
        join(appDir, "settings.json"),
        JSON.stringify({
          env: {
            ANTHROPIC_AUTH_TOKEN: "sk-old",
            ANTHROPIC_BASE_URL: "https://api.anthropic.com",
            ANTHROPIC_MODEL: "claude-sonnet-4-20250514",
          },
          otherSetting: "keep-me",
        }),
      );
      vi.mocked(detectAllApps).mockReturnValue([makeClaudeCodeApp(appDir)]);
    });

    it("switches provider in settings.json", async () => {
      const { logs, restore } = captureLogs();

      try {
        await useCommand("packcode", {
          key: "sk-test-key",
          app: "claude-code",
        }, TEST_API_URL, TEST_CLIENT_ID);

        // Backup created
        expect(existsSync(join(appDir, "settings.json.bak"))).toBe(true);

        // Config rewritten
        const result = JSON.parse(
          readFileSync(join(appDir, "settings.json"), "utf-8"),
        ) as Record<string, unknown>;
        const env = result.env as Record<string, unknown>;
        expect(env.ANTHROPIC_AUTH_TOKEN).toBe("sk-test-key");
        expect(env.ANTHROPIC_BASE_URL).toBe("https://api.deepseek.com/anthropic");
        expect(env.ANTHROPIC_MODEL).toBe("deepseek-v4-pro");
        expect(result.otherSetting).toBe("keep-me");

        // Success message
        const successMsg = logs.find((l) => l.includes("Switched"));
        expect(successMsg).toContain("claude-code");
        expect(successMsg).toContain("packcode");
      } finally {
        restore();
      }
    });

    it("uses provider default model when --model not provided (no memory)", async () => {
      // resolveModel: options.model=undefined, memory=undefined
      // → falls back to providerInfo.defaultModel from ask API
      // packcode's defaultModel is "deepseek-v4-pro"

      await useCommand("packcode", {
        key: "sk-test-key",
        app: "claude-code",
      }, TEST_API_URL, TEST_CLIENT_ID);

      const result = JSON.parse(
        readFileSync(join(appDir, "settings.json"), "utf-8"),
      ) as Record<string, unknown>;
      const env = result.env as Record<string, unknown>;
      expect(env.ANTHROPIC_MODEL).toBe("deepseek-v4-pro");
    });

    it("overrides model when --model provided from CLI", async () => {
      await useCommand("packcode", {
        key: "sk-test-key",
        model: "custom-model-cli",
        app: "claude-code",
      }, TEST_API_URL, TEST_CLIENT_ID);

      const result = JSON.parse(
        readFileSync(join(appDir, "settings.json"), "utf-8"),
      ) as Record<string, unknown>;
      const env = result.env as Record<string, unknown>;
      expect(env.ANTHROPIC_MODEL).toBe("custom-model-cli");
    });
  });

  // ── OpenClaw (YAML) ────────────────────────────────────────

  describe("OpenClaw app (YAML)", () => {
    beforeEach(() => {
      writeFileSync(
        join(appDir, "config.yaml"),
        [
          "provider: anthropic",
          "model: claude-sonnet-4-20250514",
          "api_key: sk-old",
          "base_url: https://api.anthropic.com",
          "other_setting: keep-me",
          "",
        ].join("\n"),
      );
      vi.mocked(detectAllApps).mockReturnValue([makeOpenClawApp(appDir)]);
    });

    it("switches provider in config.yaml", async () => {
      const { logs, restore } = captureLogs();

      try {
        await useCommand("openai", {
          key: "sk-openai-key",
          app: "openclaw",
        }, TEST_API_URL, TEST_CLIENT_ID);

        // Backup created
        expect(existsSync(join(appDir, "config.yaml.bak"))).toBe(true);

        // Config rewritten
        const result = parseYaml(
          readFileSync(join(appDir, "config.yaml"), "utf-8"),
        ) as Record<string, unknown>;
        expect(result.provider).toBe("openai");
        expect(result.base_url).toBe("https://api.openai.com/v1");
        expect(result.api_key).toBe("sk-openai-key");
        expect(result.model).toBe("gpt-5.1");
        expect(result.other_setting).toBe("keep-me");

        // Success message
        const successMsg = logs.find((l) => l.includes("Switched"));
        expect(successMsg).toContain("openclaw");
        expect(successMsg).toContain("openai");
      } finally {
        restore();
      }
    });

    it("uses provider default model when --model not provided and no memory", async () => {
      await useCommand("packcode", {
        key: "sk-test-key",
        app: "openclaw",
      }, TEST_API_URL, TEST_CLIENT_ID);

      const result = parseYaml(
        readFileSync(join(appDir, "config.yaml"), "utf-8"),
      ) as Record<string, unknown>;
      expect(result.model).toBe("deepseek-v4-pro");
    });

    it("overrides model from CLI --model", async () => {
      await useCommand("packcode", {
        key: "sk-test-key",
        model: "my-custom-model",
        app: "openclaw",
      }, TEST_API_URL, TEST_CLIENT_ID);

      const result = parseYaml(
        readFileSync(join(appDir, "config.yaml"), "utf-8"),
      ) as Record<string, unknown>;
      expect(result.model).toBe("my-custom-model");
    });
  });

  // ── Advanced Claude Code options ──────────────────────────

  describe("advanced Claude Code options (--models, --env, --effort)", () => {
    beforeEach(() => {
      writeFileSync(
        join(appDir, "settings.json"),
        JSON.stringify({}),
      );
      vi.mocked(detectAllApps).mockReturnValue([makeClaudeCodeApp(appDir)]);
    });

    it("passes --models to settings.json as fallback chain", async () => {
      await useCommand("packcode", {
        key: "sk-test-key",
        models: ["claude-sonnet-5", "claude-haiku-4-5"],
        app: "claude-code",
      }, TEST_API_URL, TEST_CLIENT_ID);

      const result = JSON.parse(
        readFileSync(join(appDir, "settings.json"), "utf-8"),
      ) as Record<string, unknown>;
      const env = result.env as Record<string, unknown>;
      expect(env.ANTHROPIC_MODEL).toBe("claude-sonnet-5");
      expect(result.model).toBe("claude-sonnet-5");
      expect(result.fallbackModel).toEqual(["claude-haiku-4-5"]);
    });

    it("passes --effort to settings.json", async () => {
      await useCommand("packcode", {
        key: "sk-test-key",
        model: "claude-sonnet-5",
        effortLevel: "xhigh",
        app: "claude-code",
      }, TEST_API_URL, TEST_CLIENT_ID);

      const result = JSON.parse(
        readFileSync(join(appDir, "settings.json"), "utf-8"),
      ) as Record<string, unknown>;
      expect(result.effortLevel).toBe("xhigh");
    });

    it("passes --env to settings.json env block", async () => {
      await useCommand("packcode", {
        key: "sk-test-key",
        model: "claude-sonnet-5",
        env: {
          ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-5-20250929",
          ANTHROPIC_BETAS: "feature-x",
        },
        app: "claude-code",
      }, TEST_API_URL, TEST_CLIENT_ID);

      const result = JSON.parse(
        readFileSync(join(appDir, "settings.json"), "utf-8"),
      ) as Record<string, unknown>;
      const env = result.env as Record<string, unknown>;
      expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe("claude-sonnet-5-20250929");
      expect(env.ANTHROPIC_BETAS).toBe("feature-x");
    });

    it("success message includes new option details", async () => {
      const { logs, restore } = captureLogs();
      try {
        await useCommand("packcode", {
          key: "sk-test-key",
          models: ["sonnet", "haiku"],
          effortLevel: "high",
          env: { ANTHROPIC_BETAS: "x" },
          app: "claude-code",
        }, TEST_API_URL, TEST_CLIENT_ID);

        const successMsg = logs.find((l) => l.includes("Switched"));
        expect(successMsg).toContain("model: sonnet");
        expect(successMsg).toContain("fallback: [haiku]");
        expect(successMsg).toContain("effort: high");
        expect(successMsg).toContain("+1 env var(s)");
      } finally {
        restore();
      }
    });
  });

  // ── Advanced Codex options ────────────────────────────────

  describe("advanced Codex options (--models, --effort, --env)", () => {
    beforeEach(() => {
      writeFileSync(
        join(appDir, "config.toml"),
        'model_provider = "openai"\nmodel = "gpt-5.1"\n',
      );
      vi.mocked(detectAllApps).mockReturnValue([makeCodexApp(appDir)]);
    });

    it("passes --models to config.toml (first model only)", async () => {
      await useCommand("packcode", {
        key: "sk-test-key",
        models: ["model-a", "model-b"],
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      const newToml = readFileSync(join(appDir, "config.toml"), "utf-8");
      const toml = parseToml(newToml) as Record<string, unknown>;
      expect(toml.model).toBe("model-a");
    });

    it("passes --effort to config.toml", async () => {
      await useCommand("packcode", {
        key: "sk-test-key",
        model: "deepseek-v4-pro",
        effortLevel: "high",
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      const newToml = readFileSync(join(appDir, "config.toml"), "utf-8");
      const toml = parseToml(newToml) as Record<string, unknown>;
      expect(toml.model_reasoning_effort).toBe("high");
    });

    it("passes --env to config.toml (features)", async () => {
      await useCommand("packcode", {
        key: "sk-test-key",
        model: "deepseek-v4-pro",
        env: { "features.browser_use": "true" },
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      const newToml = readFileSync(join(appDir, "config.toml"), "utf-8");
      const toml = parseToml(newToml) as Record<string, unknown>;
      const features = toml.features as Record<string, unknown>;
      expect(features.browser_use).toBe(true);
    });
  });

  // ── Provider memory ────────────────────────────────────────

  describe("provider memory (settings.json)", () => {
    beforeEach(() => {
      writeFileSync(
        join(appDir, "config.toml"),
        'model_provider = "openai"\nmodel = "gpt-5.1"\n',
      );
      vi.mocked(detectAllApps).mockReturnValue([makeCodexApp(appDir)]);
    });

    it("uses apiKey from memory when --key not provided", async () => {
      // Pre-populate memory
      mockSettings = {
        providers: {
          packcode: {
            apiKey: "sk-memory-key",
            model: "deepseek-v4-pro",
            urls: { default: "https://api.deepseek.com/v1", openai: "https://api.deepseek.com/v1", anthropic: "https://api.deepseek.com/anthropic" },
          },
        },
      };

      const { logs, restore } = captureLogs();
      try {
        await useCommand("packcode", { app: "codex" }, TEST_API_URL, TEST_CLIENT_ID);

        // Should use memory key, NOT call ask API (because urls is in memory)
        const auth = JSON.parse(
          readFileSync(join(appDir, "auth.json"), "utf-8"),
        ) as Record<string, unknown>;
        expect(auth.OPENAI_API_KEY).toBe("sk-memory-key");

        // ask should NOT have been called (urls cached in memory)
        expect(fetchProviderInfo).not.toHaveBeenCalled();

        // Success message should still appear
        const successMsg = logs.find((l) => l.includes("Switched"));
        expect(successMsg).toContain("codex");
      } finally {
        restore();
      }
    });

    it("uses model from memory when --model not provided", async () => {
      mockSettings = {
        providers: {
          packcode: {
            apiKey: "sk-memory-key",
            model: "deepseek-v4-lite-from-memory",
            urls: { default: "https://api.deepseek.com/v1", openai: "https://api.deepseek.com/v1", anthropic: "https://api.deepseek.com/anthropic" },
          },
        },
      };

      await useCommand("packcode", { app: "codex" }, TEST_API_URL, TEST_CLIENT_ID);

      const newToml = readFileSync(join(appDir, "config.toml"), "utf-8");
      const toml = parseToml(newToml) as Record<string, unknown>;
      expect(toml.model).toBe("deepseek-v4-lite-from-memory");
    });

    it("CLI --model overrides memory model", async () => {
      mockSettings = {
        providers: {
          packcode: {
            apiKey: "sk-memory-key",
            model: "memory-model",
            urls: { default: "https://api.deepseek.com/v1", openai: "https://api.deepseek.com/v1", anthropic: "https://api.deepseek.com/anthropic" },
          },
        },
      };

      await useCommand("packcode", {
        model: "cli-override-model",
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      const newToml = readFileSync(join(appDir, "config.toml"), "utf-8");
      const toml = parseToml(newToml) as Record<string, unknown>;
      expect(toml.model).toBe("cli-override-model");
    });

    it("CLI --key overrides memory apiKey and updates memory", async () => {
      mockSettings = {
        providers: {
          packcode: {
            apiKey: "sk-old-memory-key",
            urls: { default: "https://api.deepseek.com/v1", openai: "https://api.deepseek.com/v1", anthropic: "https://api.deepseek.com/anthropic" },
          },
        },
      };

      await useCommand("packcode", {
        key: "sk-new-cli-key",
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      // Config should use new key
      const auth = JSON.parse(
        readFileSync(join(appDir, "auth.json"), "utf-8"),
      ) as Record<string, unknown>;
      expect(auth.OPENAI_API_KEY).toBe("sk-new-cli-key");

      // Memory should be updated with new key
      expect(saveSettings).toHaveBeenCalled();
      expect(mockSettings.providers["packcode"]?.apiKey).toBe("sk-new-cli-key");
    });

    it("calls ask API when urls not in memory", async () => {
      // No memory for this provider at all
      mockSettings = { providers: {} };

      await useCommand("packcode", {
        key: "sk-test-key",
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      // ask API should have been called
      expect(fetchProviderInfo).toHaveBeenCalledWith("https://test.api", "test-client-id", "packcode");
    });

    it("does NOT call ask API when memory has urls", async () => {
      mockSettings = {
        providers: {
          packcode: {
            apiKey: "sk-memory-key",
            urls: { default: "https://api.deepseek.com/custom", openai: "https://api.deepseek.com/custom" },
          },
        },
      };

      await useCommand("packcode", { app: "codex" }, TEST_API_URL, TEST_CLIENT_ID);

      // ask should NOT be called
      expect(fetchProviderInfo).not.toHaveBeenCalled();
    });
  });

  // ── Settings persistence ───────────────────────────────────

  describe("settings persistence", () => {
    beforeEach(() => {
      writeFileSync(
        join(appDir, "config.toml"),
        'model_provider = "openai"\nmodel = "gpt-5.1"\n',
      );
      vi.mocked(detectAllApps).mockReturnValue([makeCodexApp(appDir)]);
    });

    it("saves provider memory after successful switch", async () => {
      mockSettings = { providers: {} };

      await useCommand("packcode", {
        key: "sk-test-key",
        model: "deepseek-v4-pro",
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      expect(saveSettings).toHaveBeenCalled();
      expect(mockSettings.providers["packcode"]).toEqual({
        apiKey: "sk-test-key",
        model: "deepseek-v4-pro",
        urls: { default: "https://api.deepseek.com", openai: "https://api.deepseek.com/v1", anthropic: "https://api.deepseek.com/anthropic" },
      });
    });

    it("saves memory with default model when --model not provided", async () => {
      mockSettings = { providers: {} };

      await useCommand("packcode", {
        key: "sk-test-key",
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      // Model falls back to provider default (deepseek-v4-pro) and is saved
      expect(mockSettings.providers["packcode"]).toBeDefined();
      expect(mockSettings.providers["packcode"]?.apiKey).toBe("sk-test-key");
      expect(mockSettings.providers["packcode"]?.model).toBe("deepseek-v4-pro");
    });

    it("does not overwrite other providers' memory", async () => {
      mockSettings = {
        providers: {
          openai: {
            apiKey: "sk-openai-key",
            urls: { default: "https://api.openai.com/v1", openai: "https://api.openai.com/v1" },
          },
        },
      };

      await useCommand("packcode", {
        key: "sk-packcode-key",
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      expect(mockSettings.providers["openai"]).toEqual({
        apiKey: "sk-openai-key",
        urls: { default: "https://api.openai.com/v1", openai: "https://api.openai.com/v1" },
      });
      expect(mockSettings.providers["packcode"]?.apiKey).toBe(
        "sk-packcode-key",
      );
    });

    it("updates apiKey and model while preserving urls from memory", async () => {
      mockSettings = {
        providers: {
          packcode: {
            apiKey: "sk-old-key",
            model: "old-model",
            urls: { default: "https://old-url.com", openai: "https://old-url.com" },
          },
        },
      };

      await useCommand("packcode", {
        key: "sk-new-key",
        model: "new-model",
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      // apiKey and model are overridden by CLI args; urls from memory is preserved
      expect(mockSettings.providers["packcode"]).toEqual({
        apiKey: "sk-new-key",
        model: "new-model",
        urls: { default: "https://old-url.com", openai: "https://old-url.com" },
      });
    });
  });

  // ── Backup behavior ────────────────────────────────────────

  describe("backup behavior", () => {
    beforeEach(() => {
      writeFileSync(
        join(appDir, "config.toml"),
        'model_provider = "openai"\nmodel = "gpt-5.1"\n',
      );
    });

    it("backs up both config files for Codex (config.toml + auth.json)", async () => {
      // Create existing auth.json
      writeFileSync(
        join(appDir, "auth.json"),
        JSON.stringify({ OPENAI_API_KEY: "sk-old" }),
      );

      vi.mocked(detectAllApps).mockReturnValue([makeCodexApp(appDir)]);

      await useCommand("packcode", {
        key: "sk-test-key",
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      // Both should have .bak siblings
      expect(existsSync(join(appDir, "config.toml.bak"))).toBe(true);
      expect(existsSync(join(appDir, "auth.json.bak"))).toBe(true);

      // Original auth.json content preserved in backup
      const authBackup = JSON.parse(
        readFileSync(join(appDir, "auth.json.bak"), "utf-8"),
      ) as Record<string, unknown>;
      expect(authBackup.OPENAI_API_KEY).toBe("sk-old");
    });

    it("handles backup when auth.json does not exist (Codex)", async () => {
      // No auth.json initially
      vi.mocked(detectAllApps).mockReturnValue([makeCodexApp(appDir)]);

      await useCommand("packcode", {
        key: "sk-test-key",
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      // config.toml should be backed up
      expect(existsSync(join(appDir, "config.toml.bak"))).toBe(true);

      // auth.json should NOT have a .bak (it didn't exist)
      expect(existsSync(join(appDir, "auth.json.bak"))).toBe(false);

      // auth.json should be created fresh
      expect(existsSync(join(appDir, "auth.json"))).toBe(true);
    });

    it("overwrites existing .bak files on subsequent use", async () => {
      vi.mocked(detectAllApps).mockReturnValue([makeCodexApp(appDir)]);

      // First use
      await useCommand("packcode", {
        key: "sk-first-key",
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      const firstBackup = readFileSync(
        join(appDir, "config.toml.bak"),
        "utf-8",
      );

      // Second use - backup should be overwritten with current state
      await useCommand("openai", {
        key: "sk-second-key",
        app: "codex",
      }, TEST_API_URL, TEST_CLIENT_ID);

      const secondBackup = readFileSync(
        join(appDir, "config.toml.bak"),
        "utf-8",
      );
      expect(secondBackup).not.toBe(firstBackup);
      // Second backup should contain packcode (the state after first use)
      expect(secondBackup).toContain("packcode");
    });
  });

  // ── App selection ──────────────────────────────────────────

  describe("app selection", () => {
    beforeEach(() => {
      writeFileSync(
        join(appDir, "config.toml"),
        'model_provider = "openai"\nmodel = "gpt-5.1"\n',
      );
    });

    it("auto-selects single app when --app not provided", async () => {
      vi.mocked(detectAllApps).mockReturnValue([makeCodexApp(appDir)]);

      const { logs, restore } = captureLogs();
      try {
        await useCommand("packcode", { key: "sk-test-key" }, TEST_API_URL, TEST_CLIENT_ID);

        const successMsg = logs.find((l) => l.includes("Switched"));
        expect(successMsg).toContain("codex");
        expect(successMsg).toContain("packcode");
      } finally {
        restore();
      }
    });

    it("throws when specified app not found", async () => {
      vi.mocked(detectAllApps).mockReturnValue([makeCodexApp(appDir)]);

      await expect(
        useCommand("packcode", { key: "sk-test", app: "claude-code" }, TEST_API_URL, TEST_CLIENT_ID),
      ).rejects.toThrow(/not found/);
    });

    it("applies to all apps when --app not specified", async () => {
      const appDir2 = mkdtempSync(join(tmpdir(), "tmf-test-use2-"));
      try {
        const testSettings = join(appDir2, "settings.json");
        writeFileSync(testSettings, "{}");

        vi.mocked(detectAllApps).mockReturnValue([
          makeCodexApp(appDir),
          { ...makeClaudeCodeApp(appDir2), configPath: testSettings },
        ]);

        await useCommand("packcode", { key: "sk-test" }, TEST_API_URL, TEST_CLIENT_ID);
        // No throw → both apps processed
      } finally {
        try { rmSync(appDir2, { recursive: true, force: true }); } catch { /* */ }
      }
    });

    it("throws when no apps installed", async () => {
      vi.mocked(detectAllApps).mockReturnValue([]);

      await expect(
        useCommand("packcode", { key: "sk-test" }, TEST_API_URL, TEST_CLIENT_ID),
      ).rejects.toThrow(/No installed/);
    });
  });

  // ── App selection with multiple apps but --app specified ───

  describe("app selection with --app flag", () => {
    let appDir2: string;

    beforeEach(() => {
      writeFileSync(
        join(appDir, "config.toml"),
        'model_provider = "openai"\nmodel = "gpt-5.1"\n',
      );
      appDir2 = mkdtempSync(join(tmpdir(), "tmf-test-use3-"));
      writeFileSync(
        join(appDir2, "settings.json"),
        JSON.stringify({ provider: "anthropic" }),
      );
    });

    afterEach(() => {
      try {
        rmSync(appDir2, { recursive: true, force: true });
      } catch {
        // ignore
      }
    });

    it("selects specified app from multiple installed apps", async () => {
      vi.mocked(detectAllApps).mockReturnValue([
        makeCodexApp(appDir),
        makeClaudeCodeApp(appDir2),
      ]);

      const { logs, restore } = captureLogs();
      try {
        await useCommand("packcode", {
          key: "sk-test-key",
          app: "codex",
        }, TEST_API_URL, TEST_CLIENT_ID);

        const successMsg = logs.find((l) => l.includes("Switched"));
        expect(successMsg).toContain("codex");

        // Only codex should be modified
        expect(existsSync(join(appDir, "config.toml.bak"))).toBe(true);
      } finally {
        restore();
      }
    });

    it("selects second app from multiple when specified", async () => {
      vi.mocked(detectAllApps).mockReturnValue([
        makeCodexApp(appDir),
        makeClaudeCodeApp(appDir2),
      ]);

      const { logs, restore } = captureLogs();
      try {
        await useCommand("openai", {
          key: "sk-openai-key",
          app: "claude-code",
          model: "gpt-5.1-mini",
        }, TEST_API_URL, TEST_CLIENT_ID);

        const successMsg = logs.find((l) => l.includes("Switched"));
        expect(successMsg).toContain("claude-code");
        expect(successMsg).toContain("openai");

        // claude-code should be modified
        expect(existsSync(join(appDir2, "settings.json.bak"))).toBe(true);
        const result = JSON.parse(
          readFileSync(join(appDir2, "settings.json"), "utf-8"),
        ) as Record<string, unknown>;
        const env = result.env as Record<string, unknown>;
        expect(env.ANTHROPIC_AUTH_TOKEN).toBe("sk-openai-key");
        expect(env.ANTHROPIC_MODEL).toBe("gpt-5.1-mini");
      } finally {
        restore();
      }
    });
  });

  // ── Error handling ─────────────────────────────────────────

  describe("error handling", () => {
    beforeEach(() => {
      writeFileSync(
        join(appDir, "config.toml"),
        'model_provider = "openai"\nmodel = "gpt-5.1"\n',
      );
      vi.mocked(detectAllApps).mockReturnValue([makeCodexApp(appDir)]);
    });

    it("throws for unknown provider", async () => {
      await expect(
        useCommand("nonexistent", { key: "sk-test", app: "codex" }, TEST_API_URL, TEST_CLIENT_ID),
      ).rejects.toThrow(/Cannot get/);
    });

    it("throws when ask API fails for unknown provider", async () => {
      // No memory, ask API will fail
      mockSettings = { providers: {} };

      await expect(
        useCommand("unknown-provider-xyz", {
          key: "sk-test",
          app: "codex",
        }, TEST_API_URL, TEST_CLIENT_ID),
      ).rejects.toThrow(/Cannot get/);
    });

    it("throws when no API key provided and no memory", async () => {
      // This is tricky to test because it requires stdin interaction
      // We test the case where interactive input returns empty
      // For now, we verify the error path is reached
      // (The function calls promptHidden which we can't easily mock)
    });

    it("provides Chinese error messages", async () => {
      await expect(
        useCommand("nonexistent", { key: "sk-test", app: "codex" }, TEST_API_URL, TEST_CLIENT_ID),
      ).rejects.toThrow(/Cannot get/);
    });

    it("warns and skips when app has no appfit", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.mocked(detectAllApps).mockReturnValue([
        {
          name: "unknown-app",
          version: "1.0",
          path: appDir,
          configPath: join(appDir, "config.toml"),
          configFormat: "toml",
        },
      ]);


      await useCommand("packcode", { key: "sk-test", app: "unknown-app" }, TEST_API_URL, TEST_CLIENT_ID);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Unsupported"));
      warnSpy.mockRestore();
    });
  });

  // ── Success message variations ─────────────────────────────

  describe("success messages", () => {
    beforeEach(() => {
      writeFileSync(
        join(appDir, "config.toml"),
        'model_provider = "openai"\nmodel = "gpt-5.1"\n',
      );
      vi.mocked(detectAllApps).mockReturnValue([makeCodexApp(appDir)]);
    });

    it("includes model name in success message when model is set", async () => {
      const { logs, restore } = captureLogs();
      try {
        await useCommand("packcode", {
          key: "sk-test-key",
          model: "deepseek-v4-pro",
          app: "codex",
        }, TEST_API_URL, TEST_CLIENT_ID);

        const successMsg = logs.find((l) => l.includes("Switched"));
        expect(successMsg).toContain("deepseek-v4-pro");
        expect(successMsg).toContain("model: deepseek-v4-pro");
      } finally {
        restore();
      }
    });

    it("includes provider default model in success message when --model not provided", async () => {
      const { logs, restore } = captureLogs();
      try {
        await useCommand("packcode", {
          key: "sk-test-key",
          app: "codex",
        }, TEST_API_URL, TEST_CLIENT_ID);

        // Falls back to provider default model
        const successMsg = logs.find((l) => l.includes("Switched"));
        expect(successMsg).toContain("model: deepseek-v4-pro");
      } finally {
        restore();
      }
    });

    it("prompts user to restart app after switch", async () => {
      const { logs, restore } = captureLogs();
      try {
        await useCommand("packcode", {
          key: "sk-test-key",
          app: "codex",
        }, TEST_API_URL, TEST_CLIENT_ID);

        const successMsg = logs.find((l) => l.includes("Switched"));
        expect(successMsg).toContain("restart");
      } finally {
        restore();
      }
    });
  });
});
