import {
  loadTemplates,
  saveTemplates,
  setTemplate,
} from "../config/index.js";
import type { Template, RoleModels } from "../types/provider.js";

export interface SaveOptions {
  app?: string;
  baseUrl?: string;
  key?: string;
  model?: string;
  models?: string[];
  roleModels?: RoleModels;
  env?: Record<string, string>;
  effort?: string;
}

export async function saveCommand(
  name: string,
  options: SaveOptions,
): Promise<void> {
  if (!options.baseUrl) {
    throw new Error("--baseUrl is required.");
  }
  if (!options.key) {
    throw new Error("--key (API Key) is required.");
  }

  const template: Template = {
    name,
    app: options.app,
    baseUrl: options.baseUrl,
    apiKey: options.key,
    model: options.model,
    models: options.models,
    roleModels: options.roleModels,
    env: options.env,
    effortLevel: options.effort,
  };

  const store = await loadTemplates();
  setTemplate(store, template);
  await saveTemplates(store);

  console.log(`📋 Template "${name}" saved successfully.`);
  if (options.app) {
    console.log(`   Target app: ${options.app}`);
  }
  if (options.model) {
    console.log(`   Model: ${options.model}`);
  }
  if (options.baseUrl) {
    console.log(`   Base URL: ${options.baseUrl}`);
  }
}
