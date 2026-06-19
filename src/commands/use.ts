import { copyFile } from "node:fs/promises";
import { detectAllApps } from "../detectors/index.js";
import {
  loadSettings,
  saveSettings,
  getProviderMemory,
  setProviderMemory,
} from "../config/settings.js";
import { queryProvider } from "../providers/ask.js";
import { getAppfit } from "../appfits/index.js";
import type { UseParams, ProviderInfo } from "../types/provider.js";
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
        if (char === "\x7f") {
          // backspace
          if (answer.length > 0) {
            answer = answer.slice(0, -1);
          }
          continue;
        }
        if (char >= " ") {
          answer += char;
        }
      }
    };

    const cleanup = () => {
      stdin.removeListener("data", onData);
      if (!wasRaw) stdin.setRawMode(false);
    };

    stdin.on("data", onData);
  });
}

function resolveModel(
  cliModel: string | undefined,
  memoryModel: string | undefined,
): string | undefined {
  if (cliModel) return cliModel;
  if (memoryModel) return memoryModel;
  return undefined;
}

function selectApp(
  providedApp: string | undefined,
  apps: AppConfig[],
): AppConfig {
  if (providedApp) {
    const app = apps.find((a) => a.name === providedApp);
    if (!app) {
      const names = apps.map((a) => a.name).join("、");
      throw new Error(
        `未找到应用 "${providedApp}"。已安装的应用：${names || "无"}`,
      );
    }
    return app;
  }

  if (apps.length === 0) {
    throw new Error(
      "未检测到任何已安装的 AI 应用。请先安装 Codex、Claude Code 或 OpenClaw。",
    );
  }

  if (apps.length === 1) {
    return apps[0];
  }

  const names = apps.map((a) => a.name).join("、");
  throw new Error(
    `检测到多个应用（${names}），请使用 --app 指定目标应用。`,
  );
}

export async function useCommand(
  provider: string,
  options: { key?: string; model?: string; app?: string },
): Promise<void> {
  // 1. Load settings and provider memory
  const settings = await loadSettings();
  let memory = getProviderMemory(settings, provider);

  // 2. Resolve apiKey: CLI > memory > interactive
  let apiKey = options.key ?? memory?.apiKey;
  if (!apiKey) {
    const currentHint = memory?.apiKey
      ? ` [当前: ${"*".repeat(8)}]`
      : "";
    const prompt =
      `请输入 ${provider} 的 API Key${currentHint}（输入隐藏）：`;
    apiKey = await promptHidden(prompt);
    if (!apiKey && memory?.apiKey) {
      apiKey = memory.apiKey; // Enter pressed, keep existing
    }
  }

  if (!apiKey) {
    throw new Error("未提供 API Key，操作取消。");
  }

  // 3. Resolve providerInfo: memory has baseUrl → use it; otherwise ask API
  let providerInfo: ProviderInfo | undefined;
  if (memory?.baseUrl) {
    providerInfo = {
      name: provider,
      baseUrl: memory.baseUrl,
      defaultModel: memory.model ?? "",
      models: [],
      intro: "",
    };
  } else {
    try {
      providerInfo = await queryProvider(provider);
    } catch {
      throw new Error(`无法获取 Provider "${provider}" 的信息。`);
    }
  }

  // 4. Resolve model
  const model = resolveModel(options.model, memory?.model);

  // 5. Detect and select app
  const apps = detectAllApps();
  const app = selectApp(options.app, apps);

  // 6. Load Appfit
  const appfit = getAppfit(app.name);
  if (!appfit) {
    throw new Error(`不支持的应用：${app.name}`);
  }

  // 7. Backup config files
  const configPaths = appfit.resolveConfigPaths(app.path);
  console.log("⏳ 正在备份设置...");
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
    baseUrl: providerInfo.baseUrl,
    apiKey,
    model,
  };

  try {
    await appfit.apply(app.path, params);
  } catch (error) {
    throw new Error(
      `修改 ${app.name} 配置失败：${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // 9. Update memory
  const updatedMemory = {
    apiKey,
    model: model ?? undefined,
    baseUrl: providerInfo.baseUrl,
  };
  setProviderMemory(settings, provider, updatedMemory);
  await saveSettings(settings);

  // 10. Success
  const modelNote = model ? `，模型：${model}` : "";
  console.log(
    `✅ 已将 ${app.name} 切换至 ${provider}${modelNote}。请重启应用以生效。`,
  );
}
