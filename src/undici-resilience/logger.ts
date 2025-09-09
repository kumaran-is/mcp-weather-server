/**
 * Centralized logging configuration for MCP Weather Server
 * Simple console-based logger for initial implementation
 */

// Simple logger interface
interface Logger {
  fatal: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
  trace: (message: string, ...args: any[]) => void;
}

// Create simple console logger
const createLogger = (): Logger => {
  const timestamp = () => new Date().toISOString();

  return {
    fatal: (message: string, ...args: any[]) => console.error(`[${timestamp()}] FATAL:`, message, ...args),
    error: (message: string, ...args: any[]) => console.error(`[${timestamp()}] ERROR:`, message, ...args),
    warn: (message: string, ...args: any[]) => console.warn(`[${timestamp()}] WARN:`, message, ...args),
    info: (message: string, ...args: any[]) => console.log(`[${timestamp()}] INFO:`, message, ...args),
    debug: (message: string, ...args: any[]) => console.debug(`[${timestamp()}] DEBUG:`, message, ...args),
    trace: (message: string, ...args: any[]) => console.trace(`[${timestamp()}] TRACE:`, message, ...args),
  };
};

// Initialize logger
const logger = createLogger();

// Function to update logger configuration (placeholder for future Pino integration)
export const updateLoggerConfig = (level: string) => {
  // Placeholder - will be implemented when Pino is properly configured
};

// Export logger instance
export { logger };

// Export logger methods for convenience
export const log = {
  fatal: logger.fatal.bind(logger),
  error: logger.error.bind(logger),
  warn: logger.warn.bind(logger),
  info: logger.info.bind(logger),
  debug: logger.debug.bind(logger),
  trace: logger.trace.bind(logger),
};

// Child logger factory for different components (simplified)
export const createChildLogger = (bindings: Record<string, any>) => {
  const childLogger = createLogger();
  const prefix = Object.entries(bindings).map(([k, v]) => `${k}=${v}`).join(' ');

  return {
    fatal: (message: string, ...args: any[]) => childLogger.fatal(`[${prefix}] ${message}`, ...args),
    error: (message: string, ...args: any[]) => childLogger.error(`[${prefix}] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => childLogger.warn(`[${prefix}] ${message}`, ...args),
    info: (message: string, ...args: any[]) => childLogger.info(`[${prefix}] ${message}`, ...args),
    debug: (message: string, ...args: any[]) => childLogger.debug(`[${prefix}] ${message}`, ...args),
    trace: (message: string, ...args: any[]) => childLogger.trace(`[${prefix}] ${message}`, ...args),
  };
};

// Performance logging utilities
export const logPerformance = (operation: string, startTime: number, metadata?: Record<string, any>) => {
  const duration = Date.now() - startTime;
  logger.info(`Operation completed: ${operation}`, { duration, performance: true, ...metadata });
};

// Error logging with context
export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error('Error occurred', {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    ...context,
  });
};

// Request logging middleware helper (simplified)
export const logRequest = (req: any, res: any, next?: () => void) => {
  const startTime = Date.now();
  const requestId = req.id || req.headers['x-request-id'] || 'unknown';

  logger.info('Request received', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers?.['user-agent'],
    ip: req.ip,
  });

  // Log response when finished
  if (res && typeof res.on === 'function') {
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info('Request completed', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
      });
    });
  }

  if (next) next();
};
