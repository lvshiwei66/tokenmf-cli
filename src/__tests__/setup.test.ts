import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setup } from "../commands/setup.js";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

describe("Setup command", () => {
  const configDir = join(homedir(), ".tmf");
  const reportPath = join(configDir, "detection-report.json");

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(reportPath)) {
      unlinkSync(reportPath);
    }
  });

  it("setup function exists", () => {
    expect(typeof setup).toBe("function");
  });

  it("setup returns a promise", () => {
    const result = setup();
    expect(result).toBeInstanceOf(Promise);
  });

  it("setup creates detection report file", async () => {
    await setup();
    expect(existsSync(reportPath)).toBe(true);
  });

  it("setup generates valid JSON report", async () => {
    await setup();
    const content = readFileSync(reportPath, "utf-8");
    const report = JSON.parse(content) as Record<string, unknown>;

    expect(report).toHaveProperty("timestamp");
    expect(report).toHaveProperty("apps");
    expect(report).toHaveProperty("fingerprint");
    expect(Array.isArray(report.apps)).toBe(true);
    expect(typeof report.fingerprint).toBe("string");
  });

  it("setup fingerprint is consistent across runs", async () => {
    await setup();
    const content1 = readFileSync(reportPath, "utf-8");
    const report1 = JSON.parse(content1) as Record<string, unknown>;

    if (existsSync(reportPath)) {
      unlinkSync(reportPath);
    }

    await setup();
    const content2 = readFileSync(reportPath, "utf-8");
    const report2 = JSON.parse(content2) as Record<string, unknown>;

    expect(report1.fingerprint).toBe(report2.fingerprint);
  });
});
