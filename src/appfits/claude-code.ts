import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Appfit } from "./types.js";
import type { UseParams } from "../types/provider.js";

interface ClaudeCodeSettings {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  [key: string]: unknown;
}

export const claudeCodeAppfit: Appfit = {
  name: "claude-code",

  resolveConfigPaths(appPath: string): string[] {
    return [join(appPath, "settings.json")];
  },

  async apply(appPath: string, params: UseParams): Promise<void> {
    const configPath = join(appPath, "settings.json");
    const raw = await readFile(configPath, "utf-8");
    const settings = JSON.parse(raw) as ClaudeCodeSettings;

    settings.provider = params.provider;
    settings.baseUrl = params.baseUrl;
    settings.apiKey = params.apiKey;

    if (params.model) {
      settings.model = params.model;
    }

    await writeFile(configPath, JSON.stringify(settings, null, 2) + "\n");
  },
};
