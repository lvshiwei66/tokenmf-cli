import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { userInfo } from "node:os";
import { detectAllApps } from "../detectors/index.js";
import { getFingerprint, CONFIG_DIR, CONFIG_PATH, saveConfig } from "../config.js";
import type { DetectionReport } from "../detectors/types.js";

export async function setup(): Promise<void> {
  if (userInfo().uid === 0) {
    console.warn("⚠️  以 root 运行可能导致配置文件权限问题，建议使用普通用户。");
    console.warn("   部分应用配置文件可能被 root 所有，导致应用无法读取。\n");
  }

  console.log("🔍 正在扫描已安装的 AI 应用...\n");

  const apps = detectAllApps();
  const fingerprint = getFingerprint();

  if (apps.length === 0) {
    console.log("ℹ️  未检测到任何已安装的 AI 应用。");
    console.log("   请先安装以下应用之一：");
    console.log("   - Codex (配置路径: ~/.codex/config.toml)");
    console.log("   - Claude Code (配置路径: ~/.claude/settings.json)");
    console.log("   - OpenClaw (配置路径: ~/.openclaw/config.yaml)");
  } else {
    console.log(`✅ 检测到 ${String(apps.length)} 个应用：\n`);

    for (const app of apps) {
      console.log(`  📦 ${app.name}`);
      if (app.version) {
        console.log(`     版本: ${app.version}`);
      }
      console.log(`     路径: ${app.path}`);
      console.log(`     配置: ${app.configPath}`);
      console.log(`     格式: ${app.configFormat.toUpperCase()}`);
      console.log();
    }
  }

  const report: DetectionReport = {
    timestamp: new Date().toISOString(),
    apps,
    fingerprint,
  };

  await mkdir(CONFIG_DIR, { recursive: true });

  const reportPath = join(CONFIG_DIR, "detection-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  // Also write the runtime config for list / other commands
  await saveConfig(CONFIG_PATH, { fingerprint });

  console.log(`💾 检测报告已保存到: ${reportPath}`);
  console.log(`🔑 客户端指纹: ${fingerprint}`);
}
