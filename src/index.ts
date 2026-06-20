#!/usr/bin/env node
import { Command } from "commander";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setup } from "./commands/setup.js";
import { listAction } from "./commands/list.js";
import { askAction } from "./commands/ask.js";
import { getConfig, getApiUrl, CONFIG_PATH } from "./config.js";
import { useCommand } from "./commands/use.js";
import { rollbackCommand } from "./commands/rollback.js";
import { loadSettings } from "./config/settings.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("tmf")
    .description("Token魔方 — 管理和切换本地 AI 应用的第三方 LLM 提供商")
    .version("0.1.0")
    .option("-d, --debug", "输出调试信息");

  // ── use ─────────────────────────────────────────────────────
  program
    .command("use <provider>")
    .description("切换指定 AI 应用的提供商和模型")
    .option("-k, --key <api-key>", "API Key")
    .option("-m, --model <model>", "模型名称")
    .option("-a, --app <app>", "目标应用（codex、claude-code、openclaw）")
    .action(async (provider, options) => {
      try {
        const config = await getConfig(CONFIG_PATH);
        const apiUrl = getApiUrl(config);
        const settings = await loadSettings();
        const clientId = settings.clientId;
        await useCommand(provider, options, apiUrl, clientId);
      } catch (error) {
        console.error(
          "❌ 错误:",
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  // ── list ────────────────────────────────────────────────────
  program
    .command("list")
    .description("浏览供应商清单")
    .option("-a, --all", "展示所有供应商")
    .action(async (options) => {
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

  // ── ask ─────────────────────────────────────────────────────
  program
    .command("ask <provider>")
    .description("查询供应商详情")
    .action(async (provider) => {
      const debug = program.opts().debug === true;
      // Auto-run setup if config is missing
      let config = await getConfig(CONFIG_PATH);
      if (!config) {
        console.log("🔧 未检测到配置，正在自动运行 setup...\n");
        await setup();
        config = await getConfig(CONFIG_PATH);
      }
      await askAction(
        provider,
        {
          getConfig: () => Promise.resolve(config),
          getApiUrl,
        },
        { debug },
      );
    });

  // ── rollback ────────────────────────────────────────────────
  program
    .command("rollback")
    .description("从备份恢复应用配置")
    .option("-a, --app <app>", "目标应用（codex、claude-code、openclaw）")
    .action(async (options) => {
      try {
        await rollbackCommand({ app: options.app });
      } catch (error) {
        console.error(
          "错误:",
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  return program;
}

// Direct execution (not imported as a module)
const scriptPath = process.argv[1];
const modulePath = fileURLToPath(import.meta.url);
if (scriptPath && realpathSync(scriptPath) === realpathSync(modulePath)) {
  const program = createProgram();
  program.parse();
}
