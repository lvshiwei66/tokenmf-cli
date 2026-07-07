import { accessSync, constants } from "node:fs";
import { join } from "node:path";

/**
 * Find an executable in PATH. Returns the full path or null.
 */
export function whichSync(name: string): string | null {
  const pathEnv = process.env.PATH ?? "";
  const dirs = pathEnv.split(":");
  for (const dir of dirs) {
    const fullPath = join(dir, name);
    try {
      accessSync(fullPath, constants.X_OK);
      return fullPath;
    } catch {
      // not found or not executable, continue
    }
  }
  return null;
}
