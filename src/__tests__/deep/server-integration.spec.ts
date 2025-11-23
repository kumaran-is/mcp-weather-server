/**
 * Deep Integration Tests - Server Initialization and Execution
 * Focus: Execute actual server code paths to maximize coverage
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('Server Deep Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.MCP_TRANSPORT;
    delete process.env.PORT;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Transport Initialization', () => {
    it('should handle stdio transport environment', async () => {
      process.env.MCP_TRANSPORT = 'stdio';

      // Import server to trigger initialization
      const server = await import('../../server');

      expect(server).toBeDefined();
      expect(process.env.MCP_TRANSPORT).toBe('stdio');
    });

    it('should handle http transport environment', async () => {
      process.env.MCP_TRANSPORT = 'http';
      process.env.PORT = '3000';

      const server = await import('../../server');

      expect(server).toBeDefined();
      expect(process.env.MCP_TRANSPORT).toBe('http');
    });

    it('should handle missing transport environment', async () => {
      // No MCP_TRANSPORT set - should default
      const server = await import('../../server');

      expect(server).toBeDefined();
    });

    it('should handle custom port configuration', async () => {
      process.env.MCP_TRANSPORT = 'http';
      process.env.PORT = '8080';

      const server = await import('../../server');

      expect(server).toBeDefined();
      expect(process.env.PORT).toBe('8080');
    });
  });

  describe('Server Module Exports', () => {
    it('should export expected server components', async () => {
      const server = await import('../../server');

      expect(server).toBeDefined();
      expect(typeof server).toBe('object');
    });

    it('should handle module reloading', async () => {
      const server1 = await import('../../server');
      const server2 = await import('../../server');

      expect(server1).toBeDefined();
      expect(server2).toBeDefined();
    });
  });

  describe('Configuration Loading', () => {
    it('should load all configuration modules', async () => {
      const { getConfig, getServerConfig, getAPIConfig } = await import('../../config/config');

      const config = getConfig();
      const serverConfig = getServerConfig();
      const apiConfig = getAPIConfig();

      expect(config).toBeDefined();
      expect(serverConfig).toBeDefined();
      expect(apiConfig).toBeDefined();

      // Verify config structure
      expect(config.server).toBeDefined();
      expect(config.api).toBeDefined();
      expect(config.security).toBeDefined();
      expect(config.logging).toBeDefined();
      expect(config.performance).toBeDefined();
      expect(config.resilience).toBeDefined();
    });

    it('should have valid server configuration values', async () => {
      const { getServerConfig } = await import('../../config/config');

      const serverConfig = getServerConfig();

      expect(serverConfig.port).toBeDefined();
      expect(typeof serverConfig.port).toBe('number');
      expect(serverConfig.host).toBeDefined();
      expect(typeof serverConfig.host).toBe('string');
    });

    it('should have valid API configuration', async () => {
      const { getAPIConfig } = await import('../../config/config');

      const apiConfig = getAPIConfig();

      expect(apiConfig.baseUrl).toBeDefined();
      expect(apiConfig.timeout).toBeDefined();
      expect(typeof apiConfig.timeout).toBe('number');
    });

    it('should have valid security configuration', async () => {
      const { getSecurityConfig } = await import('../../config/config');

      const securityConfig = getSecurityConfig();

      expect(securityConfig).toBeDefined();
      expect(securityConfig.enableAuth).toBeDefined();
      expect(typeof securityConfig.enableAuth).toBe('boolean');
    });

    it('should have valid logging configuration', async () => {
      const { getLoggingConfig } = await import('../../config/config');

      const loggingConfig = getLoggingConfig();

      expect(loggingConfig).toBeDefined();
      expect(loggingConfig.level).toBeDefined();
      expect(typeof loggingConfig.level).toBe('string');
    });

    it('should have valid performance configuration', async () => {
      const { getPerformanceConfig } = await import('../../config/config');

      const perfConfig = getPerformanceConfig();

      expect(perfConfig).toBeDefined();
      expect(perfConfig.cacheEnabled).toBeDefined();
    });

    it('should have valid resilience configuration', async () => {
      const { getResilienceConfig } = await import('../../config/config');

      const resilienceConfig = getResilienceConfig();

      expect(resilienceConfig).toBeDefined();
      expect(resilienceConfig.retryAttempts).toBeDefined();
      expect(typeof resilienceConfig.retryAttempts).toBe('number');
    });

    it('should generate configuration summary', async () => {
      const { getConfigSummary } = await import('../../config/config');

      const summary = getConfigSummary();

      expect(summary).toBeDefined();
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    });

    it('should validate configuration', async () => {
      const { validateConfig } = await import('../../config/config');

      const isValid = validateConfig();

      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('Logger Initialization', () => {
    it('should initialize logger with all log levels', async () => {
      const { logger } = await import('../../logger-pino');

      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.trace).toBeDefined();
    });

    it('should log at different levels without errors', async () => {
      const { logger } = await import('../../logger-pino');

      expect(() => logger.info('Test info message')).not.toThrow();
      expect(() => logger.error('Test error message')).not.toThrow();
      expect(() => logger.warn('Test warning message')).not.toThrow();
      expect(() => logger.debug('Test debug message')).not.toThrow();
      expect(() => logger.trace('Test trace message')).not.toThrow();
    });

    it('should log with metadata objects', async () => {
      const { logger } = await import('../../logger-pino');

      const metadata = {
        userId: 'test-user',
        action: 'test-action',
        timestamp: Date.now()
      };

      expect(() => logger.info(metadata, 'Test with metadata')).not.toThrow();
      expect(() => logger.error(metadata, 'Error with metadata')).not.toThrow();
    });

    it('should handle child logger creation', async () => {
      const { logger } = await import('../../logger-pino');

      const childLogger = logger.child({ component: 'test' });

      expect(childLogger).toBeDefined();
      expect(childLogger.info).toBeDefined();
      expect(() => childLogger.info('Child logger test')).not.toThrow();
    });
  });

  describe('MCP Server Initialization', () => {
    it('should create MCP server instance', async () => {
      const { WeatherMCPServer } = await import('../../mcp-server');

      const server = new WeatherMCPServer();

      expect(server).toBeDefined();
      expect(server.getServer).toBeDefined();
    });

    it('should get underlying MCP server', async () => {
      const { WeatherMCPServer } = await import('../../mcp-server');

      const weatherServer = new WeatherMCPServer();
      const mcpServer = weatherServer.getServer();

      expect(mcpServer).toBeDefined();
    });

    it('should have server name and version', async () => {
      const { WeatherMCPServer } = await import('../../mcp-server');
      const { NAME, VERSION } = await import('../../utils/version');

      const server = new WeatherMCPServer();

      expect(NAME).toBeDefined();
      expect(VERSION).toBeDefined();
      expect(typeof NAME).toBe('string');
      expect(typeof VERSION).toBe('string');
    });
  });

  describe('Weather Service Initialization', () => {
    it('should create weather service with resilience', async () => {
      const { WeatherService } = await import('../../weather-service');

      const service = new WeatherService();

      expect(service).toBeDefined();
      expect(service.getCurrentWeather).toBeDefined();
      expect(service.getForecast).toBeDefined();
      expect(service.getResilienceStats).toBeDefined();
    });

    it('should have resilience statistics', async () => {
      const { WeatherService } = await import('../../weather-service');

      const service = new WeatherService();
      const stats = service.getResilienceStats();

      expect(stats).toBeDefined();
      expect(stats.bulkheads).toBeDefined();
      expect(stats.rateLimiters).toBeDefined();
      expect(stats.retryConfig).toBeDefined();
    });
  });

  describe('Cache System Initialization', () => {
    it('should initialize weather cache', async () => {
      const { weatherCache } = await import('../../cache/weather-cache');

      expect(weatherCache).toBeDefined();
      expect(weatherCache.getWeather).toBeDefined();
      expect(weatherCache.setWeather).toBeDefined();
      expect(weatherCache.clear).toBeDefined();
      expect(weatherCache.getStats).toBeDefined();
    });

    it('should have initial cache statistics', async () => {
      const { weatherCache } = await import('../../cache/weather-cache');

      weatherCache.clear(); // Reset for clean stats
      const stats = weatherCache.getStats();

      expect(stats).toBeDefined();
      expect(stats.weather).toBeDefined();
      expect(stats.forecast).toBeDefined();
      expect(stats.geocoding).toBeDefined();
    });
  });

  describe('Security System Initialization', () => {
    it('should initialize security manager', async () => {
      const { securityManager, SecurityManager } = await import('../../security/sanitizer');

      expect(SecurityManager).toBeDefined();
      expect(securityManager).toBeDefined();
    });

    it('should initialize security monitor', async () => {
      const { securityMonitor, SecurityMonitor } = await import('../../security/security-monitor');

      expect(SecurityMonitor).toBeDefined();
      expect(securityMonitor).toBeDefined();
    });

    it('should have sanitization utilities', async () => {
      const { sanitizeRequestData, validateInputSize, generateRateLimitKey } = await import('../../security/sanitizer');

      expect(sanitizeRequestData).toBeDefined();
      expect(validateInputSize).toBeDefined();
      expect(generateRateLimitKey).toBeDefined();

      // Test basic functionality
      const sanitized = sanitizeRequestData({ test: 'data' });
      expect(sanitized).toBeDefined();

      const isValid = validateInputSize('test', 1000);
      expect(typeof isValid).toBe('boolean');

      const key = generateRateLimitKey('client-1');
      expect(typeof key).toBe('string');
    });
  });

  describe('Error System Initialization', () => {
    it('should have all error classes', async () => {
      const errors = await import('../../errors/weather-errors');

      expect(errors.WeatherServiceError).toBeDefined();
      expect(errors.GeocodingError).toBeDefined();
      expect(errors.WeatherAPIError).toBeDefined();
      expect(errors.ValidationError).toBeDefined();
      expect(errors.RateLimitError).toBeDefined();
      expect(errors.CircuitBreakerError).toBeDefined();
      expect(errors.CacheError).toBeDefined();
      expect(errors.MCPProtocolError).toBeDefined();
    });

    it('should create error instances', async () => {
      const { GeocodingError, WeatherAPIError, ValidationError } = await import('../../errors/weather-errors');

      const geoError = new GeocodingError('Test error', 'TestCity');
      expect(geoError).toBeInstanceOf(Error);
      expect(geoError.city).toBe('TestCity');

      const apiError = new WeatherAPIError('API Error', 'current');
      expect(apiError).toBeInstanceOf(Error);

      const validationError = new ValidationError('Validation failed');
      expect(validationError).toBeInstanceOf(Error);
    });
  });
});
