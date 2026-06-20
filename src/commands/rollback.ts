import { copyFile, unlink, access } from "node:fs/promises";
import { detectAllApps } from "../detectors/index.js";
import { getAppfit } from "../appfits/index.js";
import { selectApp } from "./use.js";

export async function rollbackCommand(
  options: { app?: string },
): Promise<void> {
  // 1. Detect and select app
  const apps = detectAllApps();
  const app = selectApp(options.app, apps);

  // 2. Load Appfit
  const appfit = getAppfit(app.name);
  if (!appfit) {
    throw new Error(`Unsupported application: ${app.name}`);
  }

  // 3. Resolve config paths and restore from .bak
  const configPaths = appfit.resolveConfigPaths(app.path);
  const toDelete: string[] = [];
  let restoredCount = 0;
  let missingCount = 0;

  for (const configPath of configPaths) {
    const bakPath = configPath + ".bak";
    try {
      await access(bakPath);
    } catch {
      missingCount++;
      continue;
    }

    try {
      await copyFile(bakPath, configPath);
      toDelete.push(bakPath);
      restoredCount++;
    } catch {
      throw new Error(
        `Restore ${configPath} failed: backup exists but restore error`,
      );
    }
  }

  // 4. Check results
  if (restoredCount === 0) {
    throw new Error("Error: application settings backup lost, restore failed");
  }

  // 5. Delete .bak files (only after all copies succeeded)
  for (const bakPath of toDelete) {
    await unlink(bakPath);
  }

  if (missingCount > 0) {
    console.warn(
      `⚠ Some backup files missing (${missingCount}/${configPaths.length}), restored remaining files.`,
    );
  }

  // 6. Success
  console.log(
    `✅ ${app.name} config restored to backup version. Please restart the application.`,
  );
}
