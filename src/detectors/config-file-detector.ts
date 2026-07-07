import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Detector, AppConfig } from "./types.js";
import { getVersion } from "../utils/version.js";
import { whichSync } from "../utils/which.js";

export interface DetectorConfig {
  name: string;
  configDirName: string;
  configFileName: string;
  configFormat: AppConfig["configFormat"];
  executableNames?: string[];
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

    // If executableNames is specified, at least one must be found in PATH.
    // This prevents detecting app installs where the config directory exists
    // but the actual executable is not available (e.g. after manual cleanup).
    if (this.#config.executableNames?.length) {
      const found = this.#config.executableNames.some(
        (name) => whichSync(name) !== null,
      );
      if (!found) {
        return null;
      }
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
