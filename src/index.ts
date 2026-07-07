#!/usr/bin/env node
import { Command } from "commander";
import { realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getVersion } from "./utils/version.js";
import { setup } from "./commands/setup.js";
import { listAction } from "./commands/list.js";
import { askAction } from "./commands/ask.js";
import { useCommand } from "./commands/use.js";
import { rollbackCommand } from "./commands/rollback.js";
import { registerTestCommand } from "./commands/test.js";
import { getConfig, getApiUrl, CONFIG_PATH, loadSettings } from "./config/index.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export function createProgram(): Command {
  const program = new Command();

  program
    .name("tmf")
    .description("tokenmf – Spin up any LLM provider in one CLI command.")
    .version(`${getVersion(join(__dirname, "..")) ?? "0.0.0"}\n${getApiUrl(null)}`)
    .option("-d, --debug", "Output debug information");
  // ── use ─────────────────────────────────────────────────────
  program
    .command("use <provider>")
    .description("Switch provider and model for the specified AI application")
    .option("-k, --key <api-key>", "API Key")
    .option("-m, --model <model>", "Model name (single model)")
    .option("--models <models...>", "Multiple models (first is primary, rest are fallback chain)")
    .option("--env <env...>", "Custom env vars to set (KEY=VALUE format)")
    .option("--effort <level>", "Effort level: low, medium, high, xhigh")
    .option("-a, --app <app>", "Target application (codex, claude-code, openclaw)")
    .action(async (provider, options) => {
      try {
        // Auto-run setup if config is missing（首次运行时自动初始化）
        let config = await getConfig(CONFIG_PATH);
        if (!config) {
          console.log("Setting up...\n");
          await setup();
          config = await getConfig(CONFIG_PATH);
        }
        const apiUrl = getApiUrl(config);
        const settings = await loadSettings();
        const clientId = config?.fingerprint;
        // Parse --env KEY=VALUE into a Record
        const envRecord: Record<string, string> = {};
        if (options.env) {
          for (const entry of options.env as string[]) {
            const eqIdx = entry.indexOf("=");
            if (eqIdx > 0) {
              envRecord[entry.slice(0, eqIdx).trim()] = entry.slice(eqIdx + 1).trim();
            } else {
              console.warn(`⚠ Ignoring malformed --env entry: "${entry}" (expected KEY=VALUE)`);
            }
          }
        }
        await useCommand(provider, {
          key: options.key,
          model: options.model,
          models: options.models,
          env: Object.keys(envRecord).length > 0 ? envRecord : undefined,
          effortLevel: options.effort,
          app: options.app,
        }, apiUrl, clientId);
      } catch (error) {
        console.error(
          "❌ Error:",
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  // ── list ────────────────────────────────────────────────────
  program
    .command("list")
    .description("Browse provider list")
    .option("-a, --all", "Show all providers")
    .action(async (options) => {
      const debug = program.opts().debug === true;
      // Auto-run setup if config is missing
      let config = await getConfig(CONFIG_PATH);
      if (!config) {
        console.log("Setting up...\n");
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
    .description("Query provider details")
    .action(async (provider) => {
      const debug = program.opts().debug === true;
      // Auto-run setup if config is missing
      let config = await getConfig(CONFIG_PATH);
      if (!config) {
        console.log("Setting up...\n");
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
    .description("Restore application config from backup")
    .option("-a, --app <app>", "Target application (codex, claude-code, openclaw)")
    .action(async (options) => {
      try {
        await rollbackCommand({ app: options.app });
      } catch (error) {
        console.error(
          "Error:",
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });
  // ── test ─────────────────────────────────────────────────────
  registerTestCommand(program);


  return program;
}

// Direct execution (not imported as a module)
const scriptPath = process.argv[1];
const modulePath = fileURLToPath(import.meta.url);
if (scriptPath && realpathSync(scriptPath) === realpathSync(modulePath)) {
  const program = createProgram();
  program.parse();
}
