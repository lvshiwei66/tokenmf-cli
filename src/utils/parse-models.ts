import type { RoleModels } from "../types/provider.js";

export interface ParsedModels {
  /** Full model list: first is primary, rest are fallback chain */
  models?: string[];
  /** Role-based model assignments (opus/sonnet/haiku) */
  roleModels?: RoleModels;
}

const VALID_ROLES = new Set(["opus", "sonnet", "haiku"]);

/**
 * Parse --models CLI option. Supports two formats:
 *   Key=value: --models opus=X,sonnet=Y,haiku=Z
 *   Positional: --models <opus> <sonnet> <haiku>
 */
export function parseModels(rawModels: string[]): ParsedModels {
  if (!rawModels || rawModels.length === 0) {
    return {};
  }

  // Detect key=value format by checking if any entry contains "="
  const kvParts = rawModels.flatMap((entry) =>
    entry.split(",").map((s) => s.trim()).filter(Boolean),
  );
  const kvMap: Record<string, string> = {};
  let hasKv = false;

  for (const part of kvParts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx > 0) {
      const key = part.slice(0, eqIdx).trim().toLowerCase();
      const value = part.slice(eqIdx + 1).trim();
      if (VALID_ROLES.has(key)) {
        kvMap[key] = value;
        hasKv = true;
      } else {
        console.warn(
          `⚠ Ignoring unknown model role "${key}" in --models. Expected: opus, sonnet, haiku`,
        );
      }
    }
  }

  if (hasKv) {
    return parseKeyValueModels(kvMap);
  }
  return parsePositionalModels(rawModels);
}

function parseKeyValueModels(kvMap: Record<string, string>): ParsedModels {
  const roleModels: RoleModels = kvMap;
  const primary = kvMap.opus ?? kvMap.sonnet ?? kvMap.haiku;
  if (!primary) return { roleModels };

  const models: string[] = [primary];
  const seen = new Set([primary]);
  for (const m of [kvMap.opus, kvMap.sonnet, kvMap.haiku]) {
    if (m && !seen.has(m)) {
      models.push(m);
      seen.add(m);
    }
  }
  return { models, roleModels };
}

function parsePositionalModels(raw: string[]): ParsedModels {
  let roleModels: RoleModels | undefined;
  if (raw.length >= 1) roleModels = { opus: raw[0] };
  if (raw.length >= 2) roleModels = { ...roleModels, sonnet: raw[1] };
  if (raw.length >= 3) roleModels = { ...roleModels, haiku: raw[2] };

  const primary = raw[0];
  const models: string[] = [primary];
  const seen = new Set([primary]);
  for (let i = 1; i < raw.length; i++) {
    if (!seen.has(raw[i])) {
      models.push(raw[i]);
      seen.add(raw[i]);
    }
  }
  return { models, roleModels };
}
