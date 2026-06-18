import { describe, it, expect, vi } from "vitest";
import { setup } from "../commands/setup.js";

describe("Setup command", () => {
  it("setup function exists", () => {
    expect(typeof setup).toBe("function");
  });

  it("setup returns a promise", () => {
    // Mock console.log to avoid output during tests
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    
    const result = setup();
    expect(result).toBeInstanceOf(Promise);
    
    consoleSpy.mockRestore();
  });
});