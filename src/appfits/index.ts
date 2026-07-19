import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Appfit } from "./types.js";
import type { UseParams } from "../types/provider.js";
import { codexAppfit } from "./codex.js";
import { claudeCodeAppfit } from "./claude-code.js";
import { openclawAppfit } from "./openclaw.js";

const registry: Record<string, Appfit> = {
  codex: codexAppfit,
  "claude-code": claudeCodeAppfit,
  openclaw: openclawAppfit,
  opencode: createJsonAppfit("opencode"),
  hermes: createJsonAppfit("hermes"),
  pi: createJsonAppfit("pi"),
};

/** Aliases that map to the canonical app name. */
const ALIASES: Record<string, string> = {
  codex: "codex",
  claude: "claude-code",
  cc: "claude-code",
  "claude-code": "claude-code",
  openclaw: "openclaw",
  opencode: "opencode",
  hermes: "hermes",
  pi: "pi",
};

/** Resolve an alias or canonical name to the canonical app name. */
export function resolveAppName(raw: string): string | undefined {
  return ALIASES[raw.toLowerCase()];
}

export function getAppfit(name: string): Appfit | undefined {
  const canonical = resolveAppName(name);
  return canonical ? registry[canonical] : undefined;
}

/** List all supported app names with aliases for display. */
export function getSupportedAppNames(): string {
  const names = Object.keys(ALIASES)
    .filter((k) => k === ALIASES[k]) // canonical names only
    .map((k) => {
      const aliases = Object.entries(ALIASES)
        .filter(([a, c]) => c === k && a !== k)
        .map(([a]) => a);
      return aliases.length > 0 ? `${k} (${aliases.join(", ")})` : k;
    });
  return names.join(", ");
}

/**
 * Create a standard JSON-config Appfit for OpenAI-compatible apps.
 * The config file is `{appPath}/config.json` with these keys:
 * provider, api_key, base_url, model, models[], model_reasoning_effort.
 */
function createJsonAppfit(name: string): Appfit {
  return {
    name,

    resolveConfigPaths(appPath: string): string[] {
      return [join(appPath, "config.json")];
    },

    requiredProtocol(): "openai" | "anthropic" | undefined {
      return "openai";
    },

    async apply(appPath: string, params: UseParams): Promise<void> {
      const configPath = join(appPath, "config.json");
      const raw = await readFile(configPath, "utf-8");
      const config = JSON.parse(raw) as Record<string, unknown>;

      config.provider = params.provider;
      config.api_key = params.apiKey;
      config.base_url = params.baseUrl;

      const primaryModel = params.models?.[0] ?? params.model;
      if (primaryModel) {
        config.model = primaryModel;
      }

      if (params.models && params.models.length > 0) {
        config.models = params.models;
      }

      if (params.effortLevel) {
        config.model_reasoning_effort = params.effortLevel;
      }

      await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
    },
  };
}
