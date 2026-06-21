import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Detector, AppConfig } from "./types.js";
import { getVersion } from "../utils/version.js";

export interface DetectorConfig {
  name: string;
  configDirName: string;
  configFileName: string;
  configFormat: AppConfig["configFormat"];
}

export class ConfigFileDetector implements Detector {
  name: string;
  #config: DetectorConfig;

  constructor(config: DetectorConfig) {
    this.name = config.name;
    this.#config = config;
  }

  detect(): AppConfig | null {
    const configDir = join(homedir(), this.#config.configDirName);
    const configPath = join(configDir, this.#config.configFileName);

    if (!existsSync(configPath)) {
      return null;
    }

    const version = getVersion(configDir);

    return {
      name: this.#config.name,
      version,
      path: configDir,
      configPath,
      configFormat: this.#config.configFormat,
    };
  }
}
