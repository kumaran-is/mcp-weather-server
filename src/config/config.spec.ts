import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getConfig, validateConfig, Config } from './config';

describe('Config Module', () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getConfig', () => {
    it('should return default configuration', () => {
      const config = getConfig();

      expect(config).toBeDefined();
      expect(config.app).toBeDefined();
      expect(config.app.name).toBe('mcp-weather-server');
      expect(config.app.version).toBeDefined();
      expect(config.server).toBeDefined();
      expect(config.logging).toBeDefined();
      expect(config.resilience).toBeDefined();
      expect(config.performance).toBeDefined();
      expect(config.security).toBeDefined();
    });

    it('should use default transport when MCP_TRANSPORT not set', () => {
      delete process.env.MCP_TRANSPORT;
      const config = getConfig();

      expect(config.server.transport).toBe('stdio');
    });

    it('should use MCP_TRANSPORT environment variable', () => {
      process.env.MCP_TRANSPORT = 'http';
      const config = getConfig();

      expect(config.server.transport).toBe('http');
    });

    it('should use MCP_HTTP_PORT environment variable', () => {
      process.env.MCP_HTTP_PORT = '9090';
      const config = getConfig();

      expect(config.server.httpPort).toBe(9090);
    });


    it('should use LOG_LEVEL environment variable', () => {
      process.env.LOG_LEVEL = 'debug';
      const config = getConfig();

      expect(config.logging.level).toBe('debug');
    });

    it('should handle NODE_ENV production', () => {
      process.env.NODE_ENV = 'production';
      const config = getConfig();

      expect(config.app.environment).toBe('production');
      expect(config.logging.pretty).toBe(false);
    });

    it('should handle NODE_ENV development', () => {
      process.env.NODE_ENV = 'development';
      const config = getConfig();

      expect(config.app.environment).toBe('development');
      expect(config.logging.pretty).toBe(true);
    });

    it('should parse CORS_ORIGINS environment variable', () => {
      process.env.CORS_ORIGINS = 'http://localhost:3000,https://example.com';
      const config = getConfig();

      expect(config.security.allowedOrigins).toEqual([
        'http://localhost:3000',
        'https://example.com',
      ]);
    });

    it('should handle API_TIMEOUT environment variable', () => {
      process.env.API_TIMEOUT = '10000';
      const config = getConfig();

      expect(config.performance.apiTimeout).toBe(10000);
    });

    it('should handle MAX_CONNECTIONS environment variable', () => {
      process.env.MAX_CONNECTIONS = '200';
      const config = getConfig();

      expect(config.performance.maxConnections).toBe(200);
    });

    it('should handle CIRCUIT_BREAKER_THRESHOLD environment variable', () => {
      process.env.CIRCUIT_BREAKER_THRESHOLD = '10';
      const config = getConfig();

      expect(config.resilience.circuitBreaker.threshold).toBe(10);
    });

    it('should handle CIRCUIT_BREAKER_TIMEOUT environment variable', () => {
      process.env.CIRCUIT_BREAKER_TIMEOUT = '30000';
      const config = getConfig();

      expect(config.resilience.circuitBreaker.timeout).toBe(30000);
    });

    it('should handle RETRY_MAX_RETRIES environment variable', () => {
      process.env.RETRY_MAX_RETRIES = '5';
      const config = getConfig();

      expect(config.resilience.retry.maxRetries).toBe(5);
    });

    it('should handle RETRY_BASE_DELAY environment variable', () => {
      process.env.RETRY_BASE_DELAY = '2000';
      const config = getConfig();

      expect(config.resilience.retry.baseDelay).toBe(2000);
    });

    it('should handle RETRY_MAX_DELAY environment variable', () => {
      process.env.RETRY_MAX_DELAY = '60000';
      const config = getConfig();

      expect(config.resilience.retry.maxDelay).toBe(60000);
    });

    it('should handle RATE_LIMIT_PER_MINUTE environment variable', () => {
      process.env.RATE_LIMIT_PER_MINUTE = '100';
      const config = getConfig();

      expect(config.resilience.rateLimit.perMinute).toBe(100);
    });

    it('should handle CACHE_MAX_SIZE environment variable', () => {
      process.env.CACHE_MAX_SIZE = '200';
      const config = getConfig();

      expect(config.performance.cache.maxSize).toBe(200);
    });

    it('should handle CACHE_WEATHER_TTL environment variable', () => {
      process.env.CACHE_WEATHER_TTL = '600';
      const config = getConfig();

      expect(config.performance.cache.ttl.weather).toBe(600);
    });
  });

  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const config = getConfig();
      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw error for invalid transport', () => {
      const config = getConfig();
      config.server.transport = 'invalid' as any;

      expect(() => validateConfig(config)).toThrow(
        'Invalid transport: invalid. Must be one of: stdio, http',
      );
    });

    it('should throw error for invalid HTTP port', () => {
      const config = getConfig();
      config.server.httpPort = -1;

      expect(() => validateConfig(config)).toThrow(
        'Invalid HTTP port: -1. Must be between 1 and 65535',
      );
    });

    it('should throw error for HTTP port above range', () => {
      const config = getConfig();
      config.server.httpPort = 70000;

      expect(() => validateConfig(config)).toThrow(
        'Invalid HTTP port: 70000. Must be between 1 and 65535',
      );
    });


    it('should throw error for invalid log level', () => {
      const config = getConfig();
      config.logging.level = 'invalid' as any;

      expect(() => validateConfig(config)).toThrow(
        "Invalid log level: invalid. Must be one of: 'fatal', 'error', 'warn', 'info', 'debug', 'trace'",
      );
    });

    it('should throw error for negative API timeout', () => {
      const config = getConfig();
      config.performance.apiTimeout = -100;

      expect(() => validateConfig(config)).toThrow(
        'Invalid API timeout: -100. Must be a positive number',
      );
    });

    it('should throw error for negative max connections', () => {
      const config = getConfig();
      config.performance.maxConnections = -10;

      expect(() => validateConfig(config)).toThrow(
        'Invalid max connections: -10. Must be a positive number',
      );
    });

    it('should throw error for negative circuit breaker threshold', () => {
      const config = getConfig();
      config.resilience.circuitBreaker.threshold = -5;

      expect(() => validateConfig(config)).toThrow(
        'Invalid circuit breaker threshold: -5. Must be a positive number',
      );
    });

    it('should throw error for negative retry max retries', () => {
      const config = getConfig();
      config.resilience.retry.maxRetries = -1;

      expect(() => validateConfig(config)).toThrow(
        'Invalid max retries: -1. Must be a non-negative number',
      );
    });

    it('should throw error for negative rate limit', () => {
      const config = getConfig();
      config.resilience.rateLimit.perMinute = -60;

      expect(() => validateConfig(config)).toThrow(
        'Invalid rate limit per minute: -60. Must be a positive number',
      );
    });

    it('should throw error for negative cache size', () => {
      const config = getConfig();
      config.performance.cache.maxSize = -50;

      expect(() => validateConfig(config)).toThrow(
        'Invalid cache max size: -50. Must be a positive number',
      );
    });

    it('should throw error for negative cache TTL', () => {
      const config = getConfig();
      config.performance.cache.ttl.weather = -300;

      expect(() => validateConfig(config)).toThrow(
        'Invalid weather cache TTL: -300. Must be a positive number',
      );
    });

    it('should throw error for negative geocoding cache TTL', () => {
      const config = getConfig();
      config.performance.cache.ttl.geocoding = -3600;

      expect(() => validateConfig(config)).toThrow(
        'Invalid geocoding cache TTL: -3600. Must be a positive number',
      );
    });

    it('should throw error for negative forecast cache TTL', () => {
      const config = getConfig();
      config.performance.cache.ttl.forecast = -600;

      expect(() => validateConfig(config)).toThrow(
        'Invalid forecast cache TTL: -600. Must be a positive number',
      );
    });

    it('should accept zero for retry max retries', () => {
      const config = getConfig();
      config.resilience.retry.maxRetries = 0;

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should accept valid configuration with all settings', () => {
      const config: Config = {
        app: {
          name: 'test-app',
          version: '1.0.0',
          environment: 'production',
        },
        server: {
          transport: 'http',
          httpPort: 8080,
        },
        logging: {
          level: 'info',
          pretty: false,
          timestamp: true,
        },
        resilience: {
          circuitBreaker: {
            threshold: 5,
            timeout: 60000,
          },
          retry: {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 30000,
          },
          rateLimit: {
            perMinute: 60,
          },
        },
        performance: {
          cache: {
            maxSize: 100,
            ttl: {
              weather: 300,
              forecast: 600,
              geocoding: 3600,
            },
          },
          apiTimeout: 5000,
          maxConnections: 100,
        },
        security: {
          allowedOrigins: ['http://localhost:3000'],
        },
      };

      expect(() => validateConfig(config)).not.toThrow();
    });
  });

  describe('Config type definitions', () => {
    it('should have correct type structure', () => {
      const config = getConfig();

      // Check type structure
      expect(typeof config.app.name).toBe('string');
      expect(typeof config.app.version).toBe('string');
      expect(typeof config.app.environment).toBe('string');
      expect(typeof config.server.transport).toBe('string');
      expect(typeof config.server.httpPort).toBe('number');
      expect(typeof config.logging.level).toBe('string');
      expect(typeof config.logging.pretty).toBe('boolean');
      expect(typeof config.logging.timestamp).toBe('boolean');
      expect(typeof config.resilience.circuitBreaker.threshold).toBe('number');
      expect(typeof config.resilience.circuitBreaker.timeout).toBe('number');
      expect(typeof config.resilience.retry.maxRetries).toBe('number');
      expect(typeof config.resilience.retry.baseDelay).toBe('number');
      expect(typeof config.resilience.retry.maxDelay).toBe('number');
      expect(typeof config.resilience.rateLimit.perMinute).toBe('number');
      expect(typeof config.performance.cache.maxSize).toBe('number');
      expect(typeof config.performance.cache.ttl.weather).toBe('number');
      expect(typeof config.performance.cache.ttl.forecast).toBe('number');
      expect(typeof config.performance.cache.ttl.geocoding).toBe('number');
      expect(typeof config.performance.apiTimeout).toBe('number');
      expect(typeof config.performance.maxConnections).toBe('number');
      expect(Array.isArray(config.security.allowedOrigins)).toBe(true);
    });
  });

  describe('validateConfig function', () => {
    it('should return true for valid configuration', () => {
      const { validateConfig } = require('./config.js');
      const result = validateConfig();
      expect(result).toBe(true);
    });

    it('should return false for invalid configuration', () => {
      const { validateConfig } = require('./config.js');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Make config invalid
      process.env.MCP_TRANSPORT = 'invalid-transport';
      
      // Force module re-evaluation
      vi.resetModules();
      const { validateConfig: reloadedValidateConfig } = require('./config.js');
      
      const result = reloadedValidateConfig();
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Configuration validation failed:',
        expect.any(String)
      );
      
      consoleSpy.mockRestore();
      
      // Reset to valid value
      process.env.MCP_TRANSPORT = 'stdio';
    });
  });

  describe('getConfigSummary function', () => {
    it('should return configuration summary', () => {
      const { getConfigSummary } = require('./config.js');
      const summary = getConfigSummary();
      
      expect(summary).toEqual({
        environment: 'test',
        transport: 'stdio',
        port: 8080,
        logLevel: 'info',
        apiTimeout: 5000,
        circuitBreakerThreshold: 5,
        maxRetries: 3
      });
    });

    it('should reflect environment variable changes', () => {
      process.env.NODE_ENV = 'production';
      process.env.MCP_TRANSPORT = 'http';
      process.env.HTTP_PORT = '3000';
      process.env.LOG_LEVEL = 'debug';
      
      vi.resetModules();
      const { getConfigSummary } = require('./config.js');
      const summary = getConfigSummary();
      
      expect(summary.environment).toBe('production');
      expect(summary.transport).toBe('http');
      expect(summary.port).toBe(3000);
      expect(summary.logLevel).toBe('debug');
      
      // Reset
      process.env.NODE_ENV = 'test';
      process.env.MCP_TRANSPORT = 'stdio';
      process.env.HTTP_PORT = '8080';
      process.env.LOG_LEVEL = 'info';
    });
  });
});
