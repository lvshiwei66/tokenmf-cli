import type { Appfit } from "./types.js";
import { codexAppfit } from "./codex.js";
import { claudeCodeAppfit } from "./claude-code.js";
import { openclawAppfit } from "./openclaw.js";

const registry: Record<string, Appfit> = {
  codex: codexAppfit,
  "claude-code": claudeCodeAppfit,
  openclaw: openclawAppfit,
};

export function getAppfit(name: string): Appfit | undefined {
  return registry[name];
}
