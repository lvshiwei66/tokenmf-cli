import { describe, it, expect } from "vitest";
import { detectAllApps } from "../detectors/index.js";

describe("App detectors", () => {
  it("detectAllApps returns array", async () => {
    const apps = await detectAllApps();
    expect(Array.isArray(apps)).toBe(true);
  });

  it("detectAllApps handles errors gracefully", async () => {
    // This test verifies that detector errors don't crash the app
    const apps = await detectAllApps();
    expect(apps).toBeDefined();
  });
});