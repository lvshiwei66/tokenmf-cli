import { describe, it, expect, vi, afterEach } from "vitest";
import { detectAllApps } from "../detectors/index.js";
import { CodexDetector } from "../detectors/codex.js";
import { ClaudeCodeDetector } from "../detectors/claude-code.js";
import { OpenClawDetector } from "../detectors/openclaw.js";
import * as fs from "node:fs";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof fs>("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
  };
});

describe("App detectors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detectAllApps", () => {
    it("returns array", () => {
      const apps = detectAllApps();
      expect(Array.isArray(apps)).toBe(true);
    });

    it("handles errors gracefully", () => {
      const apps = detectAllApps();
      expect(apps).toBeDefined();
    });
  });

  describe("CodexDetector", () => {
    it("detect function exists", () => {
      const detector = new CodexDetector();
      expect(typeof detector.detect).toBe("function");
    });

    it("returns null when config file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const detector = new CodexDetector();
      const result = detector.detect();
      expect(result).toBeNull();
    });

    it("returns AppConfig with required fields when config exists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const detector = new CodexDetector();
      const result = detector.detect();

      expect(result).not.toBeNull();
      expect(result).toHaveProperty("name", "codex");
      expect(result).toHaveProperty("path");
      expect(result).toHaveProperty("configPath");
      expect(result).toHaveProperty("configFormat", "toml");
    });
  });

  describe("ClaudeCodeDetector", () => {
    it("detect function exists", () => {
      const detector = new ClaudeCodeDetector();
      expect(typeof detector.detect).toBe("function");
    });

    it("returns null when config file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const detector = new ClaudeCodeDetector();
      const result = detector.detect();
      expect(result).toBeNull();
    });

    it("returns AppConfig with required fields when config exists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const detector = new ClaudeCodeDetector();
      const result = detector.detect();

      expect(result).not.toBeNull();
      expect(result).toHaveProperty("name", "claude-code");
      expect(result).toHaveProperty("path");
      expect(result).toHaveProperty("configPath");
      expect(result).toHaveProperty("configFormat", "json");
    });
  });

  describe("OpenClawDetector", () => {
    it("detect function exists", () => {
      const detector = new OpenClawDetector();
      expect(typeof detector.detect).toBe("function");
    });

    it("returns null when config file does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const detector = new OpenClawDetector();
      const result = detector.detect();
      expect(result).toBeNull();
    });

    it("returns AppConfig with required fields when config exists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const detector = new OpenClawDetector();
      const result = detector.detect();

      expect(result).not.toBeNull();
      expect(result).toHaveProperty("name", "openclaw");
      expect(result).toHaveProperty("path");
      expect(result).toHaveProperty("configPath");
      expect(result).toHaveProperty("configFormat", "yaml");
    });
  });
});
