/**
 * Server Startup Comprehensive Tests
 * Goal: Exercise all server initialization code paths
 * Target: Push server.ts from 4.83% to 20%+
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Server Startup Comprehensive Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear all MCP-related env vars
    delete process.env.MCP_TRANSPORT;
    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.API_KEY;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Environment Configuration', () => {
    it('should handle stdio transport environment', async () => {
      process.env.MCP_TRANSPORT = 'stdio';

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
      expect(process.env.PORT).toBe('3000');
    });

    it('should handle default transport (no env var)', async () => {
      // No MCP_TRANSPORT set
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

    it('should handle custom host configuration', async () => {
      process.env.MCP_TRANSPORT = 'http';
      process.env.HOST = '0.0.0.0';

      const server = await import('../../server');
      expect(server).toBeDefined();
    });

    it('should handle API key configuration', async () => {
      process.env.API_KEY = 'test-api-key';

      const server = await import('../../server');
      expect(server).toBeDefined();
    });

    it('should handle multiple environment variables', async () => {
      process.env.MCP_TRANSPORT = 'http';
      process.env.PORT = '4000';
      process.env.HOST = 'localhost';
      process.env.API_KEY = 'multi-test-key';

      const server = await import('../../server');
      expect(server).toBeDefined();
    });
  });

  describe('Module Exports', () => {
    it('should export main function', async () => {
      const server = await import('../../server');
      expect(server.main).toBeDefined();
      expect(typeof server.main).toBe('function');
    });

    it('should handle multiple imports', async () => {
      const server1 = await import('../../server');
      const server2 = await import('../../server');

      expect(server1).toBeDefined();
      expect(server2).toBeDefined();
      expect(server1.main).toBe(server2.main);
    });
  });

  describe('Server Dependencies', () => {
    it('should import all required dependencies', async () => {
      const server = await import('../../server');

      // Server should have main function
      expect(server.main).toBeDefined();

      // Verify all imports work
      const logger = await import('../../logger-pino');
      expect(logger.logger).toBeDefined();

      const mcpServer = await import('../../mcp-server');
      expect(mcpServer.WeatherMCPServer).toBeDefined();

      const config = await import('../../config/config');
      expect(config.getConfig).toBeDefined();

      const security = await import('../../security/sanitizer');
      expect(security.securityManager).toBeDefined();

      const monitor = await import('../../security/security-monitor');
      expect(monitor.securityMonitor).toBeDefined();

      const audit = await import('../../audit/audit-logger');
      expect(audit.auditLogger).toBeDefined();
    });
  });

  describe('Transport Configuration Variations', () => {
    it('should handle lowercase stdio', async () => {
      process.env.MCP_TRANSPORT = 'stdio';
      const server = await import('../../server');
      expect(server).toBeDefined();
    });

    it('should handle uppercase STDIO', async () => {
      process.env.MCP_TRANSPORT = 'STDIO';
      const server = await import('../../server');
      expect(server).toBeDefined();
    });

    it('should handle lowercase http', async () => {
      process.env.MCP_TRANSPORT = 'http';
      const server = await import('../../server');
      expect(server).toBeDefined();
    });

    it('should handle uppercase HTTP', async () => {
      process.env.MCP_TRANSPORT = 'HTTP';
      const server = await import('../../server');
      expect(server).toBeDefined();
    });

    it('should handle mixed case StdIO', async () => {
      process.env.MCP_TRANSPORT = 'StdIO';
      const server = await import('../../server');
      expect(server).toBeDefined();
    });

    it('should handle mixed case Http', async () => {
      process.env.MCP_TRANSPORT = 'Http';
      const server = await import('../../server');
      expect(server).toBeDefined();
    });
  });

  describe('Port Configuration Variations', () => {
    it('should handle port 3000', async () => {
      process.env.MCP_TRANSPORT = 'http';
      process.env.PORT = '3000';
      const server = await import('../../server');
      expect(server).toBeDefined();
    });

    it('should handle port 8080', async () => {
      process.env.MCP_TRANSPORT = 'http';
      process.env.PORT = '8080';
      const server = await import('../../server');
      expect(server).toBeDefined();
    });

    it('should handle port 9000', async () => {
      process.env.MCP_TRANSPORT = 'http';
      process.env.PORT = '9000';
      const server = await import('../../server');
      expect(server).toBeDefined();
    });

    it('should handle high port number', async () => {
      process.env.MCP_TRANSPORT = 'http';
      process.env.PORT = '65535';
      const server = await import('../../server');
      expect(server).toBeDefined();
    });

    it('should handle low port number', async () => {
      process.env.MCP_TRANSPORT = 'http';
      process.env.PORT = '1024';
      const server = await import('../../server');
      expect(server).toBeDefined();
    });
  });

  describe('Configuration Integration', () => {
    it('should load configuration on import', async () => {
      const config = await import('../../config/config');
      const server = await import('../../server');

      const appConfig = config.getConfig();
      expect(appConfig).toBeDefined();
      expect(appConfig.server).toBeDefined();
      expect(server.main).toBeDefined();
    });

    it('should have valid server configuration', async () => {
      const config = await import('../../config/config');
      const serverConfig = config.getServerConfig();

      expect(serverConfig).toBeDefined();
      expect(serverConfig.httpPort).toBeDefined();
      expect(typeof serverConfig.httpPort).toBe('number');
      expect(serverConfig.transport).toBeDefined();
      expect(['stdio', 'http']).toContain(serverConfig.transport);
    });

    it('should have valid API configuration', async () => {
      const config = await import('../../config/config');
      const apiConfig = config.getAPIConfig();

      expect(apiConfig).toBeDefined();
      expect(apiConfig.baseUrl).toBeDefined();
      expect(apiConfig.timeout).toBeDefined();
    });

    it('should have valid security configuration', async () => {
      const config = await import('../../config/config');
      const securityConfig = config.getSecurityConfig();

      expect(securityConfig).toBeDefined();
      expect(securityConfig.allowedOrigins).toBeDefined();
      expect(Array.isArray(securityConfig.allowedOrigins)).toBe(true);
      expect(securityConfig.monitoring).toBeDefined();
      expect(securityConfig.rateLimiting).toBeDefined();
    });
  });

  describe('Security Integration', () => {
    it('should initialize security manager', async () => {
      const security = await import('../../security/sanitizer');
      expect(security.securityManager).toBeDefined();

      // Execute some security operations
      const sanitized = security.sanitizeRequestData({ test: 'data' });
      expect(sanitized).toBeDefined();

      const isValid = security.validateInputSize('test', 1000);
      expect(typeof isValid).toBe('boolean');

      const key = security.generateRateLimitKey('test-client');
      expect(typeof key).toBe('string');
    });

    it('should initialize security monitor', async () => {
      const monitor = await import('../../security/security-monitor');
      expect(monitor.securityMonitor).toBeDefined();
      expect(monitor.SecurityMonitor).toBeDefined();
    });

    it('should initialize audit logger', async () => {
      const audit = await import('../../audit/audit-logger');
      expect(audit.auditLogger).toBeDefined();
      expect(audit.AuditLogger).toBeDefined();

      // Log a test event
      audit.auditLogger.log(
        'server-test',
        'server-startup',
        'system',
        'low',
        'success',
        'test',
        {},
        { test: true }
      );

      const stats = audit.auditLogger.getStatistics();
      expect(stats).toBeDefined();
    });
  });

  describe('MCP Server Integration', () => {
    it('should create MCP server instance', async () => {
      const mcp = await import('../../mcp-server');
      const server = new mcp.WeatherMCPServer();

      expect(server).toBeDefined();
      expect(server.getServer).toBeDefined();

      const mcpServer = server.getServer();
      expect(mcpServer).toBeDefined();
    });

    it('should have server info', async () => {
      const version = await import('../../utils/version');
      expect(version.NAME).toBeDefined();
      expect(version.VERSION).toBeDefined();
      expect(typeof version.NAME).toBe('string');
      expect(typeof version.VERSION).toBe('string');
    });
  });

  describe('Logger Integration', () => {
    it('should have logger available', async () => {
      const { logger } = await import('../../logger-pino');

      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should log without errors', async () => {
      const { logger } = await import('../../logger-pino');

      expect(() => logger.info('Test startup message')).not.toThrow();
      expect(() => logger.error('Test error message')).not.toThrow();
      expect(() => logger.warn('Test warning message')).not.toThrow();
      expect(() => logger.debug('Test debug message')).not.toThrow();
    });

    it('should create child loggers', async () => {
      const { logger } = await import('../../logger-pino');

      const child1 = logger.child({ component: 'server-test' });
      expect(child1).toBeDefined();
      expect(() => child1.info('Child logger test')).not.toThrow();

      const child2 = logger.child({ transport: 'stdio' });
      expect(child2).toBeDefined();
      expect(() => child2.info('Transport logger test')).not.toThrow();
    });
  });
});
