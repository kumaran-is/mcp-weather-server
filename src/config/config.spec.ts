import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getConfig,
  validateConfig,
  getConfigSummary,
  getServerConfig,
  getAPIConfig,
  getSecurityConfig,
  getLoggingConfig,
  getPerformanceConfig,
  getResilienceConfig,
  AppConfig
} from './config';

describe('Config Module', () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Set defaults for test environment
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getConfig', () => {
    it('should return configuration object', () => {
      const config = getConfig();

      expect(config).toBeDefined();
      expect(config.server).toBeDefined();
      expect(config.api).toBeDefined();
      expect(config.security).toBeDefined();
      expect(config.logging).toBeDefined();
      expect(config.performance).toBeDefined();
      expect(config.resilience).toBeDefined();
      expect(config.streaming).toBeDefined();
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

    it('should handle ALLOWED_ORIGINS environment variable', () => {
      process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://example.com';
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

    it('should handle MAX_RETRIES environment variable', () => {
      process.env.MAX_RETRIES = '5';
      const config = getConfig();

      expect(config.resilience.retry.maxRetries).toBe(5);
    });

    it('should handle BASE_RETRY_DELAY environment variable', () => {
      process.env.BASE_RETRY_DELAY = '2000';
      const config = getConfig();

      expect(config.resilience.retry.baseDelay).toBe(2000);
    });
  });

  describe('validateConfig', () => {
    it('should return true for valid configuration', () => {
      const result = validateConfig();
      expect(result).toBe(true);
    });
  });

  describe('getServerConfig', () => {
    it('should return server configuration', () => {
      const serverConfig = getServerConfig();

      expect(serverConfig).toBeDefined();
      expect(serverConfig.nodeEnv).toBeDefined();
      expect(serverConfig.transport).toBeDefined();
      expect(serverConfig.httpPort).toBeDefined();
    });
  });

  describe('getAPIConfig', () => {
    it('should return API configuration', () => {
      const apiConfig = getAPIConfig();

      expect(apiConfig).toBeDefined();
      expect(apiConfig.baseUrl).toBeDefined();
      expect(apiConfig.geocodingUrl).toBeDefined();
      expect(apiConfig.timeout).toBeDefined();
      expect(apiConfig.retries).toBeDefined();
      expect(apiConfig.retryDelay).toBeDefined();
    });
  });

  describe('getSecurityConfig', () => {
    it('should return security configuration', () => {
      const securityConfig = getSecurityConfig();

      expect(securityConfig).toBeDefined();
      expect(securityConfig.allowedOrigins).toBeDefined();
      expect(Array.isArray(securityConfig.allowedOrigins)).toBe(true);
      expect(securityConfig.monitoring).toBeDefined();
      expect(securityConfig.rateLimiting).toBeDefined();
    });
  });

  describe('getLoggingConfig', () => {
    it('should return logging configuration', () => {
      const loggingConfig = getLoggingConfig();

      expect(loggingConfig).toBeDefined();
      expect(loggingConfig.level).toBeDefined();
    });
  });

  describe('getPerformanceConfig', () => {
    it('should return performance configuration', () => {
      const performanceConfig = getPerformanceConfig();

      expect(performanceConfig).toBeDefined();
      expect(performanceConfig.apiTimeout).toBeDefined();
      expect(performanceConfig.httpTimeout).toBeDefined();
      expect(performanceConfig.requestTimeout).toBeDefined();
    });
  });

  describe('getResilienceConfig', () => {
    it('should return resilience configuration', () => {
      const resilienceConfig = getResilienceConfig();

      expect(resilienceConfig).toBeDefined();
      expect(resilienceConfig.circuitBreaker).toBeDefined();
      expect(resilienceConfig.retry).toBeDefined();
    });
  });

  describe('getConfigSummary', () => {
    it('should return configuration summary', () => {
      const summary = getConfigSummary();

      expect(summary).toBeDefined();
      expect(summary.environment).toBeDefined();
      expect(summary.transport).toBeDefined();
      expect(summary.port).toBeDefined();
      expect(summary.logLevel).toBeDefined();
      expect(summary.apiTimeout).toBeDefined();
      expect(summary.circuitBreakerThreshold).toBeDefined();
      expect(summary.maxRetries).toBeDefined();
    });
  });

  describe('Config type definitions', () => {
    it('should have correct type structure', () => {
      const config: AppConfig = getConfig();

      // Check server config types
      expect(typeof config.server.nodeEnv).toBe('string');
      expect(typeof config.server.transport).toBe('string');
      expect(typeof config.server.httpPort).toBe('number');

      // Check API config types
      expect(typeof config.api.baseUrl).toBe('string');
      expect(typeof config.api.geocodingUrl).toBe('string');
      expect(typeof config.api.timeout).toBe('number');
      expect(typeof config.api.retries).toBe('number');
      expect(typeof config.api.retryDelay).toBe('number');

      // Check logging config types
      expect(typeof config.logging.level).toBe('string');

      // Check performance config types
      expect(typeof config.performance.apiTimeout).toBe('number');
      expect(typeof config.performance.httpTimeout).toBe('number');
      expect(typeof config.performance.requestTimeout).toBe('number');

      // Check resilience config types
      expect(typeof config.resilience.circuitBreaker.threshold).toBe('number');
      expect(typeof config.resilience.circuitBreaker.timeout).toBe('number');
      expect(typeof config.resilience.retry.maxRetries).toBe('number');
      expect(typeof config.resilience.retry.baseDelay).toBe('number');

      // Check security config types
      expect(Array.isArray(config.security.allowedOrigins)).toBe(true);

      // Check streaming config types
      expect(typeof config.streaming.maxConcurrentStreams).toBe('number');
      expect(typeof config.streaming.streamTimeout).toBe('number');
      expect(typeof config.streaming.backpressure.highWaterMark).toBe('number');
      expect(typeof config.streaming.backpressure.lowWaterMark).toBe('number');
    });
  });
});
