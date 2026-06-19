import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, unlinkSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  loadSettings,
  saveSettings,
  getProviderMemory,
  setProviderMemory,
} from "../config/settings.js";
import type { Settings } from "../config/settings.js";

const configDir = join(homedir(), ".tokenmofang");
const settingsPath = join(configDir, "settings.json");

describe("Settings persistence", () => {
  beforeEach(() => {
    if (existsSync(settingsPath)) {
      unlinkSync(settingsPath);
    }
  });

  afterEach(() => {
    if (existsSync(settingsPath)) {
      unlinkSync(settingsPath);
    }
  });

  it("loadSettings returns defaults when no file exists", async () => {
    const settings = await loadSettings();
    expect(settings.providers).toEqual({});
  });

  it("saveSettings creates file and directory", async () => {
    const settings: Settings = {
      clientId: "test-fingerprint",
      providers: {
        packcode: {
          apiKey: "sk-test",
          model: "deepseek-v4-pro",
          baseUrl: "https://api.deepseek.com/openai",
        },
      },
    };
    await saveSettings(settings);

    expect(existsSync(settingsPath)).toBe(true);
    const content = readFileSync(settingsPath, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.clientId).toBe("test-fingerprint");
    expect(parsed.providers.packcode.apiKey).toBe("sk-test");
  });

  it("loadSettings reads saved data", async () => {
    const settings: Settings = {
      providers: {
        openai: {
          apiKey: "sk-openai",
          model: "gpt-5.1",
          baseUrl: "https://api.openai.com/v1",
        },
      },
    };
    await saveSettings(settings);

    const loaded = await loadSettings();
    expect(loaded.providers.openai.apiKey).toBe("sk-openai");
    expect(loaded.providers.openai.baseUrl).toBe("https://api.openai.com/v1");
  });

  it("getProviderMemory returns undefined for unknown provider", async () => {
    const settings = await loadSettings();
    expect(getProviderMemory(settings, "nonexistent")).toBeUndefined();
  });

  it("getProviderMemory returns stored memory", async () => {
    const settings: Settings = {
      providers: {
        packcode: {
          apiKey: "sk-test",
          model: "deepseek-v4-pro",
          baseUrl: "https://api.deepseek.com/openai",
        },
      },
    };
    const memory = getProviderMemory(settings, "packcode");
    expect(memory).toBeDefined();
    expect(memory!.apiKey).toBe("sk-test");
    expect(memory!.baseUrl).toBe("https://api.deepseek.com/openai");
  });

  it("setProviderMemory adds new provider", () => {
    const settings: Settings = { providers: {} };
    setProviderMemory(settings, "newprov", {
      apiKey: "sk-new",
      model: "test-model",
      baseUrl: "https://new.api.com",
    });
    expect(settings.providers["newprov"].apiKey).toBe("sk-new");
  });

  it("setProviderMemory updates existing provider", () => {
    const settings: Settings = {
      providers: {
        packcode: {
          apiKey: "sk-old",
          baseUrl: "https://old.api.com",
        },
      },
    };
    setProviderMemory(settings, "packcode", {
      apiKey: "sk-new",
      model: "new-model",
      baseUrl: "https://new.api.com",
    });
    expect(settings.providers["packcode"].apiKey).toBe("sk-new");
    expect(settings.providers["packcode"].model).toBe("new-model");
  });

  it("loadSettings handles corrupted JSON gracefully", async () => {
    // Write invalid JSON
    mkdirSync(configDir, { recursive: true });
    writeFileSync(settingsPath, "not valid json");

    const settings = await loadSettings();
    expect(settings.providers).toEqual({});
  });
});
