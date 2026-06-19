import Table from "cli-table3";
import type { CliConfig } from "../config.js";

export interface Provider {
  name: string;
  latency: number;
  price: string;
  tokensPerSecond: number | null;
  description: string;
  tags: string[];
}

interface ApiResponse {
  providers: Provider[];
  total: number;
}

export interface ConfigProvider {
  getConfig: () => Promise<CliConfig | null>;
  getApiUrl: (config: CliConfig | null) => string;
}

export interface ListOptions {
  all: boolean;
  debug: boolean;
}

const TABLE_DESC_MAX = 32;
const DEFAULT_LIMIT = 20;

function truncateDesc(desc: string, maxLen: number): string {
  const chars = Array.from(desc);
  if (chars.length <= maxLen) return desc;
  return chars.slice(0, maxLen).join("") + "...";
}

function formatTable(providers: Provider[], total: number, all: boolean): string {
  const table = new Table({
    head: ["名称", "延迟", "价格", "速率", "描述", "标签"],
    style: { head: [], border: [] },
    colWidths: [20, 10, 12, 10, 34, 20],
    wordWrap: false,
  });

  const rows = all ? providers : providers.slice(0, DEFAULT_LIMIT);

  for (const p of rows) {
    table.push([
      p.name,
      `${String(p.latency)}ms`,
      p.price,
      p.tokensPerSecond != null ? `${String(p.tokensPerSecond)}t/s` : "N/A",
      truncateDesc(p.description, TABLE_DESC_MAX),
      p.tags.join(", "),
    ]);
  }

  let output = table.toString();

  if (!all && total > DEFAULT_LIMIT) {
    output += `\n共 ${String(total)} 家供应商。使用 --all 展示所有供应商`;
  } else {
    output += `\n共 ${String(total)} 家供应商`;
  }

  return output;
}

export async function listAction(
  configProvider: ConfigProvider,
  options: ListOptions,
): Promise<void> {
  const config = await configProvider.getConfig();
  const apiUrl = configProvider.getApiUrl(config);
  const fingerprint = config?.fingerprint ?? "unknown";
  const url = `${apiUrl}/api/v1/providers`;
  const startedAt = Date.now();

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "x-client-id": fingerprint },
    });
  } catch (err) {
    if (options.debug) {
      console.error(`[Debug] 请求 URL: ${url}`);
      console.error(`[Debug] 错误: ${String(err)}`);
    }
    console.error("❌ 请检查网络连接");
    return;
  }

  const elapsed = Date.now() - startedAt;

  if (!res.ok) {
    if (options.debug) {
      console.error(`[Debug] 请求 URL: ${url}`);
      console.error(`[Debug] 状态码: ${String(res.status)}`);
      console.error(`[Debug] 耗时: ${String(elapsed)}ms`);
      try {
        const body = await res.text();
        console.error(`[Debug] 响应体: ${body}`);
      } catch { /* ignore */ }
    }
    console.error(`❌ 服务异常（状态码: ${String(res.status)}），请稍后重试`);
    return;
  }

  let data: ApiResponse;
  try {
    data = (await res.json()) as ApiResponse;
  } catch {
    if (options.debug) {
      console.error(`[Debug] 请求 URL: ${url}`);
      console.error(`[Debug] 状态码: ${String(res.status)}`);
      console.error(`[Debug] 耗时: ${String(elapsed)}ms`);
    }
    console.error("❌ 响应数据异常");
    return;
  }

  if (options.debug) {
    console.error(`[Debug] 请求 URL: ${url}`);
    console.error(`[Debug] 状态码: ${String(res.status)}`);
    console.error(`[Debug] 耗时: ${String(elapsed)}ms`);
    console.error(`[Debug] 返回供应商数: ${String(data.total)}`);
  }

  const output = formatTable(data.providers, data.total, options.all);
  console.log(output);
}
