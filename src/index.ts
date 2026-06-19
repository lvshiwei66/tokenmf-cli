#!/usr/bin/env node
import { Command } from "commander";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setup } from "./commands/setup.js";
import { listAction } from "./commands/list.js";
import { getConfig, getApiUrl, CONFIG_PATH } from "./config.js";
import { useCommand } from "./commands/use.js";

export function createProgram() {
  const program = new Command();

  program
    .name("tmf")
    .description("Token魔方 — 管理和切换本地 AI 应用的第三方 LLM 提供商")
    .version("0.1.0")
    .option("-d, --debug", "输出调试信息");

  program
    .command("use <provider>")
    .description("切换指定 AI 应用的提供商和模型")
    .option("-k, --key <api-key>", "API Key")
    .option("-m, --model <model>", "模型名称")
    .option("-a, --app <app>", "目标应用（codex、claude-code、openclaw）")
    .action(
      async (
        provider: string,
        options: { key?: string; model?: string; app?: string },
      ) => {
        try {
          await useCommand(provider, options);
        } catch (error) {
          console.error(
            "❌ 错误:",
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      },
    );

  program
    .command("list")
    .description("浏览供应商清单")
    .option("-a, --all", "展示所有供应商")
    .action(async (options: { all?: boolean }) => {
      const debug = program.opts().debug === true;

      // Auto-run setup if config is missing
      let config = await getConfig(CONFIG_PATH);
      if (!config) {
        console.log("🔧 未检测到配置，正在自动运行 setup...\n");
        await setup();
        config = await getConfig(CONFIG_PATH);
      }

      await listAction(
        {
          getConfig: () => Promise.resolve(config),
          getApiUrl,
        },
        { all: options.all === true, debug },
      );
    });

  return program;
}

const scriptPath = process.argv[1];
const modulePath = fileURLToPath(import.meta.url);

if (scriptPath && realpathSync(scriptPath) === realpathSync(modulePath)) {
  const program = createProgram();
  program.parse();
}
