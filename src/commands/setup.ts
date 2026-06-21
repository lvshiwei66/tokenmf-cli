import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { userInfo } from "node:os";
import { detectAllApps } from "../detectors/index.js";
import { getFingerprint, CONFIG_DIR, CONFIG_PATH, saveConfig } from "../config/index.js";
import type { DetectionReport } from "../detectors/types.js";

export async function setup(): Promise<void> {
  if (userInfo().uid === 0) {
    console.warn("⚠️  Running as root may cause config file permission issues. Using a regular user is recommended.");
    console.warn("   Some app config files may be owned by root, preventing apps from reading them.\n");
  }

  console.log("🔍 Scanning for installed AI applications...\n");

  const apps = detectAllApps();
  const fingerprint = getFingerprint();

  if (apps.length === 0) {
    console.log("ℹ️  No installed AI applications detected.");
    console.log("   Please install one of the following applications first:");
    console.log("   - Codex (config path: ~/.codex/config.toml)");
    console.log("   - Claude Code (config path: ~/.claude/settings.json)");
    console.log("   - OpenClaw (config path: ~/.openclaw/config.yaml)");
  } else {
    console.log(`✅ Detected ${String(apps.length)} application(s):\n`);

    for (const app of apps) {
      console.log(`  📦 ${app.name}`);
      if (app.version) {
        console.log(`     Version: ${app.version}`);
      }
      console.log(`     Path: ${app.path}`);
      console.log(`     Config: ${app.configPath}`);
      console.log(`     Format: ${app.configFormat.toUpperCase()}`);
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

  console.log(`💾 Detection report saved to: ${reportPath}`);
  console.log(`🔑 Client fingerprint: ${fingerprint}`);
}
