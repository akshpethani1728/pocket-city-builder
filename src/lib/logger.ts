/** Minimal logger so future systems share one pattern. */
export const logger = {
  info(...args: unknown[]): void {
    console.info('[pocketopolis]', ...args);
  },
  warn(...args: unknown[]): void {
    console.warn('[pocketopolis]', ...args);
  },
  error(...args: unknown[]): void {
    console.error('[pocketopolis]', ...args);
  }
};

export function notImplemented(feature: string): never {
  throw new Error(`${feature} is not implemented yet (scheduled for a later phase).`);
}
