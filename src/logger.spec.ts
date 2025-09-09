import { Logger, logger } from './logger';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// Mock pino
vi.mock('pino', () => ({
  default: vi.fn(() => ({
    fatal: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => ({
      fatal: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      flush: vi.fn()
    })),
    flush: vi.fn()
  })),
  stdSerializers: {
    err: vi.fn(),
    req: vi.fn(),
    res: vi.fn()
  }
}));

// Mock config
vi.mock('./config/config', () => ({
  getLoggingConfig: vi.fn().mockReturnValue({
    level: 'info',
    pretty: false,
    redact: []
  })
}));

describe('Logger', () => {
  let mockPino: Mock;
  let testLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPino = vi.fn().mockReturnValue({
      fatal: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      child: vi.fn().mockReturnValue({
        fatal: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        flush: vi.fn()
      }),
      flush: vi.fn()
    });

    // Create a fresh logger instance for each test
    testLogger = new Logger();
  });

  describe('Core Logging Methods', () => {
    it('should call fatal with object and message', () => {
      const obj = { error: 'test' };
      const msg = 'Fatal error occurred';

      testLogger.fatal(obj, msg);

      expect(testLogger['logger'].fatal).toHaveBeenCalledWith(obj, msg);
    });

    it('should call error with object and message', () => {
      const obj = { error: 'test' };
      const msg = 'Error occurred';

      testLogger.error(obj, msg);

      expect(testLogger['logger'].error).toHaveBeenCalledWith(obj, msg);
    });

    it('should call warn with object and message', () => {
      const obj = { warning: 'test' };
      const msg = 'Warning occurred';

      testLogger.warn(obj, msg);

      expect(testLogger['logger'].warn).toHaveBeenCalledWith(obj, msg);
    });

    it('should call info with object and message', () => {
      const obj = { info: 'test' };
      const msg = 'Info message';

      testLogger.info(obj, msg);

      expect(testLogger['logger'].info).toHaveBeenCalledWith(obj, msg);
    });

    it('should call debug with object and message', () => {
      const obj = { debug: 'test' };
      const msg = 'Debug message';

      testLogger.debug(obj, msg);

      expect(testLogger['logger'].debug).toHaveBeenCalledWith(obj, msg);
    });

    it('should call trace with object and message', () => {
      const obj = { trace: 'test' };
      const msg = 'Trace message';

      testLogger.trace(obj, msg);

      expect(testLogger['logger'].trace).toHaveBeenCalledWith(obj, msg);
    });

    it('should handle logging with only object', () => {
      const obj = { message: 'test' };

      testLogger.info(obj);

      expect(testLogger['logger'].info).toHaveBeenCalledWith(obj, undefined);
    });
  });

  describe('MCP Lifecycle Logging', () => {
    it('should log MCP lifecycle events', () => {
      const event = 'initialize';
      const details = { version: '1.0.0' };

      testLogger.logMCPLifecycle(event, details);

      expect(testLogger['logger'].info).toHaveBeenCalledWith(
        { event, ...details },
        `MCP Lifecycle: ${event}`
      );
    });

    it('should log MCP lifecycle events with empty details', () => {
      const event = 'shutdown';

      testLogger.logMCPLifecycle(event);

      expect(testLogger['logger'].info).toHaveBeenCalledWith(
        { event },
        `MCP Lifecycle: ${event}`
      );
    });
  });

  describe('MCP Request/Response Logging', () => {
    it('should log MCP requests', () => {
      const method = 'tools/list';
      const id = '123';
      const params = { test: 'data' };

      testLogger.logMCPRequest(method, id, params);

      expect(testLogger['logger'].debug).toHaveBeenCalledWith(
        { method, id, params },
        `MCP Request: ${method}`
      );
    });

    it('should log MCP successful responses', () => {
      const method = 'tools/list';
      const id = '123';
      const result = { tools: [] };

      testLogger.logMCPResponse(method, id, result);

      expect(testLogger['logger'].debug).toHaveBeenCalledWith(
        { method, id, result },
        `MCP Response: ${method}`
      );
    });

    it('should log MCP error responses', () => {
      const method = 'tools/list';
      const id = '123';
      const error = { code: -32601, message: 'Method not found' };

      testLogger.logMCPResponse(method, id, undefined, error);

      expect(testLogger['logger'].error).toHaveBeenCalledWith(
        { method, id, error },
        `MCP Response Error: ${method}`
      );
    });
  });

  describe('Tool Call Logging', () => {
    it('should log tool calls with duration', () => {
      const toolName = 'get_weather';
      const args = { city: 'London' };
      const duration = 150;

      testLogger.logToolCall(toolName, args, duration);

      expect(testLogger['logger'].info).toHaveBeenCalledWith(
        {
          tool: toolName,
          args,
          duration: '150ms'
        },
        `Tool Call: ${toolName}`
      );
    });

    it('should log tool calls without duration', () => {
      const toolName = 'get_weather';
      const args = { city: 'London' };

      testLogger.logToolCall(toolName, args);

      expect(testLogger['logger'].info).toHaveBeenCalledWith(
        {
          tool: toolName,
          args,
          duration: undefined
        },
        `Tool Call: ${toolName}`
      );
    });
  });

  describe('API Request/Response Logging', () => {
    it('should log API requests with default method', () => {
      const url = 'https://api.example.com/weather';
      const params = { city: 'London' };

      testLogger.logAPIRequest(url, undefined, params);

      expect(testLogger['logger'].debug).toHaveBeenCalledWith(
        { url, method: 'GET', params },
        `API Request: GET ${url}`
      );
    });

    it('should log API requests with custom method', () => {
      const url = 'https://api.example.com/weather';
      const method = 'POST';
      const params = { city: 'London' };

      testLogger.logAPIRequest(url, method, params);

      expect(testLogger['logger'].debug).toHaveBeenCalledWith(
        { url, method, params },
        `API Request: POST ${url}`
      );
    });

    it('should log successful API responses', () => {
      const url = 'https://api.example.com/weather';
      const status = 200;
      const duration = 250;

      testLogger.logAPIResponse(url, status, duration);

      expect(testLogger['logger'].debug).toHaveBeenCalledWith(
        { url, status, duration: '250ms' },
        `API Response: 200 ${url}`
      );
    });

    it('should log API response errors', () => {
      const url = 'https://api.example.com/weather';
      const status = 500;
      const duration = 250;
      const error = { message: 'Internal Server Error' };

      testLogger.logAPIResponse(url, status, duration, error);

      expect(testLogger['logger'].error).toHaveBeenCalledWith(
        { url, status, duration: '250ms', error },
        `API Response Error: 500 ${url}`
      );
    });
  });

  describe('Transport and Security Logging', () => {
    it('should log transport events', () => {
      const event = 'connection_established';
      const details = { clientId: '123' };

      testLogger.logTransportEvent(event, details);

      expect(testLogger['logger'].info).toHaveBeenCalledWith(
        { event, ...details },
        `Transport Event: ${event}`
      );
    });

    it('should log security events', () => {
      const event = 'unauthorized_access';
      const details = { ip: '192.168.1.1' };

      testLogger.logSecurityEvent(event, details);

      expect(testLogger['logger'].warn).toHaveBeenCalledWith(
        { event, ...details },
        `Security Event: ${event}`
      );
    });
  });

  describe('Performance Logging', () => {
    it('should log performance with metadata', () => {
      const operation = 'get_weather';
      const startTime = Date.now() - 100;
      const metadata = { city: 'London' };

      testLogger.logPerformance(operation, startTime, metadata);

      const duration = Date.now() - startTime;
      expect(testLogger['logger'].info).toHaveBeenCalledWith(
        {
          operation,
          duration: expect.stringContaining('ms'),
          ...metadata
        },
        `Performance: ${operation}`
      );
    });

    it('should log performance without metadata', () => {
      const operation = 'get_weather';
      const startTime = Date.now() - 100;

      testLogger.logPerformance(operation, startTime);

      expect(testLogger['logger'].info).toHaveBeenCalledWith(
        {
          operation,
          duration: expect.stringContaining('ms')
        },
        `Performance: ${operation}`
      );
    });
  });

  describe('Error Logging', () => {
    it('should log errors with context', () => {
      const error = new Error('Test error');
      const context = { operation: 'get_weather' };

      testLogger.logError(error, context);

      expect(testLogger['logger'].error).toHaveBeenCalledWith(
        {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          },
          ...context
        },
        `Error: ${error.message}`
      );
    });

    it('should log errors without context', () => {
      const error = new Error('Test error');

      testLogger.logError(error);

      expect(testLogger['logger'].error).toHaveBeenCalledWith(
        {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack
          }
        },
        `Error: ${error.message}`
      );
    });
  });

  describe('MCP Error Logging', () => {
    it('should log MCP errors with details', () => {
      const code = -32601;
      const message = 'Method not found';
      const details = { method: 'unknown_method' };

      testLogger.logMCPError(code, message, details);

      expect(testLogger['logger'].error).toHaveBeenCalledWith(
        {
          code,
          message,
          ...details
        },
        `MCP Error ${code}: ${message}`
      );
    });

    it('should log MCP errors without details', () => {
      const code = -32602;
      const message = 'Invalid params';

      testLogger.logMCPError(code, message);

      expect(testLogger['logger'].error).toHaveBeenCalledWith(
        {
          code,
          message
        },
        `MCP Error ${code}: ${message}`
      );
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with bindings', () => {
      const bindings = { service: 'weather', version: '1.0.0' };

      const childLogger = testLogger.child(bindings);

      expect(testLogger['logger'].child).toHaveBeenCalledWith(bindings);
      expect(childLogger).toBeInstanceOf(Logger);
    });
  });

  describe('Flush Method', () => {
    it('should flush logs', async () => {
      await testLogger.flush();

      expect(testLogger['logger'].flush).toHaveBeenCalled();
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton logger instance', () => {
      expect(logger).toBeInstanceOf(Logger);
    });
  });
});
