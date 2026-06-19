import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ProviderMemory {
  apiKey: string;
  model?: string;
  baseUrl: string;
}

export interface Settings {
  clientId?: string;
  providers: Record<string, ProviderMemory>;
}

const CONFIG_DIR = join(homedir(), ".tokenmofang");
const SETTINGS_PATH = join(CONFIG_DIR, "settings.json");

const DEFAULT_SETTINGS: Settings = {
  providers: {},
};

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      clientId: parsed.clientId,
      providers: parsed.providers ?? {},
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
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
