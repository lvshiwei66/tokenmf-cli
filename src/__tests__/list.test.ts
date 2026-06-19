import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { listAction, type Provider } from "../commands/list.js";

const sampleProviders: Provider[] = [
  {
    name: "packcode",
    latency: 200,
    price: "$0.04",
    tokensPerSecond: 17,
    description: "支持 GPT-5.5 和 Claude-4 🚀",
    tags: ["fast", "cheap"],
  },
  {
    name: "xcodcs",
    latency: 79,
    price: "¥1.50",
    tokensPerSecond: null,
    description: "",
    tags: [],
  },
];

function mockFetchResponse(
  providers: Provider[],
  status = 200,
): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => ({ providers, total: providers.length }),
      text: () => JSON.stringify({ providers, total: providers.length }),
    }),
  );
}

function mockFetchReject(error: Error): void {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
}

describe("listAction", () => {
  let stdout: string;
  let stderr: string;

  beforeEach(() => {
    stdout = "";
    stderr = "";
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      stdout += args.map(String).join(" ") + "\n";
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      stderr += args.map(String).join(" ") + "\n";
    });
    // Set up config env
    process.env["TMF_API_URL"] = "http://localhost:3000";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env["TMF_API_URL"];
  });

  // ── Success cases ──────────────────────────────────────

  it("renders provider table with default 20 limit", async () => {
    const providers = Array.from({ length: 25 }, (_, i) => ({
      name: `provider-${String(i)}`,
      latency: 100 + i,
      price: `$${String(i)}.00`,
      tokensPerSecond: i * 10,
      description: `desc ${String(i)}`,
      tags: [`tag${String(i)}`],
    }));
    mockFetchResponse(providers);

    await listAction(
      { getConfig: () => Promise.resolve({ fingerprint: "abcd1234" }), getApiUrl: () => "http://localhost:3000" },
      { all: false, debug: false },
    );

    // Should show only 20 rows
    expect(stdout).toContain("provider-0");
    expect(stdout).toContain("provider-19");
    expect(stdout).not.toContain("provider-20");
    // Should show total with hint
    expect(stdout).toContain("25");
    expect(stdout).toContain("--all");
  });

  it("renders all providers with --all", async () => {
    const providers = Array.from({ length: 25 }, (_, i) => ({
      name: `p${String(i)}`,
      latency: i,
      price: `$${String(i)}`,
      tokensPerSecond: i,
      description: `d${String(i)}`,
      tags: [],
    }));
    mockFetchResponse(providers);

    await listAction(
      { getConfig: () => Promise.resolve({ fingerprint: "abcd1234" }), getApiUrl: () => "http://localhost:3000" },
      { all: true, debug: false },
    );

    expect(stdout).toContain("p24");
    expect(stdout).toContain("25");
  });

  it("shows N/A for null tokensPerSecond", async () => {
    mockFetchResponse(sampleProviders);

    await listAction(
      { getConfig: () => Promise.resolve({ fingerprint: "abcd1234" }), getApiUrl: () => "http://localhost:3000" },
      { all: false, debug: false },
    );

    expect(stdout).toContain("N/A");
  });

  it("truncates description in table", async () => {
    const longDesc = "x".repeat(80);
    mockFetchResponse([
      {
        name: "test",
        latency: 100,
        price: "$0.01",
        tokensPerSecond: null,
        description: longDesc,
        tags: [],
      },
    ]);

    await listAction(
      { getConfig: () => Promise.resolve({ fingerprint: "abcd1234" }), getApiUrl: () => "http://localhost:3000" },
      { all: false, debug: false },
    );

    // Description should be truncated, not shown in full
    expect(stdout).not.toContain(longDesc);
    // The output should contain part of the description with truncation indicator
    expect(stdout).toMatch(/x{20,}/);
  });

  // ── Debug mode ─────────────────────────────────────────

  it("outputs debug info when --debug is set", async () => {
    mockFetchResponse(sampleProviders);

    await listAction(
      { getConfig: () => Promise.resolve({ fingerprint: "abcd1234" }), getApiUrl: () => "http://localhost:3000" },
      { all: false, debug: true },
    );

    expect(stderr).toContain("Debug");
    expect(stderr).toContain("http://localhost:3000");
    expect(stderr).toContain("200");
  });

  // ── Error cases ────────────────────────────────────────

  it("shows network error message on fetch failure", async () => {
    mockFetchReject(new Error("connect ECONNREFUSED"));

    await listAction(
      { getConfig: () => Promise.resolve({ fingerprint: "abcd1234" }), getApiUrl: () => "http://localhost:3000" },
      { all: false, debug: false },
    );

    expect(stderr).toContain("请检查网络连接");
  });

  it("shows service error on non-200 response", async () => {
    mockFetchResponse([], 429);

    await listAction(
      { getConfig: () => Promise.resolve({ fingerprint: "abcd1234" }), getApiUrl: () => "http://localhost:3000" },
      { all: false, debug: false },
    );

    expect(stderr).toContain("服务异常");
    expect(stderr).toContain("429");
  });

  it("shows data error on JSON parse failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => {
          throw new Error("Unexpected token");
        },
        text: () => "not json",
      }),
    );

    await listAction(
      { getConfig: () => Promise.resolve({ fingerprint: "abcd1234" }), getApiUrl: () => "http://localhost:3000" },
      { all: false, debug: false },
    );

    expect(stderr).toContain("响应数据异常");
  });
});
