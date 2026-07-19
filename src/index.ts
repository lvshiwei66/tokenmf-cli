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
import { setCommand } from "./commands/set.js";
import { saveCommand } from "./commands/save.js";
import { wrapCommand } from "./commands/wrap-command.js";
import { getConfig, getApiUrl, CONFIG_PATH, loadSettings } from "./config/index.js";

import { parseModels } from "./utils/parse-models.js";
import { parseEnv } from "./utils/parse-env.js";

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
    .option("-a, --app <app>", "Target application: codex, claude-code (claude, cc), openclaw, opencode, hermes, pi")
.action(wrapCommand(async (provider, options) => {
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
        const envRecord = parseEnv((options.env as string[]) ?? []);

        // Parse --models: support both positional and key=value formats
        const parsedModels = parseModels((options.models as string[]) ?? []);

        await useCommand(provider, {
          key: options.key,
          model: options.model,
          models: parsedModels.models,
          roleModels: parsedModels.roleModels,
          env: Object.keys(envRecord).length > 0 ? envRecord : undefined,
          effortLevel: options.effort,
          app: options.app,
        }, apiUrl, clientId);
    }));

  // ── set ─────────────────────────────────────────────────────
  program
    .command("set <app>")
    .description("Directly configure an AI application with custom parameters")
    .option("--baseUrl <url>", "Base URL for the API endpoint")
    .option("-k, --key <api-key>", "API Key")
    .option("-m, --model <model>", "Model name (single model)")
    .option("--models <models...>", "Multiple models: opus=X,sonnet=Y,haiku=Z or positional")
    .option("--env <env...>", "Custom env vars to set (KEY=VALUE format)")
    .option("--effort <level>", "Effort level: low, medium, high, xhigh")
    .option("--save-as <name>", "Save parameters as a reusable template")
.action(wrapCommand(async (app, options) => {
        const envRecord = parseEnv((options.env as string[]) ?? []);

        // Parse --models
        const parsedModels = parseModels((options.models as string[]) ?? []);

        await setCommand(app, {
          baseUrl: options.baseUrl,
          key: options.key,
          model: options.model,
          models: parsedModels.models,
          roleModels: parsedModels.roleModels,
          env: Object.keys(envRecord).length > 0 ? envRecord : undefined,
          effort: options.effort,
          saveAs: options.saveAs,
        });
    }));

  // ── save ─────────────────────────────────────────────────────
  program
    .command("save <name>")
    .description("Save a parameter template for later reuse")
    .option("--app <app>", "Target application")
    .option("--baseUrl <url>", "Base URL for the API endpoint")
    .option("-k, --key <api-key>", "API Key")
    .option("-m, --model <model>", "Model name (single model)")
    .option("--models <models...>", "Multiple models: opus=X,sonnet=Y,haiku=Z or positional")
    .option("--env <env...>", "Custom env vars to set (KEY=VALUE format)")
    .option("--effort <level>", "Effort level: low, medium, high, xhigh")
.action(wrapCommand(async (name, options) => {
        const envRecord = parseEnv((options.env as string[]) ?? []);

        // Parse --models
        const parsedModels = parseModels((options.models as string[]) ?? []);

        await saveCommand(name, {
          app: options.app,
          baseUrl: options.baseUrl,
          key: options.key,
          model: options.model,
          models: parsedModels.models,
          roleModels: parsedModels.roleModels,
          env: Object.keys(envRecord).length > 0 ? envRecord : undefined,
          effort: options.effort,
        });
    }));


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
    .option("-a, --app <app>", "Target application: codex, claude-code (aliases: claude, cc), openclaw")
.action(wrapCommand(async (options) => {
        await rollbackCommand({ app: options.app });
    }));
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
