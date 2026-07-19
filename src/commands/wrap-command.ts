/**
 * Wrap a Commander action handler with unified error handling.
 * Catches any thrown error, prints "❌ Error: {message}", and exits with code 1.
 */
export function wrapCommand<T extends unknown[]>(
  fn: (...args: T) => Promise<void>,
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (error) {
      console.error(
        "❌ Error:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  };
}
