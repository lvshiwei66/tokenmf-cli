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
import { rollbackCommand } from "../commands/rollback.js";

// ═══════════════════════════════════════════════════════════════════
// Mock detectors — configurable per test
// ═══════════════════════════════════════════════════════════════════

vi.mock("../detectors/index.js", () => ({
  detectAllApps: vi.fn(() => []),
}));
import { detectAllApps } from "../detectors/index.js";
import type { AppConfig } from "../detectors/types.js";

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

// ═══════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════

describe("rollback command", () => {
  let appDir: string;

  beforeEach(() => {
    appDir = mkdtempSync(join(tmpdir(), "tmf-test-rollback-"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    try {
      rmSync(appDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // ── Single file restore (claude-code) ─────────────────────

  describe("single file restore", () => {
    it("restores claude-code settings.json from .bak", async () => {
      const bakPath = join(appDir, "settings.json.bak");
      const configPath = join(appDir, "settings.json");
      writeFileSync(bakPath, '{"provider":"backup-provider"}');
      writeFileSync(configPath, '{"provider":"current"}');

      vi.mocked(detectAllApps).mockReturnValue([makeClaudeCodeApp(appDir)]);

      await rollbackCommand({});

      const restored = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(restored.provider).toBe("backup-provider");
      expect(existsSync(bakPath)).toBe(false);
    });

    it("restores openclaw config.yaml from .bak", async () => {
      const bakPath = join(appDir, "config.yaml.bak");
      const configPath = join(appDir, "config.yaml");
      writeFileSync(bakPath, "provider: backup-provider\n");
      writeFileSync(configPath, "provider: current\n");

      vi.mocked(detectAllApps).mockReturnValue([makeOpenClawApp(appDir)]);

      await rollbackCommand({});

      const restored = readFileSync(configPath, "utf-8");
      expect(restored).toContain("backup-provider");
      expect(existsSync(bakPath)).toBe(false);
    });
  });

  // ── Multi file restore (codex) ────────────────────────────

  describe("multi file restore", () => {
    it("restores codex config.toml and auth.json from .bak", async () => {
      const tomlBak = join(appDir, "config.toml.bak");
      const tomlCfg = join(appDir, "config.toml");
      const authBak = join(appDir, "auth.json.bak");
      const authCfg = join(appDir, "auth.json");

      writeFileSync(tomlBak, 'model_provider = "backup"\n');
      writeFileSync(tomlCfg, 'model_provider = "current"\n');
      writeFileSync(authBak, '{"token":"backup-token"}');
      writeFileSync(authCfg, '{"token":"current-token"}');

      vi.mocked(detectAllApps).mockReturnValue([makeCodexApp(appDir)]);

      await rollbackCommand({});

      expect(readFileSync(tomlCfg, "utf-8")).toContain("backup");
      expect(JSON.parse(readFileSync(authCfg, "utf-8")).token).toBe("backup-token");
      expect(existsSync(tomlBak)).toBe(false);
      expect(existsSync(authBak)).toBe(false);
    });
  });

  // ── All .bak missing ──────────────────────────────────────

  describe("all backups missing", () => {
    it("throws Chinese error when no .bak files exist", async () => {
      writeFileSync(join(appDir, "settings.json"), '{"provider":"only-current"}');

      vi.mocked(detectAllApps).mockReturnValue([makeClaudeCodeApp(appDir)]);

      await expect(rollbackCommand({})).rejects.toThrow(/backup lost/);
    });

    it("does not modify original config when no .bak exists", async () => {
      const configPath = join(appDir, "settings.json");
      const original = '{"provider":"untouched"}';
      writeFileSync(configPath, original);

      vi.mocked(detectAllApps).mockReturnValue([makeClaudeCodeApp(appDir)]);

      await expect(rollbackCommand({})).rejects.toThrow();
      expect(readFileSync(configPath, "utf-8")).toBe(original);
    });
  });

  // ── Partial .bak missing ──────────────────────────────────

  describe("partial backups", () => {
    it("restores available .bak and warns about missing ones", async () => {
      const tomlBak = join(appDir, "config.toml.bak");
      const tomlCfg = join(appDir, "config.toml");
      const authCfg = join(appDir, "auth.json");
      // auth.json.bak intentionally missing

      writeFileSync(tomlBak, 'model_provider = "backup"\n');
      writeFileSync(tomlCfg, 'model_provider = "current"\n');
      writeFileSync(authCfg, '{"token":"no-backup"}');

      vi.mocked(detectAllApps).mockReturnValue([makeCodexApp(appDir)]);

      const warnings: string[] = [];
      const origWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(args.map(String).join(" "));
      };

      try {
        await rollbackCommand({});

        // Should restore toml
        expect(readFileSync(tomlCfg, "utf-8")).toContain("backup");
        expect(existsSync(tomlBak)).toBe(false);
        // Should NOT touch auth.json
        expect(JSON.parse(readFileSync(authCfg, "utf-8")).token).toBe("no-backup");
        // Should warn about partial
        expect(warnings.some((w) => w.includes("missing"))).toBe(true);
      } finally {
        console.warn = origWarn;
      }
    });
  });

  // ── App selection ─────────────────────────────────────────

  describe("app selection", () => {
    it("auto-selects when only one app installed", async () => {
      const bakPath = join(appDir, "config.yaml.bak");
      const configPath = join(appDir, "config.yaml");
      writeFileSync(bakPath, "provider: auto-selected\n");
      writeFileSync(configPath, "provider: current\n");

      vi.mocked(detectAllApps).mockReturnValue([makeOpenClawApp(appDir)]);

      await rollbackCommand({});
      expect(readFileSync(configPath, "utf-8")).toContain("auto-selected");
    });

    it("throws Chinese error when multiple apps and no --app", async () => {
      const appDir2 = mkdtempSync(join(tmpdir(), "tmf-test-rollback-b-"));
      try {
        writeFileSync(join(appDir, "settings.json.bak"), "{}");
        writeFileSync(join(appDir2, "config.yaml.bak"), "provider: x\n");

        vi.mocked(detectAllApps).mockReturnValue([
          makeClaudeCodeApp(appDir),
          makeOpenClawApp(appDir2),
        ]);

        await expect(rollbackCommand({})).rejects.toThrow(/Multiple/);
      } finally {
        try { rmSync(appDir2, { recursive: true, force: true }); } catch { /* */ }
      }
    });

    it("selects specific app with --app", async () => {
      const appDir2 = mkdtempSync(join(tmpdir(), "tmf-test-rollback-c-"));
      try {
        writeFileSync(join(appDir, "settings.json.bak"), '{"provider":"claude-bak"}');
        writeFileSync(join(appDir, "settings.json"), '{"provider":"claude-curr"}');
        writeFileSync(join(appDir2, "config.yaml.bak"), "provider: openclaw-bak\n");
        writeFileSync(join(appDir2, "config.yaml"), "provider: openclaw-curr\n");

        vi.mocked(detectAllApps).mockReturnValue([
          makeClaudeCodeApp(appDir),
          makeOpenClawApp(appDir2),
        ]);

        await rollbackCommand({ app: "claude-code" });

        const restored = JSON.parse(readFileSync(join(appDir, "settings.json"), "utf-8"));
        expect(restored.provider).toBe("claude-bak");
      } finally {
        try { rmSync(appDir2, { recursive: true, force: true }); } catch { /* */ }
      }
    });

    it("throws when specified app not installed", async () => {
      vi.mocked(detectAllApps).mockReturnValue([makeCodexApp(appDir)]);

      await expect(rollbackCommand({ app: "claude-code" })).rejects.toThrow(/installation not detected/);
    });

    it("throws when no apps installed", async () => {
      vi.mocked(detectAllApps).mockReturnValue([]);

      await expect(rollbackCommand({})).rejects.toThrow(/No installed/);
    });
  });

  // ── Success message ───────────────────────────────────────

  describe("success message", () => {
    it("prints Chinese success message with app name", async () => {
      const log: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => {
        log.push(args.map(String).join(" "));
      };

      writeFileSync(join(appDir, "config.yaml.bak"), "provider: x\n");
      writeFileSync(join(appDir, "config.yaml"), "provider: y\n");
      vi.mocked(detectAllApps).mockReturnValue([makeOpenClawApp(appDir)]);

      try {
        await rollbackCommand({});
        expect(log.some((l) => l.includes("restored") && l.includes("openclaw"))).toBe(true);
        expect(log.some((l) => l.includes("restart"))).toBe(true);
      } finally {
        console.log = origLog;
      }
    });
  });
});
