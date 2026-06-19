import { createHash } from "node:crypto";
import { hostname, platform, arch } from "node:os";

/**
 * Generate a 64-char hex fingerprint from machine characteristics.
 * Idempotent: same machine always produces the same value.
 */
export function getFingerprint(): string {
  const data = `${hostname()}-${platform()}-${arch()}`;
  return createHash("sha256").update(data).digest("hex");
}
