import type { ProviderListItem, ProviderDetail } from "../types/provider.js";

export interface ApiError {
  code: "NETWORK" | "NOT_FOUND" | "RATE_LIMITED" | "SERVER_ERROR" | "PARSE";
  message: string;
  statusCode?: number;
}

async function doFetch(
  url: string,
  clientId: string,
): Promise<Response> {
  return fetch(url, {
    headers: { "x-client-id": clientId },
  });
}

function classifyError(err: unknown, statusCode?: number): ApiError {
  if (err instanceof TypeError && err.message.includes("fetch")) {
    return { code: "NETWORK", message: "\u274c Please check network connection" };
  }
  if (statusCode === 404) {
    return { code: "NOT_FOUND", message: "" }; // caller sets name
  }
  if (statusCode === 429) {
    return { code: "RATE_LIMITED", message: "\u274c Too many requests, please try again later" };
  }
  if (statusCode != null && statusCode >= 400) {
    return {
      code: "SERVER_ERROR",
      message: `\u274c Service error (status: ${String(statusCode)}), please try again later`,
      statusCode,
    };
  }
  return { code: "NETWORK", message: "\u274c Please check network connection" };
}

/**
 * Fetch the provider list from the API.
 * On network/parse errors, returns an ApiError.
 */
export async function fetchProviderList(
  apiUrl: string,
  clientId: string,
): Promise<{ providers: ProviderListItem[]; total: number } | ApiError> {
  const url = `${apiUrl}/api/v1/providers`;
  let res: Response;
  try {
    res = await doFetch(url, clientId);
  } catch (err) {
    return classifyError(err);
  }

  if (!res.ok) {
    return classifyError(null, res.status);
  }

  try {
    return (await res.json()) as { providers: ProviderListItem[]; total: number };
  } catch {
    return { code: "PARSE", message: "\u274c Response data error" };
  }
}

/**
 * Fetch a single provider detail from the API.
 * On 404, the provider name is embedded in the message.
 * On network/parse/other errors, returns an ApiError.
 */
export async function fetchProviderInfo(
  apiUrl: string,
  clientId: string,
  name: string,
): Promise<ProviderDetail | ApiError> {
  const url = `${apiUrl}/api/v1/providers/${encodeURIComponent(name)}`;
  let res: Response;
  try {
    res = await doFetch(url, clientId);
  } catch (err) {
    return classifyError(err);
  }

  if (res.status === 404) {
    return { code: "NOT_FOUND", message: `\u274c Provider not found: ${name}` };
  }

  if (!res.ok) {
    return classifyError(null, res.status);
  }

  try {
    return (await res.json()) as ProviderDetail;
  } catch {
    return { code: "PARSE", message: "\u274c Response data error" };
  }
}
