/**
 * Enhanced Pino Logger Implementation for MCP Weather Server
 * Production-ready structured logging with full Pino integration
 */

import * as pino from 'pino';
import type { Logger as PinoLogger } from 'pino';
import { createRequire } from 'module';
import { getConfig } from './config/config.js';
import { VERSION } from './utils/version.js';

const require = createRequire(import.meta.url);

// Logger configuration types
export interface LoggerConfig {
  level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  pretty?: boolean;
  timestamp?: boolean;
}

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
export interface LogContext {
  [key: string]: any;
}

/**
 * Check if pino-pretty is available
 */
function isPinoPrettyAvailable(): boolean {
  try {
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

/**
 * Create and configure Pino logger instance
 */
function createPinoLogger(): PinoLogger {
  const config = getConfig();
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isStdioTransport = config.server.transport === 'stdio';

  const options: pino.LoggerOptions = {
    level: config.logging.level || 'info',
    formatters: {
      bindings: (bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
        service: 'mcp-weather-server',
        version: VERSION,
        environment: process.env.NODE_ENV || 'development'
      }),
      level: (label) => ({ level: label.toUpperCase() })
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: (req: any) => ({
        method: req.method,
        url: req.url,
        path: req.path,
        parameters: req.parameters,
        headers: req.headers,
        remoteAddress: req.ip || req.connection?.remoteAddress,
        remotePort: req.connection?.remotePort
      }),
      res: (res: any) => ({
        statusCode: res.statusCode,
        headers: res.getHeaders?.()
      })
    },
    base: {
      service: 'mcp-weather-server',
      version: VERSION
    }
  };

  // Add pretty printing in development (but not when using stdio transport)
  // Only use pino-pretty if available (it's a dev dependency)
  if (isDevelopment && !isStdioTransport && isPinoPrettyAvailable()) {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        levelFirst: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname',
        messageFormat: '{service} | {msg}',
        errorLikeObjectKeys: ['err', 'error'],
        errorProps: 'message,stack,code,statusCode'
      }
    };
  }

  // In stdio mode, logs must go to stderr to avoid interfering with JSON-RPC on stdout
  return isStdioTransport
    ? pino.pino(options, pino.destination({ dest: 2, sync: false }))  // 2 = stderr
    : pino.pino(options);
}

// Create the main Pino logger instance
const pinoLogger = createPinoLogger();

/**
 * Enhanced logger with specialized methods for MCP operations
 */
class EnhancedLogger {
  private pinoInstance: PinoLogger;
  private context: LogContext = {};

  constructor(pinoInstance?: PinoLogger, context?: LogContext) {
    this.pinoInstance = pinoInstance || pinoLogger;
    this.context = context || {};
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): EnhancedLogger {
    const childPino = this.pinoInstance.child(context);
    return new EnhancedLogger(childPino, { ...this.context, ...context });
  }

  /**
   * Core logging methods
   */
  fatal(message: string, context?: LogContext): void {
    this.pinoInstance.fatal({ ...this.context, ...context }, message);
    // Fatal errors should terminate the process in production
    if (process.env.NODE_ENV === 'production') {
      setTimeout(() => process.exit(1), 100); // Allow time for log to flush
    }
  }

  error(message: string, context?: LogContext): void {
    this.pinoInstance.error({ ...this.context, ...context }, message);
  }

  warn(message: string, context?: LogContext): void {
    this.pinoInstance.warn({ ...this.context, ...context }, message);
  }

  info(message: string, context?: LogContext): void {
    this.pinoInstance.info({ ...this.context, ...context }, message);
  }

  debug(message: string, context?: LogContext): void {
    this.pinoInstance.debug({ ...this.context, ...context }, message);
  }

  trace(message: string, context?: LogContext): void {
    this.pinoInstance.trace({ ...this.context, ...context }, message);
  }

  /**
   * Specialized logging methods for MCP operations
   */
  logMCPError(code: number, message: string, context?: LogContext): void {
    this.error('MCP Protocol Error', {
      type: 'mcp_error',
      code,
      message,
      ...context
    });
  }

