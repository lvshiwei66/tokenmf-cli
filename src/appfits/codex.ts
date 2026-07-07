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

  requiredProtocol(): "openai" | "anthropic" | undefined {
    return "openai";
  },

  async apply(appPath: string, params: UseParams): Promise<void> {
    const configPath = join(appPath, "config.toml");
    const authPath = join(appPath, "auth.json");

    // Rewrite config.toml
    const tomlRaw = await readFile(configPath, "utf-8");
    const toml = parseToml(tomlRaw) as Record<string, unknown>;

    toml.model_provider = "custom";

    // Model: --models[0] > --model (Codex has no fallback chain)
    const primaryModel = params.models?.[0] ?? params.model;
    if (primaryModel) {
      toml.model = primaryModel;
    }

    toml.model_providers = {
      ...((toml.model_providers as Record<string, unknown>) ?? {}),
      custom: {
        name: params.provider,
        base_url: params.baseUrl,
        api_key: params.apiKey,
      },
    };

    // Effort level
    if (params.effortLevel) {
      toml.model_reasoning_effort = params.effortLevel;
    }

    // Merge custom env vars as top-level TOML keys (supports dotted paths)
    // e.g. --env features.browser_use=true sets toml.features.browser_use
    if (params.env) {
      for (const [key, value] of Object.entries(params.env)) {
        setNestedToml(toml, key, value);
      }
    }

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

/**
 * Set a nested value in a plain object using dotted key notation.
 * Keys that look like TOML values (booleans, numbers) are parsed;
 * otherwise the raw string is used.
 *
 * Example: setNestedToml(obj, "features.browser_use", "true")
 *   → obj.features = { browser_use: true }
 */
function setNestedToml(obj: Record<string, unknown>, dottedKey: string, rawValue: string): void {
  const parts = dottedKey.split(".");
  const parsed = parseTomlValue(rawValue);

  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!current[key] || typeof current[key] !== "object" || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = parsed;
}

/**
 * Parse a value string as TOML. On failure, return the raw string.
 * Supports: true/false, integers, floats, quoted strings, inline tables.
 */
function parseTomlValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  // Try smol-toml for complex values (arrays, inline tables)
  try {
    const parsed = parseToml(`_ = ${trimmed}`);
    return (parsed as Record<string, unknown>)._;
  } catch {
    return raw;
  }
}
