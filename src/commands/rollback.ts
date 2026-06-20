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
    throw new Error(`不支持的应用：${app.name}`);
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
        `恢复 ${configPath} 失败：备份文件存在但恢复出错`,
      );
    }
  }

  // 4. Check results
  if (restoredCount === 0) {
    throw new Error("错误：应用设置备份丢失，恢复失败");
  }

  // 5. Delete .bak files (only after all copies succeeded)
  for (const bakPath of toDelete) {
    await unlink(bakPath);
  }

  if (missingCount > 0) {
    console.warn(
      `⚠ 部分备份文件缺失（${missingCount}/${configPaths.length}），已恢复其余文件。`,
    );
  }

  // 6. Success
  console.log(
    `✅ 已将 ${app.name} 配置恢复至备份版本。请重启应用以生效。`,
  );
}
