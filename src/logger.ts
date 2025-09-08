import pino from 'pino';
import { getLoggingConfig } from './config/config.js';

/**
 * Structured logging utility using Pino
 * Provides consistent logging across the MCP Weather Server
 */
class Logger {
  private logger: pino.Logger;
  private config = getLoggingConfig();

  constructor() {
    this.logger = pino({
      level: this.config.level,
      formatters: {
        level: (label) => ({ level: label })
      },
      serializers: {
        error: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res
      },
      redact: this.config.redact || [],
      transport: this.config.pretty ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      } : undefined
    });
  }

  // Core logging methods
  public fatal(obj: any, msg?: string): void {
    this.logger.fatal(obj, msg);
  }

  public error(obj: any, msg?: string): void {
    this.logger.error(obj, msg);
  }

  public warn(obj: any, msg?: string): void {
    this.logger.warn(obj, msg);
  }

  public info(obj: any, msg?: string): void {
    this.logger.info(obj, msg);
  }

  public debug(obj: any, msg?: string): void {
    this.logger.debug(obj, msg);
  }

  public trace(obj: any, msg?: string): void {
    this.logger.trace(obj, msg);
  }

  // Specialized logging methods for MCP operations
  public logMCPLifecycle(event: string, details: any = {}): void {
    this.info({ event, ...details }, `MCP Lifecycle: ${event}`);
  }

  public logMCPRequest(method: string, id: string | number, params?: any): void {
    this.debug({ method, id, params }, `MCP Request: ${method}`);
  }

  public logMCPResponse(method: string, id: string | number, result?: any, error?: any): void {
    if (error) {
      this.error({ method, id, error }, `MCP Response Error: ${method}`);
    } else {
      this.debug({ method, id, result }, `MCP Response: ${method}`);
    }
  }

  public logToolCall(toolName: string, args: any, duration?: number): void {
    this.info({
      tool: toolName,
      args,
      duration: duration ? `${duration}ms` : undefined
    }, `Tool Call: ${toolName}`);
  }

  public logAPIRequest(url: string, method: string = 'GET', params?: any): void {
    this.debug({ url, method, params }, `API Request: ${method} ${url}`);
  }

  public logAPIResponse(url: string, status: number, duration: number, error?: any): void {
    const logData = { url, status, duration: `${duration}ms` };
    if (error) {
      this.error({ ...logData, error }, `API Response Error: ${status} ${url}`);
    } else {
      this.debug(logData, `API Response: ${status} ${url}`);
    }
  }

  public logTransportEvent(event: string, details: any = {}): void {
    this.info({ event, ...details }, `Transport Event: ${event}`);
  }

  public logSecurityEvent(event: string, details: any = {}): void {
    this.warn({ event, ...details }, `Security Event: ${event}`);
  }

  // Performance logging
  public logPerformance(operation: string, startTime: number, metadata?: any): void {
    const duration = Date.now() - startTime;
    this.info({
      operation,
      duration: `${duration}ms`,
      ...metadata
    }, `Performance: ${operation}`);
  }

  // Error logging with context
  public logError(error: Error, context?: any): void {
    this.error({
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      ...context
    }, `Error: ${error.message}`);
  }

  // MCP-specific error logging
  public logMCPError(code: number, message: string, details?: any): void {
    this.error({
      code,
      message,
      ...details
    }, `MCP Error ${code}: ${message}`);
  }

  // Get child logger with additional context
  public child(bindings: Record<string, any>): Logger {
    const childLogger = this.logger.child(bindings);
    const childInstance = Object.create(this);
    childInstance.logger = childLogger;
    return childInstance;
  }

  // Flush logs (useful for graceful shutdown)
  public async flush(): Promise<void> {
    await this.logger.flush();
  }
}

// Export singleton instance
export const logger = new Logger();

// Export the Logger class for testing or custom instances
export { Logger };