  logError(error: Error, context?: LogContext): void {
    this.error('Application Error', {
      type: 'application_error',
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      ...context
    });
  }

  logMCPLifecycle(event: string, context?: LogContext): void {
    this.info(`MCP Lifecycle: ${event}`, {
      type: 'mcp_lifecycle',
      event,
      ...context
    });
  }

  logToolCall(name: string, args: any): void {
    this.debug(`Tool Call: ${name}`, {
      type: 'tool_call',
      tool: name,
      arguments: args
    });
  }

  logPerformance(operation: string, startTime: number, metadata?: LogContext): void {
    const duration = Date.now() - startTime;
    const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
    
    this[level](`Performance: ${operation}`, {
      type: 'performance',
      operation,
      duration_ms: duration,
      ...metadata
    });
  }

  logTransportEvent(event: string, context?: LogContext): void {
    this.info(`Transport: ${event}`, {
      type: 'transport_event',
      event,
      ...context
    });
  }

  logSecurityEvent(event: string, context?: LogContext): void {
    this.warn(`Security: ${event}`, {
      type: 'security_event',
      event,
      timestamp: new Date().toISOString(),
      ...context
    });
  }

  logMCPRequest(method: string, id: any, params: any): void {
    this.debug(`MCP Request: ${method}`, {
      type: 'mcp_request',
      method,
      id,
      params
    });
  }

  logAPIRequest(url: string, method: string, context?: LogContext): void {
    this.debug(`API Request: ${method} ${url}`, {
      type: 'api_request',
      url,
      method,
      ...context
    });
  }

  logAPIResponse(url: string, statusCode: number, latency: number, context?: LogContext): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    this[level](`API Response: ${statusCode} from ${url}`, {
      type: 'api_response',
      url,
      statusCode,
      latency_ms: latency,
      ...context
    });
  }

  /**
   * Check if a log level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return this.pinoInstance.isLevelEnabled(level);
  }

  /**
   * Flush logs (useful before process exit)
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      if ((this.pinoInstance as any).flush) {
        (this.pinoInstance as any).flush(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

// Create default logger instance
export const logger = new EnhancedLogger();

// Export the raw Pino instance for advanced usage
export const rawPinoLogger = pinoLogger;

// Export child logger factory
export const createChildLogger = (context: LogContext): EnhancedLogger => {
  return logger.child(context);
};

// Performance logging utility
export const startTimer = () => {
  const start = Date.now();
  return {
    end: (operation: string, metadata?: LogContext) => {
      logger.logPerformance(operation, start, metadata);
    }
  };
};

// Request logging middleware for Fastify
export const createRequestLogger = () => {
  return (req: any, res: any, next?: () => void) => {
    const startTime = Date.now();
    const requestId = req.id || req.headers?.['x-request-id'] || `req-${Date.now()}`;
    
    // Create child logger for this request
    const requestLogger = logger.child({ requestId, type: 'http_request' });
    
    // Log request
    requestLogger.info('Request received', {
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: req.headers,
      ip: req.ip || req.connection?.remoteAddress
    });

    // Attach logger to request for use in handlers
    req.log = requestLogger;

    // Log response when finished
    if (res && typeof res.on === 'function') {
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const level = res.statusCode >= 500 ? 'error' : 
                      res.statusCode >= 400 ? 'warn' : 'info';
        
        requestLogger[level]('Request completed', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration_ms: duration,
          responseSize: res.getHeader?.('content-length')
        });
      });
    }

    if (next) next();
  };
};

// Export Pino Logger type
export type { PinoLogger };

// Update logger configuration dynamically
export const updateLoggerConfig = (level: LogLevel): void => {
  pinoLogger.level = level;
  logger.info(`Logger level updated to: ${level}`);
};

// Graceful shutdown helper
export const gracefulShutdown = async (): Promise<void> => {
  logger.info('Flushing logs before shutdown...');
  await logger.flush();
};