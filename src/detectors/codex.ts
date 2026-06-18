import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Detector, AppConfig } from "./types.js";

export class CodexDetector implements Detector {
  name = "codex";

  async detect(): Promise<AppConfig | null> {
    const configDir = join(homedir(), ".codex");
    const configPath = join(configDir, "config.toml");
    
    if (!existsSync(configPath)) {
      return null;
    }

    return {
      name: "codex",
      path: configDir,
      configPath,
      configFormat: "toml",
    };
  }
}