export interface ZohoBooksLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export const consoleLogger: ZohoBooksLogger = {
  log: (message) => console.log(`[zohobooks] ${message}`),
  warn: (message) => console.warn(`[zohobooks] ${message}`),
  error: (message, ...args) => console.error(`[zohobooks] ${message}`, ...args),
  debug: (message, ...args) => console.debug(`[zohobooks] ${message}`, ...args),
};
