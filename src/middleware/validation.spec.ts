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
} from './validation';
import { ValidationError, MCPProtocolError } from '../errors/weather-errors';

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

    it('should throw error for invalid jsonrpc version', () => {
      const request = {
        jsonrpc: '1.0',
        method: 'test',
        id: '123',
      };

      expect(() => validateJSONRPC(request)).toThrow();
    });

    it('should throw error for missing method', () => {
      const request = {
        jsonrpc: '2.0',
        id: '123',
      };

      expect(() => validateJSONRPC(request)).toThrow();
    });
  });

  describe('validateInitializeRequest', () => {
    it('should validate valid initialize request', () => {
      const params = {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      };

      expect(() => validateInitializeRequest(params)).not.toThrow();
    });

    it('should throw error for invalid protocol version', () => {
      const params = {
        protocolVersion: 'invalid',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      };

      expect(() => validateInitializeRequest(params)).toThrow();
    });
  });

  describe('validateToolCallRequest', () => {
    it('should validate valid tool call', () => {
      const params = {
        name: 'get_current_weather',
        arguments: { city: 'London' },
      };

      expect(() => validateToolCallRequest(params)).not.toThrow();
    });

    it('should throw error for unknown tool', () => {
      const params = {
        name: 'unknown_tool',
        arguments: {},
      };

      expect(() => validateToolCallRequest(params)).toThrow();
    });

    it('should throw error for missing city', () => {
      const params = {
        name: 'get_current_weather',
        arguments: {},
      };

      expect(() => validateToolCallRequest(params)).toThrow();
    });
  });

  describe('validateHTTPHeaders', () => {
    it('should validate valid headers', () => {
      const headers = {
        'content-type': 'application/json',
      };

      expect(() => validateHTTPHeaders(headers)).not.toThrow();
    });

    it('should throw error for missing content-type', () => {
      const headers = {};

      expect(() => validateHTTPHeaders(headers)).toThrow();
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize input string', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeInput(input);

      expect(result).not.toContain('<script>');
    });

    it('should return empty string for undefined', () => {
      const result = sanitizeInput(undefined as any);
      expect(result).toBe('');
    });
  });

  describe('createValidationMiddleware', () => {
    it('should create validation middleware for stdio', () => {
      const middleware = createValidationMiddleware('stdio');
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should create validation middleware for http', () => {
      const middleware = createValidationMiddleware('http');
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('RateLimitValidator', () => {
    let rateLimitValidator: RateLimitValidator;

    beforeEach(() => {
      rateLimitValidator = new RateLimitValidator({
        windowMs: 1000,
        maxRequests: 5,
      });
    });

    it('should create rate limiter with config', () => {
      expect(rateLimitValidator).toBeInstanceOf(RateLimitValidator);
    });

    it('should allow requests within limit', () => {
      expect(rateLimitValidator.shouldRateLimit('client1')).toBe(false);
      expect(rateLimitValidator.shouldRateLimit('client1')).toBe(false);
    });

    it('should rate limit after max requests', () => {
      for (let i = 0; i < 5; i++) {
        rateLimitValidator.shouldRateLimit('client1');
      }

      expect(rateLimitValidator.shouldRateLimit('client1')).toBe(true);
    });

    it('should reset rate limit after window', () => {
      for (let i = 0; i < 5; i++) {
        rateLimitValidator.shouldRateLimit('client1');
      }

      // Simulate time passing
      vi.useFakeTimers();
      vi.advanceTimersByTime(1100);

      expect(rateLimitValidator.shouldRateLimit('client1')).toBe(false);

      vi.useRealTimers();
    });

    it('should track different clients separately', () => {
      for (let i = 0; i < 5; i++) {
        rateLimitValidator.shouldRateLimit('client1');
      }

      expect(rateLimitValidator.shouldRateLimit('client1')).toBe(true);
      expect(rateLimitValidator.shouldRateLimit('client2')).toBe(false);
    });
  });

  describe('rateLimiter singleton', () => {
    it('should export a singleton rate limiter', () => {
      expect(rateLimiter).toBeInstanceOf(RateLimitValidator);
    });

    it('should have default configuration', () => {
      expect(rateLimiter.shouldRateLimit('test-client')).toBe(false);
    });
  });
});
