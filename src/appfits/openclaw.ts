import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { Appfit } from "./types.js";
import type { UseParams } from "../types/provider.js";

interface OpenClawConfig {
  provider?: string;
  model?: string;
  api_key?: string;
  base_url?: string;
  [key: string]: unknown;
}

export const openclawAppfit: Appfit = {
  name: "openclaw",

  resolveConfigPaths(appPath: string): string[] {
    return [join(appPath, "config.yaml")];
  },

  async apply(appPath: string, params: UseParams): Promise<void> {
    const configPath = join(appPath, "config.yaml");
    const raw = await readFile(configPath, "utf-8");
    const config = parseYaml(raw) as OpenClawConfig;

    config.provider = params.provider;
    config.base_url = params.baseUrl;
    config.api_key = params.apiKey;

    if (params.model) {
      config.model = params.model;
    }

    await writeFile(configPath, stringifyYaml(config));
  },
};
