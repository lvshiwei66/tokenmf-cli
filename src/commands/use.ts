import { copyFile } from "node:fs/promises";
import { detectAllApps } from "../detectors/index.js";
import {
  loadSettings,
  saveSettings,
  getProviderMemory,
  setProviderMemory,
} from "../config/settings.js";
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
  options: { key?: string; model?: string; app?: string },
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
      apiKey = memory.apiKey; // Enter pressed, keep existing
    }
  }

  if (!apiKey) {
    throw new Error("No API Key provided, operation cancelled.");
  }

  // 3. Resolve providerInfo: memory has urls → use it; otherwise ask API
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

  // 4. Resolve model
  const model = resolveModel(options.model, memory?.model, providerInfo.defaultModel);

  // 5. Detect and select app
  const apps = detectAllApps();
  const app = selectApp(options.app, apps);

  // 6. Load Appfit
  const appfit = getAppfit(app.name);
  if (!appfit) {
    throw new Error(`Unsupported application: ${app.name}`);
  }


  // 6.5 Resolve URL from urls map
  const protocol = appfit.requiredProtocol() ?? "default";
  const resolvedUrl = providerInfo.urls[protocol] ?? providerInfo.urls["default"];
  if (!resolvedUrl) {
    throw new Error(`Provider "${provider}" missing URL for "${protocol}" protocol.`);
  }

  // 7. Backup config files
  const configPaths = appfit.resolveConfigPaths(app.path);
  console.log("⏳ Backing up settings...");
  for (const configPath of configPaths) {
    try {
      await copyFile(configPath, configPath + ".bak");
    } catch {
      // File may not exist (e.g., auth.json for Codex); skip
    }
  }

  // 8. Apply
  const params: UseParams = {
    provider,
    baseUrl: resolvedUrl,
    apiKey,
    model,
  };

  try {
    await appfit.apply(app.path, params);
  } catch (error) {
    throw new Error(
      `Failed to modify ${app.name} config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // 9. Update memory
  const updatedMemory = {
    apiKey,
    model: model ?? undefined,
    urls: providerInfo.urls,
  };
  setProviderMemory(settings, provider, updatedMemory);
  await saveSettings(settings);

  // 10. Success
  const modelNote = model ? `, model: ${model}` : "";
  console.log(
    `✅ Switched ${app.name} to ${provider}${modelNote}. Please restart the application.`,
  );
}
