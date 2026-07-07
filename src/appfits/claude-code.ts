import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Appfit } from "./types.js";
import type { UseParams } from "../types/provider.js";

/**
 * Env vars managed by tmf for Claude Code. These are always set/cleared
 * by the appfit. Any other env vars in the user's settings.json are preserved.
 */
const MANAGED_ENV_KEYS = new Set([
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
]);

interface ClaudeCodeSettings {
  model?: string;
  fallbackModel?: string[];
  effortLevel?: string;
  env?: Record<string, string>;
  [key: string]: unknown;
}

export const claudeCodeAppfit: Appfit = {
  name: "claude-code",

  resolveConfigPaths(appPath: string): string[] {
    return [join(appPath, "settings.json")];
  },

  requiredProtocol(): "openai" | "anthropic" | undefined {
    return "anthropic";
  },

  async apply(appPath: string, params: UseParams): Promise<void> {
    const configPath = join(appPath, "settings.json");
    const raw = await readFile(configPath, "utf-8");
    const settings = JSON.parse(raw) as ClaudeCodeSettings;

    // Ensure env block exists and preserve non-managed keys
    if (!settings.env) {
      settings.env = {};
    }

    // Set core managed env vars
    settings.env.ANTHROPIC_AUTH_TOKEN = params.apiKey;
    settings.env.ANTHROPIC_BASE_URL = params.baseUrl;

    // Resolve model(s): models[] takes priority over model
    const primaryModel = params.models?.[0] ?? params.model;
    const fallbackModels = params.models
      ? params.models.slice(1)
      : undefined;

    if (primaryModel) {
      settings.env.ANTHROPIC_MODEL = primaryModel;
    } else {
      // If neither model nor models is provided, remove managed model key
      // so that existing config is not overwritten with undefined
      delete settings.env.ANTHROPIC_MODEL;
    }

    // Top-level model field (lower priority than env ANTHROPIC_MODEL,
    // but set for consistency and as fallback)
    if (primaryModel) {
      settings.model = primaryModel;
    }

    // Fallback model chain
    if (fallbackModels && fallbackModels.length > 0) {
      settings.fallbackModel = fallbackModels;
    } else if (params.models && params.models.length === 1) {
      // Only one model provided, no fallback chain
      delete settings.fallbackModel;
    }
    // If --models not used at all, preserve existing fallbackModel

    // Effort level
    if (params.effortLevel) {
      settings.effortLevel = params.effortLevel;
    }

    // Role-based model assignments (ANTHROPIC_DEFAULT_HAIKU/SONNET/OPUS_MODEL)
    // Set from roleModels, clear if not provided
    if (params.roleModels) {
      if (params.roleModels.haiku) {
        settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = params.roleModels.haiku;
      } else {
        delete settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
      }
      if (params.roleModels.sonnet) {
        settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL = params.roleModels.sonnet;
      } else {
        delete settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
      }
      if (params.roleModels.opus) {
        settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL = params.roleModels.opus;
      } else {
        delete settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL;
      }
    }

    // Merge custom env vars (e.g. --env:ANTHROPIC_DEFAULT_SONNET_MODEL=xxx)
    if (params.env) {
      for (const [key, value] of Object.entries(params.env)) {
        settings.env[key] = value;
      }
    }

    // Clean up erroneously-written top-level keys from prior buggy Appfit runs
    delete settings.provider;
    delete settings.apiKey;
    delete settings.baseUrl;

    await writeFile(configPath, JSON.stringify(settings, null, 2) + "\n");
  },
};
