/**
 * Centralized logging configuration for MCP Weather Server
 * Simple console-based logger for initial implementation
 */

// Simple logger interface
interface Logger {
  // eslint-disable-next-line no-unused-vars
  fatal: (message: string, ...args: unknown[]) => void;
  // eslint-disable-next-line no-unused-vars
  error: (message: string, ...args: unknown[]) => void;
  // eslint-disable-next-line no-unused-vars
  warn: (message: string, ...args: unknown[]) => void;
  // eslint-disable-next-line no-unused-vars
  info: (message: string, ...args: unknown[]) => void;
  // eslint-disable-next-line no-unused-vars
  debug: (message: string, ...args: unknown[]) => void;
  // eslint-disable-next-line no-unused-vars
  trace: (message: string, ...args: unknown[]) => void;
}

// Create simple console logger
const createLogger = (): Logger => {
  const timestamp = () => new Date().toISOString();

  return {
    fatal: (_message: string, ..._args: unknown[]) => console.error(`[${timestamp()}] FATAL:`, _message, ..._args),
    error: (_message: string, ..._args: unknown[]) => console.error(`[${timestamp()}] ERROR:`, _message, ..._args),
    warn: (_message: string, ..._args: unknown[]) => console.warn(`[${timestamp()}] WARN:`, _message, ..._args),
    info: (_message: string, ..._args: unknown[]) => console.log(`[${timestamp()}] INFO:`, _message, ..._args),
    debug: (_message: string, ..._args: unknown[]) => console.debug(`[${timestamp()}] DEBUG:`, _message, ..._args),
    trace: (_message: string, ..._args: unknown[]) => console.trace(`[${timestamp()}] TRACE:`, _message, ..._args),
  };
};

// Initialize logger
const logger = createLogger();

// Function to update logger configuration (placeholder for future Pino integration)
export const updateLoggerConfig = () => {
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
export const createChildLogger = (bindings: Record<string, unknown>) => {
  const childLogger = createLogger();
  const prefix = Object.entries(bindings).map(([k, v]) => `${k}=${v}`).join(' ');

  return {
    fatal: (_message: string, ..._args: unknown[]) => childLogger.fatal(`[${prefix}] ${_message}`, ..._args),
    error: (_message: string, ..._args: unknown[]) => childLogger.error(`[${prefix}] ${_message}`, ..._args),
    warn: (_message: string, ..._args: unknown[]) => childLogger.warn(`[${prefix}] ${_message}`, ..._args),
    info: (_message: string, ..._args: unknown[]) => childLogger.info(`[${prefix}] ${_message}`, ..._args),
    debug: (_message: string, ..._args: unknown[]) => childLogger.debug(`[${prefix}] ${_message}`, ..._args),
    trace: (_message: string, ..._args: unknown[]) => childLogger.trace(`[${prefix}] ${_message}`, ..._args),
  };
};

// Performance logging utilities
export const logPerformance = (operation: string, startTime: number, metadata?: Record<string, unknown>) => {
  const duration = Date.now() - startTime;
  logger.info(`Operation completed: ${operation}`, { duration, performance: true, ...metadata });
};

// Error logging with context
export const logError = (error: Error, context?: Record<string, unknown>) => {
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
export const logRequest = (req: Record<string, unknown>, res: Record<string, unknown>, next?: () => void) => {
  const startTime = Date.now();
  const requestId = (req.id as string) || (req.headers as Record<string, unknown>)?.['x-request-id'] as string || 'unknown';

  logger.info('Request received', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: (req.headers as Record<string, unknown>)?.['user-agent'],
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

  if (next) {
    next();
  }
};
