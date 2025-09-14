import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateJSONRPC,
  validateInitializeRequest,
  validateToolCallRequest,
  validateHTTPHeaders,
  sanitizeInput,
  createValidationMiddleware,
  RateLimitValidator,
  rateLimiter,
} from './validation.js';
import { ValidationError, MCPProtocolError } from '../errors/weather-errors.js';

// Mock the logger
vi.mock('../logger-pino.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Validation Middleware', () => {
  describe('validateJSONRPC', () => {
    it('should validate valid JSON-RPC request', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'test',
        id: '123',
      };

      expect(() => validateJSONRPC(request)).not.toThrow();
    });

    it('should throw error for missing jsonrpc field', () => {
      const request = {
        method: 'test',
        id: '123',
      };

      expect(() => validateJSONRPC(request)).toThrow(MCPProtocolError);
      expect(() => validateJSONRPC(request)).toThrow('Invalid JSON-RPC version');
    });

    it('should throw error for invalid jsonrpc version', () => {
      const request = {
        jsonrpc: '1.0',
        method: 'test',
        id: '123',
      };

      expect(() => validateJSONRPC(request)).toThrow(MCPProtocolError);
      expect(() => validateJSONRPC(request)).toThrow('Invalid JSON-RPC version');
    });

    it('should throw error for missing method', () => {
      const request = {
        jsonrpc: '2.0',
        id: '123',
      };

      expect(() => validateJSONRPC(request)).toThrow(ValidationError);
      expect(() => validateJSONRPC(request)).toThrow('Method must be a non-empty string');
    });

    it('should throw error for empty method', () => {
      const request = {
        jsonrpc: '2.0',
        method: '',
        id: '123',
      };

      expect(() => validateJSONRPC(request)).toThrow(ValidationError);
      expect(() => validateJSONRPC(request)).toThrow('Method must be a non-empty string');
    });

    it('should throw error for invalid id type', () => {
      const request = {
        jsonrpc: '2.0',
        method: 'test',
        id: true,
      };

      expect(() => validateJSONRPC(request)).toThrow(ValidationError);
      expect(() => validateJSONRPC(request)).toThrow('ID must be a string, number, or null');
    });

    it('should accept valid id types', () => {
      const requests = [
        { jsonrpc: '2.0', method: 'test', id: 'string-id' },
        { jsonrpc: '2.0', method: 'test', id: 123 },
        { jsonrpc: '2.0', method: 'test', id: null },
        { jsonrpc: '2.0', method: 'test' }, // no id field
      ];

      requests.forEach(request => {
        expect(() => validateJSONRPC(request)).not.toThrow();
      });
    });

    it('should throw error for non-object request', () => {
      expect(() => validateJSONRPC(null)).toThrow(MCPProtocolError);
      expect(() => validateJSONRPC('string')).toThrow(MCPProtocolError);
      expect(() => validateJSONRPC(123)).toThrow(MCPProtocolError);
    });
  });

  describe('validateInitializeRequest', () => {
    it('should validate valid initialize request', () => {
      const params = {
        protocolVersion: '2025-06-18',
        capabilities: { sampling: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' },
      };

      expect(() => validateInitializeRequest(params)).not.toThrow();
    });

    it('should throw error for missing params', () => {
      expect(() => validateInitializeRequest(null)).toThrow(ValidationError);
      expect(() => validateInitializeRequest(undefined)).toThrow(ValidationError);
    });

    it('should throw error for missing protocolVersion', () => {
      const params = {
        capabilities: { sampling: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' },
      };

      expect(() => validateInitializeRequest(params)).toThrow(ValidationError);
      expect(() => validateInitializeRequest(params)).toThrow('Protocol version is required');
    });

    it('should throw error for missing capabilities', () => {
      const params = {
        protocolVersion: '2025-06-18',
        clientInfo: { name: 'test-client', version: '1.0.0' },
      };

      expect(() => validateInitializeRequest(params)).toThrow(ValidationError);
      expect(() => validateInitializeRequest(params)).toThrow('Capabilities are required');
    });

    it('should throw error for missing clientInfo', () => {
      const params = {
        protocolVersion: '2025-06-18',
        capabilities: { sampling: {} },
      };

      expect(() => validateInitializeRequest(params)).toThrow(ValidationError);
      expect(() => validateInitializeRequest(params)).toThrow('Client info is required');
    });

    it('should throw error for incomplete clientInfo', () => {
      const params = {
        protocolVersion: '2025-06-18',
        capabilities: { sampling: {} },
        clientInfo: { name: 'test-client' }, // missing version
      };

      expect(() => validateInitializeRequest(params)).toThrow(ValidationError);
      expect(() => validateInitializeRequest(params)).toThrow('Client info must include name and version');
    });
  });

  describe('validateToolCallRequest', () => {
    it('should validate get_current_weather tool call', () => {
      const params = {
        name: 'get_current_weather',
        arguments: { city: 'London' },
      };

      expect(() => validateToolCallRequest(params)).not.toThrow();
    });

    it('should validate get_forecast tool call', () => {
      const params = {
        name: 'get_forecast',
        arguments: { city: 'London', days: 5 },
      };

      expect(() => validateToolCallRequest(params)).not.toThrow();
    });

    it('should validate analyze_weather_query tool call', () => {
      const params = {
        name: 'analyze_weather_query',
        arguments: { query: 'weather in London' },
      };

      expect(() => validateToolCallRequest(params)).not.toThrow();
    });

    it('should throw error for missing params', () => {
      expect(() => validateToolCallRequest(null)).toThrow(ValidationError);
      expect(() => validateToolCallRequest(undefined)).toThrow(ValidationError);
    });

    it('should throw error for missing tool name', () => {
      const params = {
        arguments: { city: 'London' },
      };

      expect(() => validateToolCallRequest(params)).toThrow(ValidationError);
      expect(() => validateToolCallRequest(params)).toThrow('Tool name must be a non-empty string');
    });

    it('should throw error for empty tool name', () => {
      const params = {
        name: '',
        arguments: { city: 'London' },
      };

      expect(() => validateToolCallRequest(params)).toThrow(ValidationError);
      expect(() => validateToolCallRequest(params)).toThrow('Tool name must be a non-empty string');
    });

    it('should throw error for unknown tool', () => {
      const params = {
        name: 'unknown_tool',
        arguments: {},
      };

      expect(() => validateToolCallRequest(params)).toThrow(ValidationError);
      expect(() => validateToolCallRequest(params)).toThrow('Unknown tool: unknown_tool');
    });

    describe('Weather tool validation', () => {
      it('should throw error for missing city', () => {
        const params = {
          name: 'get_current_weather',
          arguments: {},
        };

        expect(() => validateToolCallRequest(params)).toThrow(ValidationError);
        expect(() => validateToolCallRequest(params)).toThrow('City must be a non-empty string');
      });

      it('should throw error for empty city', () => {
        const params = {
          name: 'get_current_weather',
          arguments: { city: '   ' },
        };

        expect(() => validateToolCallRequest(params)).toThrow(ValidationError);
        expect(() => validateToolCallRequest(params)).toThrow('City cannot be empty or whitespace');
      });

      it('should throw error for city too long', () => {
        const params = {
          name: 'get_current_weather',
          arguments: { city: 'x'.repeat(101) },
        };

        expect(() => validateToolCallRequest(params)).toThrow(ValidationError);
        expect(() => validateToolCallRequest(params)).toThrow('City name is too long');
      });
    });

    describe('Forecast tool validation', () => {
      it('should throw error for invalid days type', () => {
        const params = {
          name: 'get_forecast',
          arguments: { city: 'London', days: 'five' },
        };

        expect(() => validateToolCallRequest(params)).toThrow(ValidationError);
        expect(() => validateToolCallRequest(params)).toThrow('Days must be a number');
      });

      it('should throw error for non-integer days', () => {
        const params = {
          name: 'get_forecast',
          arguments: { city: 'London', days: 3.5 },
        };

        expect(() => validateToolCallRequest(params)).toThrow(ValidationError);
        expect(() => validateToolCallRequest(params)).toThrow('Days must be an integer');
      });

      it('should throw error for days out of range', () => {
        const params1 = {
          name: 'get_forecast',
          arguments: { city: 'London', days: 0 },
        };
        const params2 = {
          name: 'get_forecast',
          arguments: { city: 'London', days: 8 },
        };

        expect(() => validateToolCallRequest(params1)).toThrow(ValidationError);
        expect(() => validateToolCallRequest(params1)).toThrow('Days must be between 1 and 7');
        expect(() => validateToolCallRequest(params2)).toThrow(ValidationError);
        expect(() => validateToolCallRequest(params2)).toThrow('Days must be between 1 and 7');
      });
    });

    describe('Analyze query validation', () => {
      it('should throw error for missing query', () => {
        const params = {
          name: 'analyze_weather_query',
          arguments: {},
        };

        expect(() => validateToolCallRequest(params)).toThrow(ValidationError);
        expect(() => validateToolCallRequest(params)).toThrow('Query must be a non-empty string');
      });

      it('should throw error for empty query', () => {
        const params = {
          name: 'analyze_weather_query',
          arguments: { query: '   ' },
        };

        expect(() => validateToolCallRequest(params)).toThrow(ValidationError);
        expect(() => validateToolCallRequest(params)).toThrow('Query cannot be empty or whitespace');
      });

      it('should throw error for query too long', () => {
        const params = {
          name: 'analyze_weather_query',
          arguments: { query: 'x'.repeat(1001) },
        };

        expect(() => validateToolCallRequest(params)).toThrow(ValidationError);
        expect(() => validateToolCallRequest(params)).toThrow('Query is too long');
      });
    });
  });

  describe('validateHTTPHeaders', () => {
    it('should validate valid headers', () => {
      const headers = {
        'content-type': 'application/json',
      };

      expect(() => validateHTTPHeaders(headers)).not.toThrow();
    });

    it('should validate headers with charset', () => {
      const headers = {
        'content-type': 'application/json; charset=utf-8',
      };

      expect(() => validateHTTPHeaders(headers)).not.toThrow();
    });

    it('should throw error for invalid content-type', () => {
      const headers = {
        'content-type': 'text/plain',
      };

      expect(() => validateHTTPHeaders(headers)).toThrow(ValidationError);
      expect(() => validateHTTPHeaders(headers)).toThrow('Content-Type must be application/json');
    });

    it('should throw error for missing content-type', () => {
      const headers = {};

      expect(() => validateHTTPHeaders(headers)).toThrow(ValidationError);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove control characters', () => {
      const input = 'Hello\x00\x08\x0B\x0CWorld\x0E\x1F\x7F';
      const result = sanitizeInput(input);
      expect(result).toBe('HelloWorld');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = sanitizeInput(input);
      expect(result).toBe('Hello World');
    });

    it('should limit length to 1000 characters', () => {
      const input = 'x'.repeat(1500);
      const result = sanitizeInput(input);
      expect(result.length).toBe(1000);
      expect(result).toBe('x'.repeat(1000));
    });

    it('should handle empty string', () => {
      const result = sanitizeInput('');
      expect(result).toBe('');
    });

    it('should handle normal strings unchanged', () => {
      const input = 'Hello World 123';
      const result = sanitizeInput(input);
      expect(result).toBe(input);
    });
  });

  describe('createValidationMiddleware', () => {
    it('should create middleware for stdio transport', async () => {
      const middleware = createValidationMiddleware('stdio');
      expect(typeof middleware).toBe('function');
    });

    it('should create middleware for http transport', async () => {
      const middleware = createValidationMiddleware('http');
      expect(typeof middleware).toBe('function');
    });

      expect(typeof middleware).toBe('function');
    });

    it('should validate initialize method', async () => {
      const middleware = createValidationMiddleware('stdio');
      const request = {
        jsonrpc: '2.0',
        method: 'initialize',
        id: '123',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' },
        },
      };

      await expect(middleware(request)).resolves.not.toThrow();
    });

    it('should validate tools/call method', async () => {
      const middleware = createValidationMiddleware('stdio');
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        id: '123',
        params: {
          name: 'get_current_weather',
          arguments: { city: 'London' },
        },
      };

      await expect(middleware(request)).resolves.not.toThrow();
    });

    it('should allow unknown methods', async () => {
      const middleware = createValidationMiddleware('stdio');
      const request = {
        jsonrpc: '2.0',
        method: 'unknown/method',
        id: '123',
      };

      await expect(middleware(request)).resolves.not.toThrow();
    });

    it('should handle validation errors', async () => {
      const middleware = createValidationMiddleware('stdio');
      const request = {
        method: 'initialize', // missing jsonrpc
        id: '123',
      };

      await expect(middleware(request)).rejects.toThrow(MCPProtocolError);
    });
  });

  describe('RateLimitValidator', () => {
    let rateLimitValidator: RateLimitValidator;

    beforeEach(() => {
      rateLimitValidator = new RateLimitValidator(3, 1000); // 3 requests per second
    });

    it('should allow requests under limit', () => {
      expect(rateLimitValidator.shouldRateLimit('client1')).toBe(false);
      expect(rateLimitValidator.shouldRateLimit('client1')).toBe(false);
      expect(rateLimitValidator.shouldRateLimit('client1')).toBe(false);
    });

    it('should rate limit requests over limit', () => {
      // Use up the limit
      rateLimitValidator.shouldRateLimit('client1');
      rateLimitValidator.shouldRateLimit('client1');
      rateLimitValidator.shouldRateLimit('client1');

      // This should be rate limited
      expect(rateLimitValidator.shouldRateLimit('client1')).toBe(true);
    });

    it('should handle different clients separately', () => {
      rateLimitValidator.shouldRateLimit('client1');
      rateLimitValidator.shouldRateLimit('client1');
      rateLimitValidator.shouldRateLimit('client1');

      // Client1 should be rate limited
      expect(rateLimitValidator.shouldRateLimit('client1')).toBe(true);

      // Client2 should not be rate limited
      expect(rateLimitValidator.shouldRateLimit('client2')).toBe(false);
    });

    it('should reset limits after window', async () => {
      const validator = new RateLimitValidator(1, 50); // 1 request per 50ms

      validator.shouldRateLimit('client1');
      expect(validator.shouldRateLimit('client1')).toBe(true);

      // Mock time advancing instead of using setTimeout
      const originalNow = Date.now;
      const mockNow = 1000000;
      Date.now = vi.fn(() => mockNow);

      // Trigger initial request count
      validator.shouldRateLimit('test');

      // Advance time past window
      Date.now = vi.fn(() => mockNow + 60);

      expect(validator.shouldRateLimit('client1')).toBe(false);

      Date.now = originalNow;
    });

    it('should cleanup old entries', () => {
      rateLimitValidator.shouldRateLimit('client1');
      expect(rateLimitValidator['requestCounts'].has('client1')).toBe(true);

      // Mock cleanup by setting an old timestamp
      const clientData = rateLimitValidator['requestCounts'].get('client1');
      if (clientData) {
        clientData.resetTime = Date.now() - 2000;
      }

      rateLimitValidator.cleanup();
      expect(rateLimitValidator['requestCounts'].has('client1')).toBe(false);
    });
  });

  describe('rateLimiter singleton', () => {
    it('should export a singleton rate limiter', () => {
      expect(rateLimiter).toBeInstanceOf(RateLimitValidator);
    });

    it('should have default configuration', () => {
      // Test that it works with default settings
      expect(rateLimiter.shouldRateLimit('test-client')).toBe(false);
    });
  });
});
