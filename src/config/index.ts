import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { Template } from "../types/provider.js";


export { getFingerprint, getClientId } from "../utils/fingerprint.js";

// ── Config types ─────────────────────────────────────────────

export interface CliConfig {
  fingerprint: string;
  apiUrl?: string;
}

export interface ConfigProvider {
  getConfig: () => Promise<CliConfig | null>;
  getApiUrl: (config: CliConfig | null) => string;
}

// ── Settings types ───────────────────────────────────────────

export interface ProviderMemory {
  apiKey: string;
  model?: string;
  urls: Record<string, string>;
}

export interface Settings {
  clientId?: string;
  providers: Record<string, ProviderMemory>;
}

// ── Paths ────────────────────────────────────────────────────

const CONFIG_DIR = join(homedir(), ".tmf");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const SETTINGS_PATH = join(CONFIG_DIR, "store", "used.json");

const TEMPLATES_PATH = join(CONFIG_DIR, "templates.json");

export { CONFIG_DIR, CONFIG_PATH, TEMPLATES_PATH };

// ── Config I/O ───────────────────────────────────────────────

const DEFAULT_API_URL = "https://tokenmf.com";

export async function saveConfig(
  filePath: string,
  config: CliConfig,
): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(config, null, 2), "utf-8");
}

export async function getConfig(
  filePath: string,
): Promise<CliConfig | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as CliConfig;
  } catch {
    return null;
  }
}

/**
 * Resolve the API base URL using priority:
 * 1. TMF_API_URL environment variable
 * 2. apiUrl field in config file
 * 3. Hardcoded default
 */
export function getApiUrl(config: CliConfig | null): string {
  const envUrl = process.env["TMF_API_URL"];
  if (envUrl) return envUrl;
  if (config?.apiUrl) return config.apiUrl;
  return DEFAULT_API_URL;
}

// ── Settings I/O ─────────────────────────────────────────────

function createDefaultSettings(): Settings {
  return { providers: {} };
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      clientId: parsed.clientId,
      providers: parsed.providers ?? {},
    };
  } catch {
    return createDefaultSettings();
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await mkdir(join(CONFIG_DIR, "store"), { recursive: true });
  const tmpPath = SETTINGS_PATH + ".tmp";
  await writeFile(tmpPath, JSON.stringify(settings, null, 2));
  await rename(tmpPath, SETTINGS_PATH);
}

export function getProviderMemory(
  settings: Settings,
  providerName: string,
): ProviderMemory | undefined {
  return settings.providers[providerName];
}

export function setProviderMemory(
  settings: Settings,
  providerName: string,
  memory: ProviderMemory,
): void {
  settings.providers[providerName] = memory;
}

// ── Template I/O ──────────────────────────────────────────────

export interface TemplateStore {
  templates: Record<string, Template>;
}

export async function loadTemplates(): Promise<TemplateStore> {
  try {
    const raw = await readFile(TEMPLATES_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<TemplateStore>;
    return { templates: parsed.templates ?? {} };
  } catch {
    return { templates: {} };
  }
}

export async function saveTemplates(store: TemplateStore): Promise<void> {
  await mkdir(dirname(TEMPLATES_PATH), { recursive: true });
  const tmpPath = TEMPLATES_PATH + ".tmp";
  await writeFile(tmpPath, JSON.stringify(store, null, 2));
  await rename(tmpPath, TEMPLATES_PATH);
}

export function getTemplate(
  store: TemplateStore,
  name: string,
): Template | undefined {
  return store.templates[name];
}

export function setTemplate(
  store: TemplateStore,
  template: Template,
): void {
  store.templates[template.name] = template;
}

export function deleteTemplate(store: TemplateStore, name: string): boolean {
  if (store.templates[name]) {
    delete store.templates[name];
    return true;
  }
  return false;
}
