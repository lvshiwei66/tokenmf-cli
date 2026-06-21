import type { AppConfig } from "./types.js";
import { ConfigFileDetector } from "./config-file-detector.js";
import type { DetectorConfig } from "./config-file-detector.js";

const DETECTOR_CONFIGS: DetectorConfig[] = [
  { name: "codex", configDirName: ".codex", configFileName: "config.toml", configFormat: "toml" },
  { name: "claude-code", configDirName: ".claude", configFileName: "settings.json", configFormat: "json" },
  { name: "openclaw", configDirName: ".openclaw", configFileName: "config.yaml", configFormat: "yaml" },
];

export function detectAllApps(): AppConfig[] {
  const apps: AppConfig[] = [];

  for (const config of DETECTOR_CONFIGS) {
    try {
      const detector = new ConfigFileDetector(config);
      const app = detector.detect();
      if (app) {
        apps.push(app);
      }
    } catch (error) {
      console.error(`Detection ${config.name} failed:`, error);
    }
  }

  return apps;
}
