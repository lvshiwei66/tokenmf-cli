import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

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

export { CONFIG_DIR, CONFIG_PATH };

// ── Config I/O ───────────────────────────────────────────────

const DEFAULT_API_URL = "https://api.tokenmofang.com";

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
