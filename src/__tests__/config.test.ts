import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getConfig, saveConfig, getFingerprint, getApiUrl } from "../config/index.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("CLI config", () => {
  const testConfigDir = path.join(os.tmpdir(), "tmf-test-config");
  const testConfigPath = path.join(testConfigDir, "config.json");

  beforeEach(async () => {
    await fs.mkdir(testConfigDir, { recursive: true });
    try {
      await fs.unlink(testConfigPath);
    } catch {
      /* ok */
    }
  });

  afterEach(async () => {
    try {
      await fs.rm(testConfigDir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  });

  // ── getFingerprint ─────────────────────────────────────

  describe("getFingerprint", () => {
    it("returns a 64-char hex string", () => {
      const fp = getFingerprint();
      expect(fp).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(fp)).toBe(true);
    });

    it("returns the same value on repeated calls (idempotent)", () => {
      const fp1 = getFingerprint();
      const fp2 = getFingerprint();
      expect(fp1).toBe(fp2);
    });
  });

  // ── saveConfig / getConfig ─────────────────────────────

  it("saveConfig writes and getConfig reads back", async () => {
    const fp = getFingerprint();
    await saveConfig(testConfigPath, { fingerprint: fp });

    const cfg = await getConfig(testConfigPath);
    expect(cfg).not.toBeNull();
    if (cfg) {
      expect(cfg.fingerprint).toBe(fp);
    }
  });

  it("getConfig returns null when file does not exist", async () => {
    const cfg = await getConfig(testConfigPath);
    expect(cfg).toBeNull();
  });

  it("saveConfig overwrites existing config", async () => {
    await saveConfig(testConfigPath, { fingerprint: "abc123" });
    await saveConfig(testConfigPath, { fingerprint: "def456" });

    const cfg = await getConfig(testConfigPath);
    expect(cfg).not.toBeNull();
    if (cfg) {
      expect(cfg.fingerprint).toBe("def456");
    }
  });

  // ── getApiUrl ──────────────────────────────────────────

  describe("getApiUrl", () => {
    const originalEnv = process.env["TMF_API_URL"];

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env["TMF_API_URL"] = originalEnv;
      } else {
        delete process.env["TMF_API_URL"];
      }
    });

    it("returns default URL when nothing configured", () => {
      delete process.env["TMF_API_URL"];
      const url = getApiUrl(null);
      expect(url).toBe("https://api.tokenmofang.com");
    });

    it("returns env var when set", () => {
      process.env["TMF_API_URL"] = "http://localhost:3000";
      const url = getApiUrl(null);
      expect(url).toBe("http://localhost:3000");
    });

    it("returns config file value when env var not set", () => {
      delete process.env["TMF_API_URL"];
      const url = getApiUrl({
        fingerprint: "x",
        apiUrl: "https://staging.example.com",
      });
      expect(url).toBe("https://staging.example.com");
    });

    it("env var overrides config file", () => {
      process.env["TMF_API_URL"] = "http://override:9999";
      const url = getApiUrl({
        fingerprint: "x",
        apiUrl: "https://staging.example.com",
      });
      expect(url).toBe("http://override:9999");
    });
  });
});
