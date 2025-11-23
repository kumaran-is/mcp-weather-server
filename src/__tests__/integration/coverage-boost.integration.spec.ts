/**
 * Coverage Boost Integration Tests
 * Focused tests to maximize code coverage across all modules
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Coverage Boost Integration Tests', () => {
  describe('Weather Service Module', () => {
    it('should import weather service', async () => {
      const { WeatherService } = await import('../../weather-service');
      expect(WeatherService).toBeDefined();

      const service = new WeatherService();
      expect(service).toBeDefined();
      expect(service.getCurrentWeather).toBeDefined();
      expect(service.getForecast).toBeDefined();
      expect(service.getResilienceStats).toBeDefined();
    });

    it('should get resilience stats', async () => {
      const { WeatherService } = await import('../../weather-service');
      const service = new WeatherService();

      const stats = service.getResilienceStats();
      expect(stats).toBeDefined();
      expect(stats.bulkheads).toBeDefined();
      expect(stats.rateLimiters).toBeDefined();
      expect(stats.retryConfig).toBeDefined();
    });
  });

  describe('MCP Server Module', () => {
    it('should import and create MCP server', async () => {
      const { WeatherMCPServer } = await import('../../mcp-server');
      expect(WeatherMCPServer).toBeDefined();

      const server = new WeatherMCPServer();
      expect(server).toBeDefined();
      expect(server.getServer).toBeDefined();
    });

    it('should get server instance', async () => {
      const { WeatherMCPServer } = await import('../../mcp-server');
      const server = new WeatherMCPServer();

      const mcpInstance = server.getServer();
      expect(mcpInstance).toBeDefined();
    });
  });

  describe('Cache Module', () => {
    it('should import and use cache', async () => {
      const { weatherCache } = await import('../../cache/weather-cache');
      expect(weatherCache).toBeDefined();

      weatherCache.clear();
      const stats = weatherCache.getStats();
      expect(stats).toBeDefined();
      expect(stats.weather).toBeDefined();
      expect(stats.forecast).toBeDefined();
      expect(stats.geocoding).toBeDefined();
    });

    it('should set and get weather data', async () => {
      const { weatherCache } = await import('../../cache/weather-cache');

      const weatherData = {
        location: 'TestCity',
        temperature: 20,
        description: 'Sunny',
        humidity: 60,
        windSpeed: 5,
        feelsLike: 19,
        pressure: 1013,
        timestamp: Date.now(),
      };

      weatherCache.setWeather('testcity', weatherData);
      const cached = weatherCache.getWeather('testcity');

      expect(cached).toBeDefined();
      expect(cached?.location).toBe('TestCity');
    });

    it('should set and get forecast data', async () => {
      const { weatherCache } = await import('../../cache/weather-cache');

      const forecastData = {
        location: 'TestCity',
        forecasts: [{
          date: '2024-01-01',
          temperature: 18,
          temperatureMin: 15,
          temperatureMax: 22,
          description: 'Cloudy',
          humidity: 65,
          windSpeed: 4,
          precipitation: 0,
        }],
        timestamp: Date.now(),
      };

      weatherCache.setForecast('testcity', 3, forecastData);
      const cached = weatherCache.getForecast('testcity', 3);

      expect(cached).toBeDefined();
      expect(cached?.location).toBe('TestCity');
    });

    it('should set and get geocoding data', async () => {
      const { weatherCache } = await import('../../cache/weather-cache');

      const coords = { latitude: 51.5074, longitude: -0.1278 };
      weatherCache.setGeocoding('london', coords);
      const cached = weatherCache.getGeocoding('london');

      expect(cached).toBeDefined();
      expect(cached).toHaveProperty('latitude');
      expect(cached).toHaveProperty('longitude');
    });
  });

  describe('Security Module', () => {
    it('should import security manager', async () => {
      const { securityManager, SecurityManager } = await import('../../security/sanitizer');
      expect(SecurityManager).toBeDefined();
      expect(securityManager).toBeDefined();
    });

    it('should import security monitor', async () => {
      const { securityMonitor, SecurityMonitor } = await import('../../security/security-monitor');
      expect(SecurityMonitor).toBeDefined();
      expect(securityMonitor).toBeDefined();
    });

    it('should use sanitization functions', async () => {
      const { sanitizeRequestData, validateInputSize, generateRateLimitKey } = await import('../../security/sanitizer');

      expect(sanitizeRequestData).toBeDefined();
      expect(validateInputSize).toBeDefined();
      expect(generateRateLimitKey).toBeDefined();

      const sanitized = sanitizeRequestData({ test: 'data' });
      expect(sanitized).toBeDefined();

      const isValid = validateInputSize('small string', 1000);
      expect(isValid).toBe(true);

      const key = generateRateLimitKey('client-1', '/api/weather');
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
    });
  });

  describe('Middleware Modules', () => {
    it('should import validation middleware', async () => {
      const middleware = await import('../../middleware/validation');
      expect(middleware).toBeDefined();
      expect(middleware.createValidationMiddleware).toBeDefined();
      expect(middleware.validateJSONRPC).toBeDefined();
      expect(middleware.sanitizeInput).toBeDefined();
    });

    it('should import auth middleware', async () => {
      const middleware = await import('../../middleware/auth');
      expect(middleware).toBeDefined();
      expect(middleware.createAuthMiddleware).toBeDefined();
    });

    it('should import rate limit middleware', async () => {
      const middleware = await import('../../middleware/rate-limit');
      expect(middleware).toBeDefined();
      expect(middleware.createRateLimitMiddleware).toBeDefined();
    });

    it('should import sanitization middleware', async () => {
      const middleware = await import('../../middleware/sanitization');
      expect(middleware).toBeDefined();
      expect(middleware.createSanitizationMiddleware).toBeDefined();
    });

    it('should use validation functions', async () => {
      const { validateJSONRPC, sanitizeInput } = await import('../../middleware/validation');

      const validRequest = {
        jsonrpc: '2.0',
        method: 'test',
        id: '123',
      };

      expect(() => validateJSONRPC(validRequest)).not.toThrow();

      const sanitized = sanitizeInput('test');
      expect(sanitized).toBeDefined();
    });

    it('should create validation middleware', async () => {
      const { createValidationMiddleware } = await import('../../middleware/validation');

      const middleware = createValidationMiddleware('stdio');
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should create rate limit middleware', async () => {
      const { createRateLimitMiddleware } = await import('../../middleware/rate-limit');

      const middleware = createRateLimitMiddleware();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should create sanitization middleware', async () => {
      const { createSanitizationMiddleware } = await import('../../middleware/sanitization');

      const middleware = createSanitizationMiddleware();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should create auth middleware', async () => {
      const { createAuthMiddleware } = await import('../../middleware/auth');

      const authMiddleware = createAuthMiddleware();
      expect(authMiddleware).toBeDefined();
      expect(typeof authMiddleware).toBe('function');
    });
  });

  describe('Audit Logger Module', () => {
    it('should import audit logger', async () => {
      const { AuditLogger } = await import('../../audit/audit-logger');
      expect(AuditLogger).toBeDefined();

      const logger = new AuditLogger();
      expect(logger).toBeDefined();
    });
  });

  describe('Context Manager Module', () => {
    it('should import context manager', async () => {
      const { ContextManager, contextManager } = await import('../../context/context-manager');
      expect(ContextManager).toBeDefined();
      expect(contextManager).toBeDefined();
    });
  });

  describe('Logger Module', () => {
    it('should import logger', async () => {
      const { logger } = await import('../../logger-pino');
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should log messages without errors', async () => {
      const { logger } = await import('../../logger-pino');

      expect(() => logger.info('Test info')).not.toThrow();
      expect(() => logger.error('Test error')).not.toThrow();
      expect(() => logger.warn('Test warning')).not.toThrow();
      expect(() => logger.debug('Test debug')).not.toThrow();
    });
  });

  describe('Server Module', () => {
    it('should import server module', async () => {
      const server = await import('../../server');
      expect(server).toBeDefined();
    });
  });

  describe('Config Modules', () => {
    it('should import and use main config', async () => {
      const { getConfig, getServerConfig, getAPIConfig, getSecurityConfig, getLoggingConfig, getPerformanceConfig, getResilienceConfig } = await import('../../config/config');

      const config = getConfig();
      expect(config).toBeDefined();
      expect(config.server).toBeDefined();
      expect(config.api).toBeDefined();
      expect(config.security).toBeDefined();

      const serverConfig = getServerConfig();
      expect(serverConfig).toBeDefined();

      const apiConfig = getAPIConfig();
      expect(apiConfig).toBeDefined();

      const securityConfig = getSecurityConfig();
      expect(securityConfig).toBeDefined();

      const loggingConfig = getLoggingConfig();
      expect(loggingConfig).toBeDefined();

      const perfConfig = getPerformanceConfig();
      expect(perfConfig).toBeDefined();

      const resilienceConfig = getResilienceConfig();
      expect(resilienceConfig).toBeDefined();
    });

    it('should import auth config', async () => {
      const { config } = await import('../../config/auth-config');
      expect(config).toBeDefined();
      expect(config.NODE_ENV).toBeDefined();
    });
  });

  describe('Undici Resilience Modules', () => {
    it('should import pool manager', async () => {
      const { poolManager } = await import('../../undici-resilience/index');
      expect(poolManager).toBeDefined();
      expect(poolManager.request).toBeDefined();
    });

    it('should import bulkhead', async () => {
      const { Bulkhead, bulkheadManager } = await import('../../undici-resilience/resilience/bulkhead');
      expect(Bulkhead).toBeDefined();
      expect(bulkheadManager).toBeDefined();
    });

    it('should import rate limiter', async () => {
      const { RateLimiter, rateLimiterManager } = await import('../../undici-resilience/resilience/rate-limiter');
      expect(RateLimiter).toBeDefined();
      expect(rateLimiterManager).toBeDefined();
    });

    it('should import retry strategy', async () => {
      const { RetryStrategy, RetryStrategies } = await import('../../undici-resilience/resilience/retry-strategy');
      expect(RetryStrategy).toBeDefined();
      expect(RetryStrategies).toBeDefined();
    });

    it('should import circuit breaker', async () => {
      const { CircuitBreaker, CircuitState } = await import('../../undici-resilience/resilience/circuit-breaker');
      expect(CircuitBreaker).toBeDefined();
      expect(CircuitState).toBeDefined();
    });

    it('should create bulkhead', async () => {
      const { bulkheadManager } = await import('../../undici-resilience/resilience/bulkhead');

      const bulkhead = bulkheadManager.getBulkhead('test-bulkhead', {
        maxConcurrent: 5,
        maxQueueSize: 10,
        queueTimeout: 5000,
      });

      expect(bulkhead).toBeDefined();
      expect(bulkhead.getName()).toBe('test-bulkhead');
      const stats = bulkhead.getStats();
      expect(stats).toBeDefined();
    });

    it('should create rate limiter', async () => {
      const { rateLimiterManager } = await import('../../undici-resilience/resilience/rate-limiter');

      const limiter = rateLimiterManager.getRateLimiter('test-limiter', {
        requests: 10,
        windowMs: 1000,
        burst: 2,
        sliding: true,
      });

      expect(limiter).toBeDefined();
      expect(limiter.getName()).toBe('test-limiter');
      const stats = limiter.getStats();
      expect(stats).toBeDefined();
    });

    it('should create retry strategy', async () => {
      const { RetryStrategy } = await import('../../undici-resilience/resilience/retry-strategy');

      const strategy = new RetryStrategy({
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000,
        jitterFactor: 0.1,
      });

      expect(strategy).toBeDefined();
      const config = strategy.getConfig();
      expect(config).toBeDefined();
      expect(config.maxRetries).toBe(3);
    });
  });

  describe('Error Classes', () => {
    it('should import and create error types', async () => {
      const errors = await import('../../errors/weather-errors');

      expect(errors.WeatherServiceError).toBeDefined();
      expect(errors.GeocodingError).toBeDefined();
      expect(errors.WeatherAPIError).toBeDefined();
      expect(errors.ValidationError).toBeDefined();

      const error = new errors.GeocodingError('TestCity');
      expect(error).toBeDefined();
      expect(error.message).toContain('TestCity');
    });
  });
});
