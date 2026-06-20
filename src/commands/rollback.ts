import { copyFile, unlink } from "node:fs/promises";
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
  let restoredCount = 0;
  let missingCount = 0;

  for (const configPath of configPaths) {
    const bakPath = configPath + ".bak";
    try {
      await copyFile(bakPath, configPath);
      await unlink(bakPath);
      restoredCount++;
    } catch {
      missingCount++;
    }
  }

  // 4. Check results
  if (restoredCount === 0) {
    throw new Error("错误：应用设置备份丢失，恢复失败。");
  }

  if (missingCount > 0) {
    console.warn(
      `⚠ 部分备份文件缺失（${missingCount}/${configPaths.length}），已恢复其余文件。`,
    );
  }

  // 5. Success
  console.log(
    `✅ 已将 ${app.name} 配置恢复至备份版本。请重启应用以生效。`,
  );
}
