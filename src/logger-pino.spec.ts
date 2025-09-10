import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as pino from 'pino';
import { 
  logger,
  createChildLogger,
  startTimer,
  createRequestLogger,
  updateLoggerConfig,
  gracefulShutdown,
  rawPinoLogger
} from './logger-pino.js';

// Mock pino and config modules
vi.mock('pino', () => ({
  pino: vi.fn(() => ({
    fatal: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
    isLevelEnabled: vi.fn((level) => true),
    level: 'info',
    flush: vi.fn((cb) => cb && cb())
  })),
  stdSerializers: {
    err: vi.fn((err) => ({ ...err, stack: err.stack }))
  },
  stdTimeFunctions: {
    isoTime: vi.fn(() => () => new Date().toISOString())
  }
}));

vi.mock('./config/config.js', () => ({
  getConfig: vi.fn(() => ({
    logging: {
      level: 'info'
    }
  }))
}));

vi.mock('./utils/version.js', () => ({
  VERSION: '1.0.0-test'
}));

describe('Logger-Pino', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let exitSpy: any;
  let timeoutSpy: any;

  beforeEach(() => {
    originalEnv = { ...process.env };
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    timeoutSpy = vi.spyOn(global, 'setTimeout');
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    exitSpy.mockRestore();
    timeoutSpy.mockRestore();
  });

  describe('EnhancedLogger', () => {
    describe('Core logging methods', () => {
      it('should log fatal messages', () => {
        const message = 'Fatal error occurred';
        const context = { errorCode: 'FATAL_001' };
        
        logger.fatal(message, context);
        
        expect(rawPinoLogger.fatal).toHaveBeenCalledWith(
          expect.objectContaining(context),
          message
        );
      });

      it('should exit process on fatal in production', () => {
        process.env.NODE_ENV = 'production';
        
        logger.fatal('Fatal error');
        
        expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);
      });

      it('should not exit process on fatal in development', () => {
        process.env.NODE_ENV = 'development';
        
        logger.fatal('Fatal error');
        
        expect(timeoutSpy).not.toHaveBeenCalled();
      });

      it('should log error messages', () => {
        const message = 'An error occurred';
        const context = { errorCode: 'ERR_001' };
        
        logger.error(message, context);
        
        expect(rawPinoLogger.error).toHaveBeenCalledWith(
          expect.objectContaining(context),
          message
        );
      });

      it('should log warn messages', () => {
        const message = 'Warning message';
        const context = { warningType: 'deprecation' };
        
        logger.warn(message, context);
        
        expect(rawPinoLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining(context),
          message
        );
      });

      it('should log info messages', () => {
        const message = 'Information message';
        const context = { module: 'test' };
        
        logger.info(message, context);
        
        expect(rawPinoLogger.info).toHaveBeenCalledWith(
          expect.objectContaining(context),
          message
        );
      });

      it('should log debug messages', () => {
        const message = 'Debug message';
        const context = { debugLevel: 1 };
        
        logger.debug(message, context);
        
        expect(rawPinoLogger.debug).toHaveBeenCalledWith(
          expect.objectContaining(context),
          message
        );
      });

      it('should log trace messages', () => {
        const message = 'Trace message';
        const context = { traceId: '123' };
        
        logger.trace(message, context);
        
        expect(rawPinoLogger.trace).toHaveBeenCalledWith(
          expect.objectContaining(context),
          message
        );
      });
    });

    describe('Child logger', () => {
      it('should create child logger with additional context', () => {
        const childContext = { requestId: '123', userId: 'user1' };
        const childLogger = logger.child(childContext);
        
        expect(childLogger).toBeDefined();
        expect(rawPinoLogger.child).toHaveBeenCalledWith(childContext);
      });

      it('should merge parent and child context', () => {
        const parentContext = { service: 'weather' };
        const childContext = { requestId: '123' };
        
        const childLogger = createChildLogger(childContext);
        
        expect(childLogger).toBeDefined();
        expect(rawPinoLogger.child).toHaveBeenCalledWith(childContext);
      });
    });

    describe('Specialized MCP logging methods', () => {
      it('should log MCP errors', () => {
        const code = 404;
        const message = 'Not found';
        const context = { resource: '/weather' };
        
        logger.logMCPError(code, message, context);
        
        expect(rawPinoLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mcp_error',
            code,
            message,
            ...context
          }),
          'MCP Protocol Error'
        );
      });

      it('should log application errors', () => {
        const error = new Error('Test error');
        const context = { module: 'test' };
        
        logger.logError(error, context);
        
        expect(rawPinoLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'application_error',
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack,
            ...context
          }),
          'Application Error'
        );
      });

      it('should log MCP lifecycle events', () => {
        const event = 'server_started';
        const context = { port: 3000 };
        
        logger.logMCPLifecycle(event, context);
        
        expect(rawPinoLogger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mcp_lifecycle',
            event,
            ...context
          }),
          `MCP Lifecycle: ${event}`
        );
      });

      it('should log tool calls', () => {
        const toolName = 'get_weather';
        const args = { city: 'London' };
        
        logger.logToolCall(toolName, args);
        
        expect(rawPinoLogger.debug).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'tool_call',
            tool: toolName,
            arguments: args
          }),
          `Tool Call: ${toolName}`
        );
      });

      it('should log performance metrics with appropriate level', () => {
        const operation = 'database_query';
        
        // Fast operation (< 1000ms)
        logger.logPerformance(operation, Date.now() - 500, { query: 'SELECT *' });
        expect(rawPinoLogger.debug).toHaveBeenCalled();
        
        // Medium operation (1000-5000ms)
        logger.logPerformance(operation, Date.now() - 2000, { query: 'SELECT *' });
        expect(rawPinoLogger.info).toHaveBeenCalled();
        
        // Slow operation (> 5000ms)
        logger.logPerformance(operation, Date.now() - 6000, { query: 'SELECT *' });
        expect(rawPinoLogger.warn).toHaveBeenCalled();
      });

      it('should log transport events', () => {
        const event = 'connection_established';
        const context = { transport: 'http' };
        
        logger.logTransportEvent(event, context);
        
        expect(rawPinoLogger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'transport_event',
            event,
            ...context
          }),
          `Transport: ${event}`
        );
      });

      it('should log security events', () => {
        const event = 'unauthorized_access';
        const context = { ip: '192.168.1.1' };
        
        logger.logSecurityEvent(event, context);
        
        expect(rawPinoLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'security_event',
            event,
            timestamp: expect.any(String),
            ...context
          }),
          `Security: ${event}`
        );
      });

      it('should log MCP requests', () => {
        const method = 'tools/list';
        const id = 123;
        const params = { filter: 'weather' };
        
        logger.logMCPRequest(method, id, params);
        
        expect(rawPinoLogger.debug).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mcp_request',
            method,
            id,
            params
          }),
          `MCP Request: ${method}`
        );
      });

      it('should log API requests', () => {
        const url = 'https://api.weather.com/current';
        const method = 'GET';
        const context = { city: 'London' };
        
        logger.logAPIRequest(url, method, context);
        
        expect(rawPinoLogger.debug).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'api_request',
            url,
            method,
            ...context
          }),
          `API Request: ${method} ${url}`
        );
      });

      it('should log API responses with appropriate level', () => {
        const url = 'https://api.weather.com/current';
        
        // Success response (2xx)
        logger.logAPIResponse(url, 200, 150, { city: 'London' });
        expect(rawPinoLogger.info).toHaveBeenCalled();
        
        // Client error (4xx)
        logger.logAPIResponse(url, 404, 100, { city: 'Unknown' });
        expect(rawPinoLogger.warn).toHaveBeenCalled();
        
        // Server error (5xx)
        logger.logAPIResponse(url, 500, 200, { error: 'Internal' });
        expect(rawPinoLogger.error).toHaveBeenCalled();
      });
    });

    describe('Utility methods', () => {
      it('should check if log level is enabled', () => {
        const result = logger.isLevelEnabled('debug');
        
        expect(result).toBe(true);
        expect(rawPinoLogger.isLevelEnabled).toHaveBeenCalledWith('debug');
      });

      it('should flush logs', async () => {
        await logger.flush();
        
        expect(rawPinoLogger.flush).toHaveBeenCalled();
      });

      it('should handle flush when method not available', async () => {
        const mockLogger = {
          ...rawPinoLogger,
          flush: undefined
        };
        
        const testLogger = new (logger as any).constructor(mockLogger);
        await expect(testLogger.flush()).resolves.toBeUndefined();
      });
    });
  });

  describe('Timer utility', () => {
    it('should measure operation performance', () => {
      vi.useFakeTimers();
      const timer = startTimer();
      
      vi.advanceTimersByTime(1500);
      timer.end('test_operation', { extra: 'data' });
      
      expect(rawPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'performance',
          operation: 'test_operation',
          duration_ms: expect.any(Number),
          extra: 'data'
        }),
        'Performance: test_operation'
      );
      
      vi.useRealTimers();
    });
  });

  describe('Request logger middleware', () => {
    it('should create request logger middleware', () => {
      const middleware = createRequestLogger();
      
      expect(middleware).toBeInstanceOf(Function);
    });

    it('should log request and response', () => {
      const middleware = createRequestLogger();
      const req = {
        method: 'GET',
        url: '/api/weather',
        path: '/api/weather',
        query: { city: 'London' },
        headers: { 'content-type': 'application/json' },
        ip: '127.0.0.1'
      };
      const res = {
        statusCode: 200,
        on: vi.fn((event, handler) => {
          if (event === 'finish') {
            handler();
          }
        }),
        getHeader: vi.fn(() => '1234')
      };
      const next = vi.fn();
      
      middleware(req, res, next);
      
      expect(rawPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/api/weather'
        }),
        'Request received'
      );
      
      expect(next).toHaveBeenCalled();
      expect(req.log).toBeDefined();
      
      // Trigger finish event
      expect(rawPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200
        }),
        'Request completed'
      );
    });

    it('should handle request without response object', () => {
      const middleware = createRequestLogger();
      const req = {
        method: 'GET',
        url: '/api/weather'
      };
      const next = vi.fn();
      
      expect(() => middleware(req, null, next)).not.toThrow();
      expect(next).toHaveBeenCalled();
    });

    it('should log error level for 5xx responses', () => {
      const middleware = createRequestLogger();
      const req = { method: 'GET', url: '/api/weather' };
      const res = {
        statusCode: 500,
        on: vi.fn((event, handler) => {
          if (event === 'finish') handler();
        })
      };
      
      middleware(req, res);
      
      expect(rawPinoLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500
        }),
        'Request completed'
      );
    });

    it('should log warn level for 4xx responses', () => {
      const middleware = createRequestLogger();
      const req = { method: 'GET', url: '/api/weather' };
      const res = {
        statusCode: 404,
        on: vi.fn((event, handler) => {
          if (event === 'finish') handler();
        })
      };
      
      middleware(req, res);
      
      expect(rawPinoLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404
        }),
        'Request completed'
      );
    });

    it('should generate request ID if not provided', () => {
      const middleware = createRequestLogger();
      const req = { method: 'GET', url: '/api/weather' };
      
      middleware(req, null);
      
      expect(rawPinoLogger.child).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: expect.stringMatching(/^req-\d+$/)
        })
      );
    });

    it('should use existing request ID from headers', () => {
      const middleware = createRequestLogger();
      const req = {
        method: 'GET',
        url: '/api/weather',
        headers: { 'x-request-id': 'custom-id-123' }
      };
      
      middleware(req, null);
      
      expect(rawPinoLogger.child).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'custom-id-123'
        })
      );
    });
  });

  describe('Configuration updates', () => {
    it('should update logger level', () => {
      updateLoggerConfig('debug');
      
      expect(rawPinoLogger.level).toBe('debug');
      expect(rawPinoLogger.info).toHaveBeenCalledWith(
        expect.any(Object),
        'Logger level updated to: debug'
      );
    });
  });

  describe('Graceful shutdown', () => {
    it('should flush logs on shutdown', async () => {
      await gracefulShutdown();
      
      expect(rawPinoLogger.info).toHaveBeenCalledWith(
        expect.any(Object),
        'Flushing logs before shutdown...'
      );
      expect(rawPinoLogger.flush).toHaveBeenCalled();
    });
  });

  describe('Logger configuration', () => {
    it('should create logger with correct configuration', () => {
      // Re-import to ensure pino is called
      vi.resetModules();
      vi.doMock('pino', () => ({
        pino: vi.fn(() => ({
          fatal: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          info: vi.fn(),
          debug: vi.fn(),
          trace: vi.fn(),
          child: vi.fn().mockReturnThis(),
          isLevelEnabled: vi.fn(() => true),
          level: 'info',
          flush: vi.fn((cb) => cb && cb())
        })),
        stdSerializers: {
          err: vi.fn((err) => ({ ...err, stack: err.stack }))
        },
        stdTimeFunctions: {
          isoTime: vi.fn(() => () => new Date().toISOString())
        }
      }));
      
      return import('./logger-pino.js').then(() => {
        const { pino: pinoMock } = require('pino');
        expect(pinoMock).toHaveBeenCalledWith(
          expect.objectContaining({
            level: 'info',
            base: {
              service: 'mcp-weather-server',
              version: '1.0.0-test'
            }
          })
        );
      });
    });

    it('should add pretty printing in development', () => {
      process.env.NODE_ENV = 'development';
      
      // Re-import to trigger logger creation with new env
      vi.resetModules();
      vi.doMock('./config/config.js', () => ({
        getConfig: vi.fn(() => ({
          logging: { level: 'info' }
        }))
      }));
      
      import('./logger-pino.js').then(() => {
        expect(pino.pino).toHaveBeenCalledWith(
          expect.objectContaining({
            transport: expect.objectContaining({
              target: 'pino-pretty'
            })
          })
        );
      });
    });
  });
});