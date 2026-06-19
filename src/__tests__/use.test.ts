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
import { useCommand } from "../commands/use.js";

// Mock detectors
vi.mock("../detectors/index.js", () => ({
  detectAllApps: vi.fn(() => []),
}));
import { detectAllApps } from "../detectors/index.js";

// Mock settings — in-memory, no FS
let mockSettings: Record<string, unknown> = { providers: {} };
vi.mock("../config/settings.js", async () => {
  const actual =
    await vi.importActual<typeof import("../config/settings.js")>(
      "../config/settings.js",
    );
  return {
    ...actual,
    loadSettings: vi.fn(async () => structuredClone(mockSettings)),
    saveSettings: vi.fn(async (s: unknown) => {
      mockSettings = s as Record<string, unknown>;
    }),
  };
});

// Mock ask
vi.mock("../providers/ask.js", () => ({
  queryProvider: vi.fn(async (name: string) => {
    const providers: Record<
      string,
      { baseUrl: string; defaultModel: string; models: string[]; intro: string }
    > = {
      packcode: {
        baseUrl: "https://api.deepseek.com/openai",
        defaultModel: "deepseek-v4-pro",
        models: ["deepseek-v4-pro"],
        intro: "\u6DF1\u5EA6\u6C42\u7D22",
      },
    };
    const info = providers[name];
    if (!info) throw new Error(`\u672A\u77E5\u7684 Provider: ${name}`);
    return { name, ...info };
  }),
}));

describe("use command integration", () => {
  let appDir: string;

  beforeEach(() => {
    appDir = mkdtempSync(join(tmpdir(), "tmf-test-use-"));
    writeFileSync(
      join(appDir, "config.toml"),
      'model_provider = "openai"\nmodel = "gpt-5.1"\n',
    );

    vi.mocked(detectAllApps).mockReturnValue([
      {
        name: "codex",
        version: "1.0.0",
        path: appDir,
        configPath: join(appDir, "config.toml"),
        configFormat: "toml",
      },
    ]);

    mockSettings = { providers: {} };
  });

  afterEach(() => {
    try {
      rmSync(appDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("switches app successfully with --key and --app", async () => {
    const origLog = console.log;
    const logs: string[] = [];
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };

    try {
      await useCommand("packcode", {
        key: "sk-test-key",
        app: "codex",
      });

      expect(existsSync(join(appDir, "config.toml.bak"))).toBe(true);

      const newToml = readFileSync(join(appDir, "config.toml"), "utf-8");
      expect(newToml).toContain("packcode");
      expect(newToml).toContain("custom");

      expect(existsSync(join(appDir, "auth.json"))).toBe(true);

      const successMsg = logs.find((l) => l.includes("\u5DF2"));
      expect(successMsg).toBeDefined();
      expect(successMsg).toContain("codex");
      expect(successMsg).toContain("packcode");

      // Verify settings were saved
      expect(mockSettings).toHaveProperty("providers");
    } finally {
      console.log = origLog;
    }
  });

  it("creates backup files before modifying config", async () => {
    const origBackup = join(appDir, "config.toml.bak");
    const originalContent = readFileSync(join(appDir, "config.toml"), "utf-8");

    await useCommand("packcode", {
      key: "sk-test-key",
      app: "codex",
    });

    expect(existsSync(origBackup)).toBe(true);
    expect(readFileSync(origBackup, "utf-8")).toBe(originalContent);
  });

  it("does not modify model when --model is not provided and no memory", async () => {
    await useCommand("packcode", {
      key: "sk-test-key",
      app: "codex",
    });

    const newToml = readFileSync(join(appDir, "config.toml"), "utf-8");
    const toml = parseToml(newToml) as Record<string, unknown>;
    expect(toml.model).toBe("gpt-5.1");
  });

  it("throws for unknown provider", async () => {
    await expect(
      useCommand("nonexistent", { key: "sk-test", app: "codex" }),
    ).rejects.toThrow(/\u65E0\u6CD5\u83B7\u53D6 Provider/);
  });

  it("throws when specified app not found", async () => {
    await expect(
      useCommand("packcode", { key: "sk-test", app: "claude-code" }),
    ).rejects.toThrow(/\u672A\u627E\u5230\u5E94\u7528/);
  });

  it("throws when multiple apps and no --app", async () => {
    vi.mocked(detectAllApps).mockReturnValue([
      {
        name: "codex",
        version: "1.0.0",
        path: "/tmp/mock1",
        configPath: "/tmp/mock1/config.toml",
        configFormat: "toml",
      },
      {
        name: "claude-code",
        version: "1.0.0",
        path: "/tmp/mock2",
        configPath: "/tmp/mock2/settings.json",
        configFormat: "json",
      },
    ]);

    await expect(
      useCommand("packcode", { key: "sk-test" }),
    ).rejects.toThrow(/\u591A\u4E2A\u5E94\u7528/);
  });

  it("auto-selects single app when --app not provided", async () => {
    const origLog = console.log;
    const logs: string[] = [];
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };

    try {
      await useCommand("packcode", { key: "sk-test-key" });

      const successMsg = logs.find((l) => l.includes("\u5DF2"));
      expect(successMsg).toContain("codex");
      expect(successMsg).toContain("packcode");
    } finally {
      console.log = origLog;
    }
  });
});
