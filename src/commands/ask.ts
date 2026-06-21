import type { ConfigProvider } from "../config/index.js";
import { fetchProviderInfo } from "../providers/api.js";

export interface AskOptions {
  debug: boolean;
}

export async function askAction(
  provider: string,
  configProvider: ConfigProvider,
  options: AskOptions,
): Promise<void> {
  const config = await configProvider.getConfig();
  const apiUrl = configProvider.getApiUrl(config);
  const fingerprint = config?.fingerprint ?? "unknown";

  const result = await fetchProviderInfo(apiUrl, fingerprint, provider);

  if ("code" in result) {
    if (options.debug) {
      console.error(`[Debug] Request URL: ${apiUrl}/api/v1/providers/${provider}`);
      console.error(`[Debug] Error code: ${result.code}`);
      if (result.statusCode != null) {
        console.error(`[Debug] Status code: ${String(result.statusCode)}`);
      }
    }
    console.error(result.message);
    return;
  }

  const d = result;
  const intro = d.intro ? `  Intro: ${d.intro}` : "";
  const website = d.website ? `  Website: ${d.website}` : "";
  const defaultModel = d.defaultModel ? `  Default model: ${d.defaultModel}` : "";
  const urlLines = d.urls && Object.keys(d.urls).length > 0
    ? Object.entries(d.urls).map(([proto, url]) => `  API URL (${proto}): ${url}`)
    : ["  API URL: not configured"];
  const models = d.models.length > 0 ? `  Available models: ${d.models.join(", ")}` : "";
  const updated = d.updated_at ? `  Updated: ${d.updated_at}` : "";

  const lines = [
    `🔍 ${d.name}`,
    "",
    intro,
    website,
    defaultModel,
    ...urlLines,
    models,
    updated,
  ].filter((l) => l !== "");

  console.log(lines.join("\n"));
}
