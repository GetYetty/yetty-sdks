export interface RubyPayeurLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export const consoleLogger: RubyPayeurLogger = {
  log: (message) => console.log(`[rubypayeur] ${message}`),
  warn: (message) => console.warn(`[rubypayeur] ${message}`),
  error: (message) => console.error(`[rubypayeur] ${message}`),
};
