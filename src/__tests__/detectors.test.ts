import { describe, it, expect, vi, afterEach } from "vitest";
import { detectAllApps } from "../detectors/index.js";
import { ConfigFileDetector } from "../detectors/config-file-detector.js";
import type { DetectorConfig } from "../detectors/config-file-detector.js";
import * as fs from "node:fs";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof fs>("node:fs");
  return {
    ...actual,
    accessSync: vi.fn(),
    existsSync: vi.fn(actual.existsSync),
  };
});

const DETECTOR_CONFIGS: DetectorConfig[] = [
  { name: "codex", configDirName: ".codex", configFileName: "config.toml", configFormat: "toml" },
  { name: "claude-code", configDirName: ".claude", configFileName: "settings.json", configFormat: "json" },
  { name: "openclaw", configDirName: ".openclaw", configFileName: "config.yaml", configFormat: "yaml" },
];

describe("ConfigFileDetector", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  for (const config of DETECTOR_CONFIGS) {
    describe(config.name, () => {
      it("returns null when config file does not exist", () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);
        const detector = new ConfigFileDetector(config);
        expect(detector.detect()).toBeNull();
      });

      it("returns AppConfig with required fields when config exists", () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        const detector = new ConfigFileDetector(config);
        const result = detector.detect();

        expect(result).not.toBeNull();
        expect(result).toHaveProperty("name", config.name);
        expect(result).toHaveProperty("path");
        expect(result).toHaveProperty("configPath");
        expect(result).toHaveProperty("configFormat", config.configFormat);
      });
    });
  }
});

describe("detectAllApps", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array when no apps installed", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(detectAllApps()).toEqual([]);
  });

  it("returns detected apps when config files exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const apps = detectAllApps();
    expect(apps).toHaveLength(6);
    expect(apps.map((a) => a.name).sort()).toEqual(["claude-code", "codex", "hermes", "openclaw", "opencode", "pi"]);
  });
});
