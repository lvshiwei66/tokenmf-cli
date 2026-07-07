import { copyFile } from "node:fs/promises";
import { detectAllApps } from "../detectors/index.js";
import {
  loadSettings,
  saveSettings,
  getProviderMemory,
  setProviderMemory,
} from "../config/index.js";
import { fetchProviderInfo } from "../providers/api.js";
import { getAppfit } from "../appfits/index.js";
import type { UseParams, ProviderDetail } from "../types/provider.js";
import type { AppConfig } from "../detectors/types.js";

async function promptHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    const wasRaw = stdin.isRaw;
    if (!wasRaw) stdin.setRawMode(true);
    stdout.write(prompt);

    let answer = "";
    const onData = (chunk: Buffer) => {
      const str = chunk.toString("utf-8");
      for (const char of str) {
        if (char === "\r" || char === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(answer.trim());
          return;
        }
        if (char === "\x7f" || char === "\b") {
          // backspace
          if (answer.length > 0) {
            answer = answer.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        if (char >= " ") {
          answer += char;
          stdout.write("*");
        }
      }
    };

    const cleanup = () => {
      stdin.removeListener("data", onData);
      if (!wasRaw) stdin.setRawMode(false);
      stdin.pause();
    };

    stdin.resume();
    stdin.on("data", onData);
  });
}

function resolveModel(
  cliModel: string | undefined,
  memoryModel: string | undefined,
  defaultModel: string,
): string | undefined {
  if (cliModel) return cliModel;
  if (memoryModel) return memoryModel;
  if (defaultModel) return defaultModel;
  return undefined;
}

export function selectApp(
  providedApp: string | undefined,
  apps: AppConfig[],
): AppConfig {
  if (providedApp) {
    const app = apps.find((a) => a.name === providedApp);
    if (!app) {
      const names = apps.map((a) => a.name).join("、");
      throw new Error(
        `Application "${providedApp}" not found. Installed apps: ${names || "none"}`,
      );
    }
    return app;
  }

  if (apps.length === 0) {
    throw new Error(
      "No installed AI applications detected. Please install Codex, Claude Code, or OpenClaw first.",
    );
  }

  if (apps.length === 1) {
    return apps[0];
  }

  const names = apps.map((a) => a.name).join("、");
  throw new Error(
    `Multiple applications detected (${names}). Use --app to specify the target application.`,
  );
}

export async function useCommand(
  provider: string,
  options: { key?: string; model?: string; models?: string[]; env?: Record<string, string>; effortLevel?: string; app?: string },
  apiUrl: string,
  clientId?: string,
): Promise<void> {
  // 1. Load settings and provider memory
  const settings = await loadSettings();
  let memory = getProviderMemory(settings, provider);

  // 2. Resolve apiKey: CLI > memory > interactive
  let apiKey = options.key ?? memory?.apiKey;
  if (!apiKey) {
    const currentHint = memory?.apiKey
      ? ` [current: ${"*".repeat(8)}]`
      : "";
    const prompt =
      `Enter API Key for ${provider}${currentHint} (input hidden): `;
    apiKey = await promptHidden(prompt);
    if (!apiKey && memory?.apiKey) {
      apiKey = memory.apiKey;
    }
  }

  if (!apiKey) {
    throw new Error("No API Key provided, operation cancelled.");
  }

  // 3. Resolve providerInfo
  let providerInfo: ProviderDetail | undefined;
  if (memory?.urls) {
    providerInfo = {
      name: provider,
      urls: memory.urls,
      defaultModel: memory.model ?? "",
      models: [],
      intro: "",
      website: "",
      updated_at: "",
    };
  } else {
    const cid = clientId ?? "unknown";
    const result = await fetchProviderInfo(apiUrl, cid, provider);
    if ("code" in result) {
      throw new Error(`Cannot get info for Provider "${provider}". ${result.message}`);
    }
    providerInfo = result;
  }

  // 4. Resolve model: --models[0] > --model > memory > provider default
  const effectiveModel = options.models?.[0] ?? options.model;
  const model = resolveModel(effectiveModel, memory?.model, providerInfo.defaultModel);

  // 5. Determine target apps
  const allApps = detectAllApps();
  const targets: AppConfig[] = options.app
    ? [selectApp(options.app, allApps)]
    : allApps;

  if (targets.length === 0) {
    throw new Error("No installed applications detected. Please install an AI application first.");
  }

  // 6. Apply to each target app
  for (const app of targets) {
    const appfit = getAppfit(app.name);
    if (!appfit) {
      console.warn(`⚠ Unsupported application: ${app.name}, skipped.`);
      continue;
    }

    const protocol = appfit.requiredProtocol() ?? "default";
    const resolvedUrl = providerInfo.urls[protocol] ?? providerInfo.urls["default"];
    if (!resolvedUrl) {
      console.warn(`⚠ Provider "${provider}" missing URL for "${protocol}" protocol, skipped ${app.name}.`);
      continue;
    }

    // Backup
    const configPaths = appfit.resolveConfigPaths(app.path);
    for (const configPath of configPaths) {
      try {
        await copyFile(configPath, configPath + ".bak");
      } catch (e: unknown) {
        const code = (e as NodeJS.ErrnoException)?.code;
        if (code !== "ENOENT") throw e;
      }
    }

    // Apply
    const params: UseParams = {
      provider,
      baseUrl: resolvedUrl,
      apiKey,
      model,
      models: options.models,
      env: options.env,
      effortLevel: options.effortLevel,
    };

    try {
      await appfit.apply(app.path, params);
    } catch (error) {
      throw new Error(
        `Failed to modify ${app.name} config: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const parts: string[] = [`✅ Switched ${app.name} to ${provider}`];
    if (model) parts.push(`model: ${model}`);
    if (options.models && options.models.length > 1) parts.push(`fallback: [${options.models.slice(1).join(", ")}]`);
    if (options.effortLevel) parts.push(`effort: ${options.effortLevel}`);
    const envCount = options.env ? Object.keys(options.env).length : 0;
    if (envCount > 0) parts.push(`+${envCount} env var(s)`);
    parts.push("Please restart the application.");
    console.log(parts.join(". "));
  }

  // 7. Update memory (shared across all apps)
  const updatedMemory = {
    apiKey,
    model: model ?? undefined,
    urls: providerInfo.urls,
  };
  setProviderMemory(settings, provider, updatedMemory);
  await saveSettings(settings);
}
