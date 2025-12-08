
/**
 * Simple Logger Utility
 * Wraps console methods with timestamps and consistent formatting.
 * Can be easily replaced with Winston/Pino in the future.
 */
const logger = {
  info: (msg, ...args) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, ...args);
  },
  error: (msg, ...args) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, ...args);
  },
  warn: (msg, ...args) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, ...args);
  },
  debug: (msg, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${msg}`, ...args);
    }
  }
};

export default logger;
