import Table from "cli-table3";
import type { ConfigProvider } from "../config/index.js";
import { fetchProviderList } from "../providers/api.js";
import type { ProviderListItem } from "../types/provider.js";

export interface ListOptions {
  all: boolean;
  debug: boolean;
}

const DEFAULT_LIMIT = 20;

/** Column widths (terminal display columns — CJK chars count as 2) */
const COLS = { name: 20, models: 28, desc: 28, tags: 21 } as const;

/**
 * Format models cell content.
 * Shows up to 2 model names; appends (+N) for remaining.
 * Truncates model names (not count) when the cell would overflow.
 */
function formatModels(models: string[], modelCount: number): string {
  const shown = models.slice(0, 2);
  let joined = shown.join(", ");
  if (modelCount > 2) {
    const suffix = ` (+${String(modelCount)})`;
    // Reserve space for the count suffix
    const suffixLen = suffix.length;
    if (joined.length + suffixLen > COLS.models) {
      const truncAt = COLS.models - suffixLen - 1; // -1 for "…" ellipsis
      if (truncAt > 0) {
        joined = joined.slice(0, truncAt) + "…";
      }
    }
    return joined + suffix;
  }
  return joined;
}

function formatTable(items: ProviderListItem[], total: number, all: boolean): string {
  const rows = all ? items : items.slice(0, DEFAULT_LIMIT);

  const table = new Table({
    head: ["Name", "Models", "Description", "Tags"],
    colWidths: [COLS.name, COLS.models, COLS.desc, COLS.tags],
    wordWrap: false,
    truncate: "…",
    style: {
      "padding-left": 0,
      "padding-right": 0,
      head: [],
      border: [],
    },
    chars: {
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "",
      "left-mid": "",
      mid: "─",
      "mid-mid": " ",
      right: "",
      "right-mid": "",
      middle: " ",
    },
  });

  for (const p of rows) {
    table.push([
      p.name,
      formatModels(p.models, p.modelCount),
      p.description.replace(/\n/g, " "),
      p.tags.join(", ").replace(/\n/g, " "),
    ]);
  }

  let output = table.toString();

  // Keep only the first separator line (after header), strip duplicates between data rows
  {
    const lines = output.split("\n");
    const sepRe = /^─/;
    let seen = false;
    const filtered = lines.filter((line) => {
      if (sepRe.test(line.trimStart())) {
        if (!seen) { seen = true; return true; }
        return false;
      }
      return true;
    });
    output = filtered.join("\n");
  }

  if (!all && total > DEFAULT_LIMIT) {
    output += `\n---\n${String(total)} provider(s) total. Use --all to show all`;
  } else {
    output += `\n---\n${String(total)} provider(s) total`;
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
