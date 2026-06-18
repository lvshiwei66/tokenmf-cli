import type { AppConfig } from "./types.js";
import { CodexDetector } from "./codex.js";
import { ClaudeCodeDetector } from "./claude-code.js";
import { OpenClawDetector } from "./openclaw.js";

export interface Detector {
  name: string;
  detect(): Promise<AppConfig | null>;
}

export async function detectAllApps(): Promise<AppConfig[]> {
  const detectors: Detector[] = [
    new CodexDetector(),
    new ClaudeCodeDetector(),
    new OpenClawDetector(),
  ];

  const apps: AppConfig[] = [];
  
  for (const detector of detectors) {
    try {
      const app = await detector.detect();
      if (app) {
        apps.push(app);
      }
    } catch (error) {
      console.error(`Failed to detect ${detector.name}:`, error);
    }
  }

  return apps;
}