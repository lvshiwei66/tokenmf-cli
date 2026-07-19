/**
 * Parse --env CLI options (KEY=VALUE format) into a Record.
 */
export function parseEnv(rawEnv: string[]): Record<string, string> {
  const envRecord: Record<string, string> = {};
  if (!rawEnv) return envRecord;

  for (const entry of rawEnv) {
    const eqIdx = entry.indexOf("=");
    if (eqIdx > 0) {
      envRecord[entry.slice(0, eqIdx).trim()] = entry.slice(eqIdx + 1).trim();
    } else {
      console.warn(
        `⚠ Ignoring malformed --env entry: "${entry}" (expected KEY=VALUE)`,
      );
    }
  }
  return envRecord;
}
