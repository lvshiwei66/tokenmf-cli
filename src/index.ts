#!/usr/bin/env node
import { Command } from "commander";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { setup } from "./commands/setup.js";
import { listAction } from "./commands/list.js";
import { getConfig, getApiUrl, CONFIG_PATH } from "./config.js";

export function createProgram() {
  const program = new Command();

  program
    .name("tmf")
    .description("Token魔方 — 管理和切换本地 AI 应用的第三方 LLM 提供商")
    .version("0.1.0")
    .option("-d, --debug", "输出调试信息");

  program
    .command("setup")
    .description("扫描已安装的 AI 应用并生成检测报告")
    .action(async () => {
      try {
        await setup();
      } catch (error) {
        console.error("❌ Setup 失败:", error);
        process.exit(1);
      }
    });

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
