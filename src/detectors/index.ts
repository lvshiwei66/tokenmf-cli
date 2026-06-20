import type { AppConfig, Detector } from "./types.js";
import { CodexDetector } from "./codex.js";
import { ClaudeCodeDetector } from "./claude-code.js";
import { OpenClawDetector } from "./openclaw.js";

export function detectAllApps(): AppConfig[] {
  const detectors: Detector[] = [
    new CodexDetector(),
    new ClaudeCodeDetector(),
    new OpenClawDetector(),
  ];

  const apps: AppConfig[] = [];
  
  for (const detector of detectors) {
    try {
      const app = detector.detect();
      if (app) {
        apps.push(app);
      }
    } catch (error) {
      console.error(`Detection ${detector.name} failed:`, error);
    }
  }

  return apps;
}
