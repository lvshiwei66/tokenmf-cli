import Table from "cli-table3";
import type { ConfigProvider } from "../config.js";
import { fetchProviderList } from "../providers/api.js";
import type { ProviderListItem } from "../types/provider.js";

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

function formatModels(models: string[], modelCount: number): string {
  const shown = models.slice(0, 3);
  const remaining = modelCount - shown.length;
  let result = shown.join(", ");
  if (remaining > 0) {
    result += ` (+${String(remaining)})`;
  }
  return result;
}

function formatTable(items: ProviderListItem[], total: number, all: boolean): string {
  const table = new Table({
    head: ["Name", "Latency", "Price", "Models", "Description", "Tags"],
    style: { head: [], border: [], compact: true },
    colWidths: [16, 10, 10, 30, 28, 18],
    wordWrap: false,
  });

  const rows = all ? items : items.slice(0, DEFAULT_LIMIT);

  for (const p of rows) {
    table.push([
      p.name,
      `${String(p.latency)}ms`,
      p.price,
      formatModels(p.models, p.modelCount),
      truncateDesc(p.description, TABLE_DESC_MAX),
      p.tags.join(", "),
    ]);
  }

  let output = table.toString();

  if (!all && total > DEFAULT_LIMIT) {
    output += `\n${String(total)} provider(s) total. Use --all to show all`;
  } else {
    output += `\n${String(total)} provider(s) total`;
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
  const startedAt = Date.now();

  const result = await fetchProviderList(apiUrl, fingerprint);

  if ("code" in result) {
    if (options.debug) {
      console.error(`[Debug] Request URL: ${apiUrl}/api/v1/providers`);
      console.error(`[Debug] Error code: ${result.code}`);
      if (result.statusCode != null) {
        console.error(`[Debug] Status code: ${String(result.statusCode)}`);
      }
    }
    console.error(result.message);
    return;
  }

  const elapsed = Date.now() - startedAt;

  if (options.debug) {
    console.error(`[Debug] Request URL: ${apiUrl}/api/v1/providers`);
    console.error(`[Debug] Elapsed: ${String(elapsed)}ms`);
    console.error(`[Debug] Provider count: ${String(result.total)}`);
  }

  const output = formatTable(result.providers, result.total, options.all);
  console.log(output);
}
