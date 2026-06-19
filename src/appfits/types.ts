import type { UseParams } from "../types/provider.js";

export interface Appfit {
  name: string;
  resolveConfigPaths(appPath: string): string[];
  apply(appPath: string, params: UseParams): Promise<void>;
}
