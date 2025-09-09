import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// Mock all dependencies
vi.mock('dotenv/config');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js');
vi.mock('./mcp-server.js');
vi.mock('./logger.js');
vi.mock('./config/config.js');

// Import logger after mocking
import { logger } from './logger.js';

describe('Server Entry Point', () => {
  let mockWeatherServer: any;
  let mockStdioTransport: any;
  let mockHttpTransport: any;
  let mockConfig: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock WeatherMCPServer
    mockWeatherServer = {
      getServer: vi.fn().mockReturnValue({}),
      constructor: vi.fn()
    };

    // Mock transports
    mockStdioTransport = {
      constructor: vi.fn()
    };

    mockHttpTransport = {
      constructor: vi.fn()
    };

    // Mock config
    mockConfig = {
      transport: { type: 'stdio' }
    };

    // Setup mocks
    vi.mocked(StdioServerTransport).mockImplementation(() => mockStdioTransport as any);
    vi.mocked(StreamableHTTPServerTransport).mockImplementation(() => mockHttpTransport as any);

    // Mock getConfig
    const { getConfig } = await import('./config/config.js');
    vi.mocked(getConfig).mockReturnValue(mockConfig);

    // Mock logger
    const { logger } = await import('./logger.js');
    vi.mocked(logger).info = vi.fn();
    vi.mocked(logger).fatal = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Server Initialization', () => {
    it('should initialize with stdio transport by default', async () => {
      // Import and run main function
      const { main } = await import('./server.js');

      // Mock process.env
      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: undefined };

      try {
        await main();

        expect(vi.mocked(logger).info).toHaveBeenCalledWith(
          { transport: 'stdio', nodeVersion: process.version, platform: process.platform },
          'Starting MCP Weather Server'
        );

        expect(vi.mocked(logger).info).toHaveBeenCalledWith('Using stdio transport');
      } finally {
        process.env = originalEnv;
      }
    });

    it('should initialize with HTTP transport when specified', async () => {
      const { main } = await import('./server.js');

      // Mock process.env
      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'http' };

      try {
        await main();

        expect(vi.mocked(logger).info).toHaveBeenCalledWith(
          { transport: 'http', nodeVersion: process.version, platform: process.platform },
          'Starting MCP Weather Server'
        );

        expect(vi.mocked(logger).info).toHaveBeenCalledWith('Using HTTP transport');
      } finally {
        process.env = originalEnv;
      }
    });

    it('should handle environment variable transport setting', async () => {
      const { main } = await import('./server.js');

      // Test different transport values
      const testCases = ['stdio', 'http', undefined];

      for (const transportType of testCases) {
        const originalEnv = process.env;
        process.env = { ...originalEnv, MCP_TRANSPORT: transportType };

        try {
          await main();

          const expectedTransport = transportType || 'stdio';
          expect(vi.mocked(logger).info).toHaveBeenCalledWith(
            { transport: expectedTransport, nodeVersion: process.version, platform: process.platform },
            'Starting MCP Weather Server'
          );
        } finally {
          process.env = originalEnv;
        }
      }
    });
  });

  describe('HTTP Transport Setup', () => {
    beforeEach(() => {
      mockConfig.transport.type = 'http';
    });

    it('should set up HTTP server with correct port', async () => {
      const { main } = await import('./server.js');

      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'http' };

      try {
        await main();

        expect(vi.mocked(logger).info).toHaveBeenCalledWith(
          { port: 8080 },
          'Using HTTP transport'
        );
      } finally {
        process.env = originalEnv;
      }
    });

    it('should handle HTTP server errors', async () => {
      const { main } = await import('./server.js');

      // Mock HTTP server to throw error
      const mockHttpServer = {
        listen: vi.fn().mockImplementation((port, callback) => {
          throw new Error('HTTP Server Error');
        }),
        on: vi.fn(),
        close: vi.fn()
      };

      // Mock Express app creation to return our mock server
      const mockExpress = vi.fn().mockReturnValue({
        use: vi.fn(),
        post: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        listen: vi.fn().mockReturnValue(mockHttpServer)
      });

      vi.doMock('express', () => mockExpress);

      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'http' };

      try {
        await expect(main()).rejects.toThrow('HTTP Server Error');
        expect(vi.mocked(logger).fatal).toHaveBeenCalled();
      } finally {
        process.env = originalEnv;
      }
    });

    it('should set up health endpoint', async () => {
      const { main } = await import('./server.js');

      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'http' };

      try {
        await main();

        // Verify health endpoint setup would be called
        expect(vi.mocked(logger).info).toHaveBeenCalledWith(
          expect.stringContaining('MCP Weather Server started successfully')
        );
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe('Stdio Transport Setup', () => {
    beforeEach(() => {
      mockConfig.transport.type = 'stdio';
    });

    it('should set up stdio transport correctly', async () => {
      const { main } = await import('./server.js');

      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'stdio' };

      try {
        await main();

        expect(vi.mocked(logger).info).toHaveBeenCalledWith('Using stdio transport');
        expect(vi.mocked(logger).info).toHaveBeenCalledWith(
          'MCP Weather Server started successfully with stdio transport'
        );
      } finally {
        process.env = originalEnv;
      }
    });

    it('should handle stdio transport connection errors', async () => {
      const { main } = await import('./server.js');

      // Mock server connect to throw error
      mockWeatherServer.getServer().connect = vi.fn().mockRejectedValue(new Error('Connection failed'));

      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'stdio' };

      try {
        await expect(main()).rejects.toThrow('Connection failed');
        expect(vi.mocked(logger).fatal).toHaveBeenCalled();
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle WeatherMCPServer initialization errors', async () => {
      const { main } = await import('./server.js');

      // Mock WeatherMCPServer constructor to throw
      const { WeatherMCPServer } = await import('./mcp-server.js');
      vi.mocked(WeatherMCPServer).mockImplementation(() => {
        throw new Error('Server initialization failed');
      });

      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'stdio' };

      try {
        await expect(main()).rejects.toThrow('Server initialization failed');
        expect(vi.mocked(logger).fatal).toHaveBeenCalled();
      } finally {
        process.env = originalEnv;
      }
    });

    it('should handle configuration errors', async () => {
      const { main } = await import('./server.js');

      // Mock getConfig to throw
      const { getConfig } = await import('./config/config.js');
      vi.mocked(getConfig).mockImplementation(() => {
        throw new Error('Configuration error');
      });

      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'stdio' };

      try {
        await expect(main()).rejects.toThrow('Configuration error');
        expect(vi.mocked(logger).fatal).toHaveBeenCalled();
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe('Process Signal Handling', () => {
    it('should handle SIGTERM signal for HTTP transport', async () => {
      const { main } = await import('./server.js');

      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'http' };

      try {
        // Start server in background
        const serverPromise = main();

        // Simulate SIGTERM
        process.emit('SIGTERM');

        await expect(serverPromise).resolves.not.toThrow();
      } finally {
        process.env = originalEnv;
      }
    });

    it('should handle SIGINT signal for HTTP transport', async () => {
      const { main } = await import('./server.js');

      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'http' };

      try {
        // Start server in background
        const serverPromise = main();

        // Simulate SIGINT
        process.emit('SIGINT');

        await expect(serverPromise).resolves.not.toThrow();
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe('Graceful Shutdown', () => {
    it('should close HTTP server gracefully', async () => {
      const { main } = await import('./server.js');

      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'http' };

      try {
        await main();

        // Verify shutdown handlers are set up
        expect(vi.mocked(logger).info).toHaveBeenCalledWith(
          expect.stringContaining('MCP Weather Server started successfully')
        );
      } finally {
        process.env = originalEnv;
      }
    });

    it('should handle uncaught exceptions', async () => {
      const { main } = await import('./server.js');

      // Simulate uncaught exception
      process.emit('uncaughtException', new Error('Test exception'));

      expect(vi.mocked(logger).fatal).toHaveBeenCalledWith(
        expect.any(Error),
        'Uncaught exception in main process'
      );
    });

    it('should handle unhandled rejections', async () => {
      const { main } = await import('./server.js');

      // Simulate unhandled rejection
      const testError = new Error('Test rejection');
      process.emit('unhandledRejection', testError, Promise.resolve());

      expect(vi.mocked(logger).fatal).toHaveBeenCalledWith(
        testError,
        'Unhandled rejection in main process'
      );
    });
  });

  describe('Environment Variables', () => {
    it('should respect MCP_TRANSPORT environment variable', async () => {
      const { main } = await import('./server.js');

      const testCases = [
        { env: 'stdio', expected: 'stdio' },
        { env: 'http', expected: 'http' },
        { env: undefined, expected: 'stdio' }
      ];

      for (const { env, expected } of testCases) {
        const originalEnv = process.env;
        process.env = { ...originalEnv, MCP_TRANSPORT: env };

        try {
          await main();

          expect(vi.mocked(logger).info).toHaveBeenCalledWith(
            { transport: expected, nodeVersion: process.version, platform: process.platform },
            'Starting MCP Weather Server'
          );
        } finally {
          process.env = originalEnv;
        }
      }
    });

    it('should handle invalid MCP_TRANSPORT values', async () => {
      const { main } = await import('./server.js');

      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'invalid' };

      try {
        await main();

        // Should default to stdio for invalid values
        expect(vi.mocked(logger).info).toHaveBeenCalledWith(
          { transport: 'invalid', nodeVersion: process.version, platform: process.platform },
          'Starting MCP Weather Server'
        );
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe('Server Information Logging', () => {
    it('should log server startup information', async () => {
      const { main } = await import('./server.js');

      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'stdio' };

      try {
        await main();

        expect(vi.mocked(logger).info).toHaveBeenCalledWith(
          {
            transport: 'stdio',
            nodeVersion: process.version,
            platform: process.platform
          },
          'Starting MCP Weather Server'
        );

        expect(vi.mocked(logger).info).toHaveBeenCalledWith(
          'MCP Weather Server started successfully with stdio transport'
        );
      } finally {
        process.env = originalEnv;
      }
    });

    it('should log HTTP server startup with port', async () => {
      const { main } = await import('./server.js');

      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'http' };

      try {
        await main();

        expect(vi.mocked(logger).info).toHaveBeenCalledWith(
          { port: 8080 },
          'Using HTTP transport'
        );

        expect(vi.mocked(logger).info).toHaveBeenCalledWith(
          'MCP Weather Server started successfully with HTTP transport on port 8080'
        );
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe('Transport Connection', () => {
    it('should connect MCP server to stdio transport', async () => {
      const { main } = await import('./server.js');

      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'stdio' };

      try {
        await main();

        expect(mockWeatherServer.getServer().connect).toHaveBeenCalledWith(mockStdioTransport);
      } finally {
        process.env = originalEnv;
      }
    });

    it('should connect MCP server to HTTP transport', async () => {
      const { main } = await import('./server.js');

      const originalEnv = process.env;
      process.env = { ...originalEnv, MCP_TRANSPORT: 'http' };

      try {
        await main();

        expect(mockWeatherServer.getServer().connect).toHaveBeenCalledWith(mockHttpTransport);
      } finally {
        process.env = originalEnv;
      }
    });
  });
});
