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
    .description("TokenMofang – Spin up any LLM provider in one CLI command.")
    .version("0.1.0")
    .option("-d, --debug", "Output debug information");

  // ── use ─────────────────────────────────────────────────────
  program
    .command("use <provider>")
    .description("Switch provider and model for the specified AI application")
    .option("-k, --key <api-key>", "API Key")
    .option("-m, --model <model>", "Model name")
    .option("-a, --app <app>", "Target application (codex, claude-code, openclaw)")
    .action(async (provider, options) => {
      try {
        const config = await getConfig(CONFIG_PATH);
        const apiUrl = getApiUrl(config);
        const settings = await loadSettings();
        const clientId = settings.clientId;
        await useCommand(provider, options, apiUrl, clientId);
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
        console.log("🔧 No config detected, auto-running setup...\n");
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
        console.log("🔧 No config detected, auto-running setup...\n");
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

  return program;
}

// Direct execution (not imported as a module)
const scriptPath = process.argv[1];
const modulePath = fileURLToPath(import.meta.url);
if (scriptPath && realpathSync(scriptPath) === realpathSync(modulePath)) {
  const program = createProgram();
  program.parse();
}
