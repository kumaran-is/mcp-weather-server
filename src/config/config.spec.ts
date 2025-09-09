import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from './config.js';

// Mock process.env
const originalEnv = process.env;

describe('ConfigManager', () => {
  beforeEach(() => {
    // Reset process.env for each test
    process.env = { ...originalEnv };

    // Clear singleton instance for fresh tests
    (ConfigManager as any).instance = null;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create only one instance', () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Environment Configuration', () => {
    it('should default to development environment', () => {
      delete process.env.NODE_ENV;
      const config = ConfigManager.getInstance().getConfig();

      expect(config.env).toBe('development');
    });

    it('should use NODE_ENV when set', () => {
      process.env.NODE_ENV = 'production';
      const config = ConfigManager.getInstance().getConfig();

      expect(config.env).toBe('production');
    });

    it('should use test environment', () => {
      process.env.NODE_ENV = 'test';
      const config = ConfigManager.getInstance().getConfig();

      expect(config.env).toBe('test');
    });
  });

  describe('Transport Configuration', () => {
    it('should default to stdio transport', () => {
      delete process.env.MCP_TRANSPORT;
      const config = ConfigManager.getInstance().getTransportConfig();

      expect(config.type).toBe('stdio');
    });

    it('should use MCP_TRANSPORT when set to http', () => {
      process.env.MCP_TRANSPORT = 'http';
      const config = ConfigManager.getInstance().getTransportConfig();

      expect(config.type).toBe('http');
      expect(config.http).toBeDefined();
    });

    it('should use MCP_TRANSPORT when set to websocket', () => {
      process.env.MCP_TRANSPORT = 'websocket';
      const config = ConfigManager.getInstance().getTransportConfig();

      expect(config.type).toBe('websocket');
      expect(config.websocket).toBeDefined();
    });

    it('should configure HTTP transport with defaults', () => {
      process.env.MCP_TRANSPORT = 'http';
      const config = ConfigManager.getInstance().getTransportConfig();

      expect(config.http?.port).toBe(8080);
      expect(config.http?.sessionTimeout).toBe(3600000); // 1 hour
      expect(config.http?.maxSessions).toBe(100);
    });

    it('should configure HTTP transport with custom values', () => {
      process.env.MCP_TRANSPORT = 'http';
      process.env.MCP_HTTP_PORT = '3000';
      process.env.SESSION_TIMEOUT = '1800000'; // 30 minutes
      process.env.MAX_SESSIONS = '50';

      const config = ConfigManager.getInstance().getTransportConfig();

      expect(config.http?.port).toBe(3000);
      expect(config.http?.sessionTimeout).toBe(1800000);
      expect(config.http?.maxSessions).toBe(50);
    });

    it('should configure WebSocket transport with defaults', () => {
      process.env.MCP_TRANSPORT = 'websocket';
      const config = ConfigManager.getInstance().getTransportConfig();

      expect(config.websocket?.port).toBe(8081);
      expect(config.websocket?.secure).toBe(false);
    });

    it('should configure WebSocket transport with custom values', () => {
      process.env.MCP_TRANSPORT = 'websocket';
      process.env.MCP_WS_PORT = '9000';
      process.env.MCP_WS_SECURE = 'true';

      const config = ConfigManager.getInstance().getTransportConfig();

      expect(config.websocket?.port).toBe(9000);
      expect(config.websocket?.secure).toBe(true);
    });
  });

  describe('API Configuration', () => {
    it('should use default API configuration', () => {
      const config = ConfigManager.getInstance().getAPIConfig();

      expect(config.openMeteoBaseUrl).toBe('https://api.open-meteo.com/v1');
      expect(config.geocodingApiUrl).toBe('https://geocoding-api.open-meteo.com/v1');
      expect(config.timeout).toBe(5000);
      expect(config.retries).toBe(3);
      expect(config.retryDelay).toBe(1000);
    });

    it('should use custom API configuration', () => {
      process.env.OPEN_METEO_BASE_URL = 'https://custom-api.example.com/v1';
      process.env.GEOCODING_API_URL = 'https://custom-geocoding.example.com/v1';
      process.env.API_TIMEOUT = '10000';
      process.env.API_RETRIES = '5';
      process.env.API_RETRY_DELAY = '2000';

      const config = ConfigManager.getInstance().getAPIConfig();

      expect(config.openMeteoBaseUrl).toBe('https://custom-api.example.com/v1');
      expect(config.geocodingApiUrl).toBe('https://custom-geocoding.example.com/v1');
      expect(config.timeout).toBe(10000);
      expect(config.retries).toBe(5);
      expect(config.retryDelay).toBe(2000);
    });
  });

  describe('Logging Configuration', () => {
    it('should use debug level in development', () => {
      process.env.NODE_ENV = 'development';
      const config = ConfigManager.getInstance().getLoggingConfig();

      expect(config.level).toBe('debug');
      expect(config.pretty).toBe(true);
    });

    it('should use info level in production', () => {
      process.env.NODE_ENV = 'production';
      const config = ConfigManager.getInstance().getLoggingConfig();

      expect(config.level).toBe('info');
      expect(config.pretty).toBe(false);
    });

    it('should use custom log level', () => {
      process.env.LOG_LEVEL = 'error';
      const config = ConfigManager.getInstance().getLoggingConfig();

      expect(config.level).toBe('error');
    });

    it('should have default redact fields', () => {
      const config = ConfigManager.getInstance().getLoggingConfig();

      expect(config.redact).toEqual(['password', 'token', 'key', 'secret']);
    });
  });

  describe('Security Configuration', () => {
    it('should use default allowed origins', () => {
      const config = ConfigManager.getInstance().getConfig();

      expect(config.security.allowedOrigins).toEqual([
        'http://localhost:3000',
        'http://localhost:8080'
      ]);
    });

    it('should use custom allowed origins', () => {
      process.env.ALLOWED_ORIGINS = 'https://example.com,https://app.example.com';

      const config = ConfigManager.getInstance().getConfig();

      expect(config.security.allowedOrigins).toEqual([
        'https://example.com',
        'https://app.example.com'
      ]);
    });

    it('should trim whitespace from origins', () => {
      process.env.ALLOWED_ORIGINS = ' https://example.com , https://app.example.com ';

      const config = ConfigManager.getInstance().getConfig();

      expect(config.security.allowedOrigins).toEqual([
        'https://example.com',
        'https://app.example.com'
      ]);
    });
  });

  describe('Utility Methods', () => {
    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      const instance = ConfigManager.getInstance();

      expect(instance.isProduction()).toBe(true);
      expect(instance.isDevelopment()).toBe(false);
    });

    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      const instance = ConfigManager.getInstance();

      expect(instance.isProduction()).toBe(false);
      expect(instance.isDevelopment()).toBe(true);
    });

    it('should detect transport types', () => {
      const instance = ConfigManager.getInstance();

      // Test stdio
      process.env.MCP_TRANSPORT = 'stdio';
      expect(instance.shouldUseStdio()).toBe(true);
      expect(instance.shouldUseHTTP()).toBe(false);
      expect(instance.shouldUseWebSocket()).toBe(false);

      // Test http
      process.env.MCP_TRANSPORT = 'http';
      expect(instance.shouldUseStdio()).toBe(false);
      expect(instance.shouldUseHTTP()).toBe(true);
      expect(instance.shouldUseWebSocket()).toBe(false);

      // Test websocket
      process.env.MCP_TRANSPORT = 'websocket';
      expect(instance.shouldUseStdio()).toBe(false);
      expect(instance.shouldUseHTTP()).toBe(false);
      expect(instance.shouldUseWebSocket()).toBe(true);
    });

    it('should get HTTP port', () => {
      process.env.MCP_TRANSPORT = 'http';
      process.env.MCP_HTTP_PORT = '3000';
      const instance = ConfigManager.getInstance();

      expect(instance.getHTTPPort()).toBe(3000);
    });

    it('should get default HTTP port', () => {
      process.env.MCP_TRANSPORT = 'http';
      delete process.env.MCP_HTTP_PORT;
      const instance = ConfigManager.getInstance();

      expect(instance.getHTTPPort()).toBe(8080);
    });

    it('should get WebSocket port', () => {
      process.env.MCP_TRANSPORT = 'websocket';
      process.env.MCP_WS_PORT = '9000';
      const instance = ConfigManager.getInstance();

      expect(instance.getWebSocketPort()).toBe(9000);
    });

    it('should get default WebSocket port', () => {
      process.env.MCP_TRANSPORT = 'websocket';
      delete process.env.MCP_WS_PORT;
      const instance = ConfigManager.getInstance();

      expect(instance.getWebSocketPort()).toBe(8081);
    });

    it('should check allowed origins', () => {
      process.env.ALLOWED_ORIGINS = 'https://example.com,https://app.example.com';
      const instance = ConfigManager.getInstance();

      expect(instance.isOriginAllowed('https://example.com')).toBe(true);
      expect(instance.isOriginAllowed('https://app.example.com')).toBe(true);
      expect(instance.isOriginAllowed('https://notallowed.com')).toBe(false);
      expect(instance.isOriginAllowed('')).toBe(true); // Empty origin allowed
    });
  });

  describe('Configuration Reload', () => {
    it('should reload configuration', () => {
      const instance = ConfigManager.getInstance();
      const originalConfig = instance.getConfig();

      // Change environment
      process.env.NODE_ENV = 'production';

      // Reload config
      instance.reloadConfig();
      const newConfig = instance.getConfig();

      expect(newConfig.env).toBe('production');
      expect(originalConfig.env).toBe('development');
    });
  });

  describe('Convenience Functions', () => {
    it('should export convenience functions', () => {
      const { getConfig, getTransportConfig, getAPIConfig, getLoggingConfig } = require('./config');

      expect(typeof getConfig).toBe('function');
      expect(typeof getTransportConfig).toBe('function');
      expect(typeof getAPIConfig).toBe('function');
      expect(typeof getLoggingConfig).toBe('function');
    });

    it('should return config from convenience functions', () => {
      const { getConfig, getTransportConfig, getAPIConfig, getLoggingConfig } = require('./config');

      const config = getConfig();
      const transportConfig = getTransportConfig();
      const apiConfig = getAPIConfig();
      const loggingConfig = getLoggingConfig();

      expect(config).toBeDefined();
      expect(transportConfig).toBeDefined();
      expect(apiConfig).toBeDefined();
      expect(loggingConfig).toBeDefined();

      expect(config.transport).toBe(transportConfig);
      expect(config.api).toBe(apiConfig);
      expect(config.logging).toBe(loggingConfig);
    });
  });
});
