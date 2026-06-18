import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { detectAllApps } from "../detectors/index.js";
import { generateFingerprint } from "../utils/fingerprint.js";
import type { DetectionReport } from "../detectors/types.js";

export async function setup(): Promise<void> {
  console.log("🔍 正在扫描已安装的 AI 应用...\n");

  const apps = await detectAllApps();
  
  if (apps.length === 0) {
    console.log("ℹ️  未检测到任何已安装的 AI 应用。");
    console.log("   请先安装以下应用之一：");
    console.log("   - Codex (配置路径: ~/.codex/config.toml)");
    console.log("   - Claude Code (配置路径: ~/.claude/settings.json)");
    console.log("   - OpenClaw (配置路径: ~/.openclaw/config.yaml)");
    return;
  }

  console.log(`✅ 检测到 ${apps.length} 个应用：\n`);
  
  for (const app of apps) {
    console.log(`  📦 ${app.name}`);
    console.log(`     路径: ${app.path}`);
    console.log(`     配置: ${app.configPath}`);
    console.log(`     格式: ${app.configFormat.toUpperCase()}`);
    console.log();
  }

  const fingerprint = generateFingerprint();
  
  const report: DetectionReport = {
    timestamp: new Date().toISOString(),
    apps,
    fingerprint,
  };

  const configDir = join(homedir(), ".tokenmofang");
  await mkdir(configDir, { recursive: true });
  
  const reportPath = join(configDir, "detection-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`💾 检测报告已保存到: ${reportPath}`);
  console.log(`🔑 客户端指纹: ${fingerprint}`);
}