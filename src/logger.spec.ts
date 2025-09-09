import { Logger, logger } from './logger';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the config to prevent issues
vi.mock('./config/config.js', () => ({
  getConfig: () => ({
    logging: {
      level: 'info',
      pretty: false,
      redact: ['password', 'token']
    }
  }),
  getLoggingConfig: () => ({
    level: 'info',
    pretty: false,
    redact: ['password', 'token']
  })
}));

describe('Logger', () => {
  let testLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a fresh logger instance for each test
    testLogger = new Logger();
  });

  describe('Logger Instance Creation', () => {
    it('should create a logger instance', () => {
      expect(testLogger).toBeDefined();
      expect(testLogger).toBeInstanceOf(Logger);
    });

    it('should have logger property', () => {
      expect(testLogger['logger']).toBeDefined();
    });
  });

  describe('Core Logging Methods', () => {
    it('should have fatal method', () => {
      expect(typeof testLogger.fatal).toBe('function');
      expect(() => testLogger.fatal('test message')).not.toThrow();
    });

    it('should have error method', () => {
      expect(typeof testLogger.error).toBe('function');
      expect(() => testLogger.error('test message')).not.toThrow();
    });

    it('should have warn method', () => {
      expect(typeof testLogger.warn).toBe('function');
      expect(() => testLogger.warn('test message')).not.toThrow();
    });

    it('should have info method', () => {
      expect(typeof testLogger.info).toBe('function');
      expect(() => testLogger.info('test message')).not.toThrow();
    });

    it('should have debug method', () => {
      expect(typeof testLogger.debug).toBe('function');
      expect(() => testLogger.debug('test message')).not.toThrow();
    });

    it('should have trace method', () => {
      expect(typeof testLogger.trace).toBe('function');
      expect(() => testLogger.trace('test message')).not.toThrow();
    });

    it('should handle logging with objects', () => {
      const testObj = { key: 'value', number: 42 };
      expect(() => testLogger.info(testObj, 'message')).not.toThrow();
      expect(() => testLogger.error({ error: 'test' }, 'error occurred')).not.toThrow();
    });

    it('should handle logging with multiple arguments', () => {
      expect(() => testLogger.info('message', { data: 'test' }, [1, 2, 3])).not.toThrow();
    });
  });

  describe('MCP Lifecycle Logging', () => {
    it('should have logMCPLifecycle method', () => {
      expect(typeof testLogger.logMCPLifecycle).toBe('function');
    });
  });

  describe('MCP Request/Response Logging', () => {
    it('should have logMCPRequest method', () => {
      expect(typeof testLogger.logMCPRequest).toBe('function');
    });

    it('should have logMCPResponse method', () => {
      expect(typeof testLogger.logMCPResponse).toBe('function');
    });
  });

  describe('Tool Call Logging', () => {
    it('should have logToolCall method', () => {
      expect(typeof testLogger.logToolCall).toBe('function');
    });
  });

  describe('API Request/Response Logging', () => {
    it('should have logAPIRequest method', () => {
      expect(typeof testLogger.logAPIRequest).toBe('function');
    });

    it('should have logAPIResponse method', () => {
      expect(typeof testLogger.logAPIResponse).toBe('function');
    });
  });

  describe('Transport and Security Logging', () => {
    it('should have logTransportEvent method', () => {
      expect(typeof testLogger.logTransportEvent).toBe('function');
    });

    it('should have logSecurityEvent method', () => {
      expect(typeof testLogger.logSecurityEvent).toBe('function');
    });
  });

  describe('Performance Logging', () => {
    it('should have logPerformance method', () => {
      expect(typeof testLogger.logPerformance).toBe('function');
    });
  });

  describe('Error Logging', () => {
    it('should have logError method', () => {
      expect(typeof testLogger.logError).toBe('function');
    });

    it('should have logMCPError method', () => {
      expect(typeof testLogger.logMCPError).toBe('function');
    });
  });

  describe('Child Logger', () => {
    it('should have child method', () => {
      expect(typeof testLogger.child).toBe('function');
    });
  });

  describe('Flush Method', () => {
    it('should have flush method', () => {
      expect(typeof testLogger.flush).toBe('function');
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger).toBeInstanceOf(Logger);
    });
  });
});
