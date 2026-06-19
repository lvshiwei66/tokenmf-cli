import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export { getFingerprint } from "./utils/fingerprint.js";

export interface CliConfig {
  fingerprint: string;
  apiUrl?: string;
}

const DEFAULT_API_URL = "https://api.tokenmofang.com";

export const CONFIG_DIR = join(homedir(), ".tokenmofang");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

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
