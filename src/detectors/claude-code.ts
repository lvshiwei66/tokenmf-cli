import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Detector, AppConfig } from "./types.js";

export class ClaudeCodeDetector implements Detector {
  name = "claude-code";

  async detect(): Promise<AppConfig | null> {
    const configDir = join(homedir(), ".claude");
    const configPath = join(configDir, "settings.json");
    
    if (!existsSync(configPath)) {
      return null;
    }

    return {
      name: "claude-code",
      path: configDir,
      configPath,
      configFormat: "json",
    };
  }
}