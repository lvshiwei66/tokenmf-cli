import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Detector, AppConfig } from "./types.js";

export class OpenClawDetector implements Detector {
  name = "openclaw";

  async detect(): Promise<AppConfig | null> {
    const configDir = join(homedir(), ".openclaw");
    const configPath = join(configDir, "config.yaml");
    
    if (!existsSync(configPath)) {
      return null;
    }

    return {
      name: "openclaw",
      path: configDir,
      configPath,
      configFormat: "yaml",
    };
  }
}