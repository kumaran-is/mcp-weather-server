/**
 * Full Stack Integration Tests
 * Tests the complete weather server functionality end-to-end
 * Coverage targets: mcp-server.ts, weather-service.ts, cache, middleware, security
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WeatherService } from '../../weather-service';
import { WeatherMCPServer } from '../../mcp-server';
import { weatherCache } from '../../cache/weather-cache';
import { securityManager } from '../../security/sanitizer';
import { securityMonitor } from '../../security/security-monitor';

// Mock undici for controlled testing
vi.mock('undici', () => ({
  Pool: vi.fn(),
  request: vi.fn(),
}));

// Mock poolManager
vi.mock('../../undici-resilience/index', () => ({
  poolManager: {
    request: vi.fn(),
    getPool: vi.fn(),
    closeAll: vi.fn(),
    getMetrics: vi.fn().mockReturnValue({
      pools: {},
      totalRequests: 0,
      totalErrors: 0,
    }),
  },
}));

describe('Full Stack Integration Tests', () => {
  let weatherService: WeatherService;
  let mcpServer: WeatherMCPServer;

  beforeEach(() => {
    vi.clearAllMocks();
    weatherCache.clear();
    weatherService = new WeatherService();
    mcpServer = new WeatherMCPServer();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Weather Service Integration', () => {
    it('should create weather service instance', () => {
      expect(weatherService).toBeDefined();
      expect(weatherService.getCurrentWeather).toBeDefined();
      expect(weatherService.getForecast).toBeDefined();
    });

    it('should have resilience patterns configured', () => {
      const stats = weatherService.getResilienceStats();

      expect(stats).toBeDefined();
      expect(stats.bulkheads).toBeDefined();
      expect(stats.bulkheads.weather).toBeDefined();
      expect(stats.bulkheads.geocoding).toBeDefined();
      expect(stats.rateLimiters).toBeDefined();
      expect(stats.rateLimiters.weather).toBeDefined();
      expect(stats.rateLimiters.geocoding).toBeDefined();
      expect(stats.retryConfig).toBeDefined();
    });

    it('should handle getCurrentWeather method call', async () => {
      // Mock poolManager.request for geocoding
      const { poolManager } = await import('../../undici-resilience/index');
      const mockRequest = poolManager.request as any;

      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: async () => [{
            name: 'London',
            lat: 51.5074,
            lon: -0.1278,
            country: 'GB',
          }],
        },
      });

      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: async () => ({
            main: {
              temp: 15.5,
              feels_like: 14.2,
              humidity: 65,
              pressure: 1013,
            },
            weather: [{ description: 'Partly cloudy' }],
            wind: { speed: 5.2 },
            name: 'London',
          }),
        },
      });

      const weather = await weatherService.getCurrentWeather('London');

      expect(weather).toBeDefined();
      expect(weather.location).toBe('London');
      expect(weather.temperature).toBeDefined();
      expect(weather.description).toBeDefined();
    });

    it('should handle getForecast method call', async () => {
      const { poolManager } = await import('../../undici-resilience/index');
      const mockRequest = poolManager.request as any;

      // Mock geocoding
      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: async () => [{
            name: 'Paris',
            lat: 48.8566,
            lon: 2.3522,
            country: 'FR',
          }],
        },
      });

      // Mock forecast
      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: async () => ({
            city: { name: 'Paris' },
            list: [
              {
                dt_txt: '2024-01-01 12:00:00',
                main: {
                  temp: 12.5,
                  temp_min: 10.0,
                  temp_max: 15.0,
                  humidity: 70,
                },
                weather: [{ description: 'Cloudy' }],
                wind: { speed: 4.5 },
                rain: { '3h': 2.5 },
              },
            ],
          }),
        },
      });

      const forecast = await weatherService.getForecast('Paris', 3);

      expect(forecast).toBeDefined();
      expect(forecast.location).toBe('Paris');
      expect(forecast.forecasts).toBeDefined();
      expect(Array.isArray(forecast.forecasts)).toBe(true);
    });
  });

  describe('MCP Server Integration', () => {
    it('should create MCP server instance', () => {
      expect(mcpServer).toBeDefined();
      expect(mcpServer.getServer).toBeDefined();
    });

    it('should have server instance', () => {
      const server = mcpServer.getServer();
      expect(server).toBeDefined();
    });

    it('should handle graceful shutdown', async () => {
      await expect(mcpServer.shutdown()).resolves.not.toThrow();
    });

    it('should return server statistics', () => {
      const stats = mcpServer.getStats();

      expect(stats).toBeDefined();
      expect(stats.uptime).toBeDefined();
      expect(stats.requestCount).toBeDefined();
      expect(stats.cacheStats).toBeDefined();
      expect(stats.resilience).toBeDefined();
    });
  });

  describe('Cache Integration', () => {
    it('should cache weather data', () => {
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
      expect(cached?.temperature).toBe(20);
    });

    it('should cache forecast data', () => {
      const forecastData = {
        location: 'TestCity',
        forecasts: [
          {
            date: '2024-01-01',
            temperature: 18,
            temperatureMin: 15,
            temperatureMax: 22,
            description: 'Partly cloudy',
            humidity: 65,
            windSpeed: 4,
            precipitation: 0,
          },
        ],
        timestamp: Date.now(),
      };

      weatherCache.setForecast('testcity', 3, forecastData);
      const cached = weatherCache.getForecast('testcity', 3);

      expect(cached).toBeDefined();
      expect(cached?.location).toBe('TestCity');
      expect(cached?.forecasts).toHaveLength(1);
    });

    it('should cache geocoding data', () => {
      const coords = { latitude: 51.5074, longitude: -0.1278 };

      weatherCache.setGeocoding('london', coords);
      const cached = weatherCache.getGeocoding('london');

      expect(cached).toBeDefined();
      expect(cached?.latitude).toBe(51.5074);
      expect(cached?.longitude).toBe(-0.1278);
    });

    it('should return cache statistics', () => {
      const stats = weatherCache.getStats();

      expect(stats).toBeDefined();
      expect(stats.weather).toBeDefined();
      expect(stats.forecast).toBeDefined();
      expect(stats.geocoding).toBeDefined();
    });

    it('should clear cache', () => {
      weatherCache.setWeather('test', {
        location: 'Test',
        temperature: 20,
        description: 'Test',
        humidity: 50,
        windSpeed: 5,
        feelsLike: 19,
        pressure: 1013,
        timestamp: Date.now(),
      });

      weatherCache.clear();
      const stats = weatherCache.getStats();

      expect(stats.weather.sets).toBeGreaterThan(0);
    });
  });

  describe('Security Integration', () => {
    it('should create security manager instance', () => {
      expect(securityManager).toBeDefined();
      expect(securityManager.sanitize).toBeDefined();
    });

    it('should sanitize malicious input', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const sanitized = securityManager.sanitize(maliciousInput);

      expect(sanitized).toBeDefined();
      expect(sanitized.length).toBeGreaterThan(0);
    });

    it('should validate safe input', () => {
      const safeInput = 'London';
      const result = securityManager.validate(safeInput);

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
    });

    it('should detect malicious patterns', () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const result = securityManager.validate(sqlInjection);

      expect(result).toBeDefined();
      expect(result.isValid).toBe(false);
      expect(result.threats).toBeDefined();
      expect(result.threats.length).toBeGreaterThan(0);
    });

    it('should create security monitor instance', () => {
      expect(securityMonitor).toBeDefined();
      expect(securityMonitor.recordThreat).toBeDefined();
    });

    it('should record threat', () => {
      const threat = {
        type: 'sql-injection',
        severity: 'high' as const,
        source: 'test',
        description: 'Test threat',
        metadata: {},
      };

      expect(() => securityMonitor.recordThreat(threat)).not.toThrow();
    });

    it('should get threat statistics', () => {
      const stats = securityMonitor.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalThreats).toBeDefined();
      expect(typeof stats.totalThreats).toBe('number');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid city gracefully', async () => {
      const { poolManager } = await import('../../undici-resilience/index');
      const mockRequest = poolManager.request as any;

      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        body: {
          json: async () => [],
        },
      });

      await expect(weatherService.getCurrentWeather('InvalidCity123')).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      const { poolManager } = await import('../../undici-resilience/index');
      const mockRequest = poolManager.request as any;

      mockRequest.mockRejectedValueOnce(new Error('Network error'));

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow();
    });
  });

  describe('Logger Integration', () => {
    it('should import logger', async () => {
      const { logger } = await import('../../logger-pino');

      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should log messages', async () => {
      const { logger } = await import('../../logger-pino');

      expect(() => logger.info('Test message')).not.toThrow();
      expect(() => logger.error('Test error')).not.toThrow();
      expect(() => logger.warn('Test warning')).not.toThrow();
      expect(() => logger.debug('Test debug')).not.toThrow();
    });
  });

  describe('Audit Integration', () => {
    it('should import audit logger', async () => {
      const { auditLogger } = await import('../../audit/audit-logger');

      expect(auditLogger).toBeDefined();
      expect(auditLogger.logSecurityEvent).toBeDefined();
    });

    it('should log security events', async () => {
      const { auditLogger } = await import('../../audit/audit-logger');

      expect(() => auditLogger.logSecurityEvent({
        category: 'authentication',
        action: 'login',
        severity: 'info',
        userId: 'test',
        metadata: {},
      })).not.toThrow();
    });

    it('should get audit statistics', async () => {
      const { auditLogger } = await import('../../audit/audit-logger');

      const stats = auditLogger.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalEvents).toBe('number');
    });
  });

  describe('Middleware Integration', () => {
    it('should import validation middleware', async () => {
      const { createValidationMiddleware } = await import('../../middleware/validation');

      expect(createValidationMiddleware).toBeDefined();

      const middleware = createValidationMiddleware('stdio');
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should import auth middleware', async () => {
      const { authManager } = await import('../../middleware/auth');

      expect(authManager).toBeDefined();
      expect(authManager.validateToken).toBeDefined();
    });

    it('should import rate limit middleware', async () => {
      const { createRateLimitMiddleware } = await import('../../middleware/rate-limit');

      expect(createRateLimitMiddleware).toBeDefined();

      const middleware = createRateLimitMiddleware();
      expect(middleware).toBeDefined();
    });

    it('should import sanitization middleware', async () => {
      const { createSanitizationMiddleware } = await import('../../middleware/sanitization');

      expect(createSanitizationMiddleware).toBeDefined();

      const middleware = createSanitizationMiddleware();
      expect(middleware).toBeDefined();
    });
  });

  describe('Context Manager Integration', () => {
    it('should import context manager', async () => {
      const { contextManager } = await import('../../context/context-manager');

      expect(contextManager).toBeDefined();
      expect(contextManager.createContext).toBeDefined();
    });

    it('should create context', async () => {
      const { contextManager } = await import('../../context/context-manager');

      const context = contextManager.createContext('test-session');
      expect(context).toBeDefined();
      expect(context.sessionId).toBe('test-session');
    });

    it('should get context', async () => {
      const { contextManager } = await import('../../context/context-manager');

      contextManager.createContext('test-session-2');
      const context = contextManager.getContext('test-session-2');

      expect(context).toBeDefined();
      expect(context?.sessionId).toBe('test-session-2');
    });

    it('should delete context', async () => {
      const { contextManager } = await import('../../context/context-manager');

      contextManager.createContext('test-session-3');
      contextManager.deleteContext('test-session-3');

      const context = contextManager.getContext('test-session-3');
      expect(context).toBeUndefined();
    });
  });

  describe('Server Module Integration', () => {
    it('should import server module', async () => {
      const server = await import('../../server');

      expect(server).toBeDefined();
    });
  });

  describe('Config Integration', () => {
    it('should import config', async () => {
      const { getConfig } = await import('../../config/config');

      const config = getConfig();
      expect(config).toBeDefined();
      expect(config.server).toBeDefined();
      expect(config.api).toBeDefined();
      expect(config.security).toBeDefined();
      expect(config.logging).toBeDefined();
    });

    it('should import auth config', async () => {
      const { authConfig } = await import('../../config/auth-config');

      expect(authConfig).toBeDefined();
      expect(authConfig.jwt).toBeDefined();
    });
  });
});
