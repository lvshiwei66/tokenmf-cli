import { copyFile } from "node:fs/promises";
import type { Appfit } from "../appfits/types.js";
import type { UseParams } from "../types/provider.js";
import type { AppConfig } from "../detectors/types.js";

export async function applyWithBackup(
  app: AppConfig,
  appfit: Appfit,
  params: UseParams,
  label: string,
): Promise<void> {
  // Backup
  const configPaths = appfit.resolveConfigPaths(app.path);
  for (const configPath of configPaths) {
    try {
      await copyFile(configPath, configPath + ".bak");
    } catch (e: unknown) {
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT") throw e;
    }
  }

  // Apply
  try {
    await appfit.apply(app.path, params);
  } catch (error) {
    throw new Error(
      `Failed to modify ${app.name} config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Output
  const parts: string[] = [`✅ ${label}`];
  if (params.model) parts.push(`model: ${params.model}`);
  if (params.models && params.models.length > 1)
    parts.push(`fallback: [${params.models.slice(1).join(", ")}]`);
  if (params.effortLevel) parts.push(`effort: ${params.effortLevel}`);
  const envCount = params.env ? Object.keys(params.env).length : 0;
  if (envCount > 0) parts.push(`+${envCount} env var(s)`);
  parts.push("Please restart the application.");
  console.log(parts.join(". "));
}
