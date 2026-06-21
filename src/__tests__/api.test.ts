import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchProviderList, fetchProviderInfo } from "../providers/api.js";
import type { ApiError } from "../providers/api.js";

const API_URL = "https://api.tokenmofang.com";
const CLIENT_ID = "test-client-123";

describe("providers/api", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── fetchProviderList ────────────────────────────────

  describe("fetchProviderList", () => {
    it("returns providers on success", async () => {
      const mockProviders = {
        providers: [{ name: "test", latency: 100, price: "$1", tokensPerSecond: 10, description: "", tags: [], models: ["m1"], modelCount: 1 }],
        total: 1,
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProviders,
      });

      const result = await fetchProviderList(API_URL, CLIENT_ID);
      if ("code" in result) throw new Error("expected success");
      expect(result.total).toBe(1);
      expect(result.providers[0].name).toBe("test");
    });

    it("calls correct URL and sends x-client-id header", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ providers: [], total: 0 }),
      });
      globalThis.fetch = fetchMock;

      await fetchProviderList(API_URL, CLIENT_ID);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.tokenmofang.com/api/v1/providers",
        { headers: { "x-client-id": CLIENT_ID } },
      );
    });

    it("returns NETWORK error on fetch failure", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

      const result = await fetchProviderList(API_URL, CLIENT_ID);
      expectApiError(result, "NETWORK");
    });

    it("returns RATE_LIMITED on 429", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });

      const result = await fetchProviderList(API_URL, CLIENT_ID);
      expectApiError(result, "RATE_LIMITED");
    });

    it("returns SERVER_ERROR on 500", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

      const result = await fetchProviderList(API_URL, CLIENT_ID);
      expectApiError(result, "SERVER_ERROR", 500);
    });

    it("returns PARSE error on invalid JSON", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => { throw new SyntaxError("Unexpected token"); },
      });

      const result = await fetchProviderList(API_URL, CLIENT_ID);
      expectApiError(result, "PARSE");
    });
  });

  // ── fetchProviderInfo ────────────────────────────────

  describe("fetchProviderInfo", () => {
    it("returns detail on success", async () => {
      const mockDetail = {
        name: "test",
        intro: "Test provider",
        website: "https://test.com",
        urls: { default: "https://api.test.com" },
        defaultModel: "m1",
        models: ["m1"],
        updated_at: "Jun 20, 2026 12:00",
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockDetail,
      });

      const result = await fetchProviderInfo(API_URL, CLIENT_ID, "test");
      if ("code" in result) throw new Error("expected success");
      expect(result.name).toBe("test");
      expect(result.urls).toEqual({ default: "https://api.test.com" });
    });

    it("URL-encodes provider name", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ name: "a b", intro: "", website: "", urls: { default: "" }, defaultModel: "", models: [], updated_at: "" }),
      });
      globalThis.fetch = fetchMock;

      await fetchProviderInfo(API_URL, CLIENT_ID, "test provider");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.tokenmofang.com/api/v1/providers/test%20provider",
        expect.anything(),
      );
    });

    it("returns NOT_FOUND with provider name on 404", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

      const result = await fetchProviderInfo(API_URL, CLIENT_ID, "missing");
      expectApiError(result, "NOT_FOUND");
      if ("code" in result) {
        expect(result.message).toContain("missing");
      }
    });

    it("returns RATE_LIMITED on 429", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });

      const result = await fetchProviderInfo(API_URL, CLIENT_ID, "any");
      expectApiError(result, "RATE_LIMITED");
    });

    it("returns PARSE error on invalid JSON", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError("bad json"); },
      });

      const result = await fetchProviderInfo(API_URL, CLIENT_ID, "any");
      expectApiError(result, "PARSE");
    });
  });
});

function expectApiError(result: unknown, code: ApiError["code"], statusCode?: number) {
  if (!result || typeof result !== "object" || !("code" in result)) {
    throw new Error(`expected ApiError, got ${JSON.stringify(result)}`);
  }
  const err = result as ApiError;
  expect(err.code).toBe(code);
  if (statusCode !== undefined) {
    expect(err.statusCode).toBe(statusCode);
  }
}
