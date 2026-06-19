import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import type { Appfit } from "./types.js";
import type { UseParams } from "../types/provider.js";

export const codexAppfit: Appfit = {
  name: "codex",

  resolveConfigPaths(appPath: string): string[] {
    return [join(appPath, "config.toml"), join(appPath, "auth.json")];
  },

  async apply(appPath: string, params: UseParams): Promise<void> {
    const configPath = join(appPath, "config.toml");
    const authPath = join(appPath, "auth.json");

    // Rewrite config.toml
    const tomlRaw = await readFile(configPath, "utf-8");
    const toml = parseToml(tomlRaw) as Record<string, unknown>;

    toml.model_provider = "custom";

    if (params.model) {
      toml.model = params.model;
    }

    toml.model_providers = {
      ...((toml.model_providers as Record<string, unknown>) ?? {}),
      custom: {
        name: params.provider,
        base_url: params.baseUrl,
        api_key: params.apiKey,
      },
    };

    await writeFile(configPath, stringifyToml(toml));

    // Rewrite auth.json
    let auth: Record<string, unknown> = {};
    try {
      const authRaw = await readFile(authPath, "utf-8");
      auth = JSON.parse(authRaw) as Record<string, unknown>;
    } catch {
      // auth.json may not exist; create it
    }

    auth.OPENAI_API_KEY = params.apiKey;
    await writeFile(authPath, JSON.stringify(auth, null, 2) + "\n");
  },
};
