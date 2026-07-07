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
  fallbacks?: string[];
  model_reasoning_effort?: string;
  [key: string]: unknown;
}

export const openclawAppfit: Appfit = {
  name: "openclaw",

  resolveConfigPaths(appPath: string): string[] {
    return [join(appPath, "config.yaml")];
  },

  requiredProtocol(): "openai" | "anthropic" | undefined {
    return undefined;
  },

  async apply(appPath: string, params: UseParams): Promise<void> {
    const configPath = join(appPath, "config.yaml");
    const raw = await readFile(configPath, "utf-8");
    const config = parseYaml(raw) as OpenClawConfig;

    config.provider = params.provider;
    config.base_url = params.baseUrl;
    config.api_key = params.apiKey;

    // Model: --models[0] > --model
    const primaryModel = params.models?.[0] ?? params.model;
    if (primaryModel) {
      config.model = primaryModel;
    }

    // Fallback models (remaining from --models array)
    if (params.models && params.models.length > 1) {
      config.fallbacks = params.models.slice(1);
    } else if (params.models && params.models.length === 1) {
      // Only one model, clear any stale fallbacks
      delete config.fallbacks;
    }

    // Effort level
    if (params.effortLevel) {
      config.model_reasoning_effort = params.effortLevel;
    }

    // Merge custom env vars as dotted-path YAML keys
    if (params.env) {
      for (const [key, value] of Object.entries(params.env)) {
        setNestedYaml(config, key, parseYamlValue(value));
      }
    }

    await writeFile(configPath, stringifyYaml(config));
  },
};

/**
 * Set a nested value in a plain object using dotted key notation.
 */
function setNestedYaml(
  obj: Record<string, unknown>,
  dottedKey: string,
  value: unknown,
): void {
  const parts = dottedKey.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!current[key] || typeof current[key] !== "object" || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Parse a value string: booleans, integers, floats, or raw string.
 */
function parseYamlValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  // Try YAML parse for complex values (arrays, objects)
  try {
    return parseYaml(trimmed);
  } catch {
    return raw;
  }
}
