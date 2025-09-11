import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mocks for dependencies
const mockStdioServerTransport = vi.fn();
const mockStreamableHTTPServerTransport = vi.fn();
const mockWeatherMCPServer = vi.fn();
const mockFastify = vi.fn();
const mockServer = {
  connect: vi.fn(),
  close: vi.fn()
};
const mockGetServer = vi.fn(() => mockServer);
const mockSimpleSSETransport = vi.fn();
const mockSSEStart = vi.fn();

// Mock all dependencies before imports
vi.mock('dotenv/config');

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: mockStdioServerTransport
}));

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: mockStreamableHTTPServerTransport
}));

vi.mock('./mcp-server.js', () => ({
  WeatherMCPServer: mockWeatherMCPServer
}));

vi.mock('./transports/sse-transport.js', () => ({
  SimpleSSETransport: mockSimpleSSETransport
}));

vi.mock('fastify', () => ({
  default: mockFastify
}));

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-123')
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  isInitializeRequest: vi.fn((req) => req?.method === 'initialize')
}));

// Create config mock
const mockConfig = {
  server: { 
    transport: 'stdio',
    httpPort: 8080,
    ssePort: 8081
  },
  logging: { level: 'info' },
  security: { allowedOrigins: ['http://localhost:3000'] },
  performance: { apiTimeout: 5000 },
  resilience: { 
    circuitBreaker: { threshold: 5, timeout: 60000 },
    retry: { maxRetries: 3, baseDelay: 1000 }
  }
};

vi.mock('./config/config.js', () => ({
  getConfig: vi.fn(() => mockConfig)
}));

vi.mock('./logger-pino.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    warn: vi.fn()
  }
}));

describe('Server Entry Point', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let processExitSpy: any;
  let processOnSpy: any;
  let mockSSEInstance: any;
  let mockTransportInstance: any;
  let mockFastifyInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = { ...process.env };
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    processOnSpy = vi.spyOn(process, 'on');
    
    // Setup mock implementations
    mockWeatherMCPServer.mockImplementation(() => ({
      getServer: mockGetServer
    }));
    
    mockTransportInstance = {
      connect: vi.fn().mockResolvedValue(undefined),
      handleRequest: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      onclose: undefined,
      sessionId: 'test-session-123'
    };
    
    mockStdioServerTransport.mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined)
    }));
    
    mockStreamableHTTPServerTransport.mockImplementation(() => mockTransportInstance);
    
    mockFastifyInstance = {
      register: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    };
    mockFastify.mockReturnValue(mockFastifyInstance);
    
    mockSSEInstance = {
      start: mockSSEStart,
      close: vi.fn().mockResolvedValue(undefined)
    };
    mockSimpleSSETransport.mockImplementation(() => mockSSEInstance);
    
    mockSSEStart.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    processExitSpy.mockRestore();
    processOnSpy.mockRestore();
    vi.resetModules();
  });

  describe('Basic Server Functionality', () => {
    it('should export main function', async () => {
      const serverModule = await import('./server.js');
      expect(typeof serverModule.main).toBe('function');
    });

    it('should be able to import server module', async () => {
      const serverModule = await import('./server.js');
      expect(serverModule).toBeDefined();
      expect(serverModule.main).toBeDefined();
    });

    it('should have main function that is async', async () => {
      const serverModule = await import('./server.js');
      expect(serverModule.main.constructor.name).toBe('AsyncFunction');
    });
  });

  describe('Environment Variable Handling', () => {
    it('should handle different MCP_TRANSPORT values', async () => {
      const testCases = [
        { env: 'stdio', expected: 'stdio' },
        { env: 'http', expected: 'http' },
        { env: undefined, expected: 'stdio' }
      ];

      for (const { env, expected } of testCases) {
        vi.clearAllMocks();
        process.env.MCP_TRANSPORT = env;
        
        const { logger } = await import('./logger-pino.js');
        const { main } = await import('./server.js');
        
        // Configure for stdio transport
        mockConfig.server.transport = expected === 'stdio' ? 'stdio' : 'http';
        
        await main();
        
        expect(logger.info).toHaveBeenCalledWith(
          'Starting MCP Weather Server',
          expect.objectContaining({
            transport: expected
          })
        );
      }
    });
  });

  describe('Server Module Structure', () => {
    it('should have proper module exports', async () => {
      const serverModule = await import('./server.js');
      expect(serverModule).toHaveProperty('main');
      expect(typeof serverModule.main).toBe('function');
    });
  });

  describe('Server Startup Logic', () => {
    it('should handle basic server startup flow', async () => {
      const { main } = await import('./server.js');
      const { logger } = await import('./logger-pino.js');
      
      mockConfig.server.transport = 'stdio';
      await main();
      
      expect(logger.info).toHaveBeenCalledWith(
        'Starting MCP Weather Server',
        expect.anything()
      );
      expect(mockWeatherMCPServer).toHaveBeenCalled();
    });
  });

  describe('Main Function Execution', () => {
    describe('Stdio Transport Path', () => {
      it('should execute main function with stdio transport', async () => {
        const { main } = await import('./server.js');
        const { logger } = await import('./logger-pino.js');
        
        mockConfig.server.transport = 'stdio';
        process.env.MCP_TRANSPORT = 'stdio';
        
        await main();
        
        expect(mockWeatherMCPServer).toHaveBeenCalled();
        expect(mockStdioServerTransport).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('stdio transport'),
          expect.any(Object)
        );
      });
    });

    describe('HTTP Transport Path', () => {
      it('should execute main function with HTTP transport', async () => {
        const { main } = await import('./server.js');
        const { logger } = await import('./logger-pino.js');
        
        mockConfig.server.transport = 'http';
        process.env.MCP_TRANSPORT = 'http';
        
        await main();
        
        expect(mockWeatherMCPServer).toHaveBeenCalled();
        expect(mockFastify).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('HTTP transport'),
          expect.any(Object)
        );
      });

      it('should set up all HTTP endpoints correctly', async () => {
        const { main } = await import('./server.js');
        
        mockConfig.server.transport = 'http';
        process.env.MCP_TRANSPORT = 'http';
        
        await main();
        
        // Check all endpoints were registered
        expect(mockFastifyInstance.post).toHaveBeenCalledWith('/mcp', expect.any(Function));
        expect(mockFastifyInstance.get).toHaveBeenCalledWith('/mcp', expect.any(Function));
        expect(mockFastifyInstance.delete).toHaveBeenCalledWith('/mcp', expect.any(Function));
        expect(mockFastifyInstance.get).toHaveBeenCalledWith('/health', expect.any(Function));
      });

      it('should handle POST /mcp with new session', async () => {
        const { main } = await import('./server.js');
        const { isInitializeRequest } = await import('@modelcontextprotocol/sdk/types.js');
        
        mockConfig.server.transport = 'http';
        await main();
        
        // Get the POST handler
        const postHandler = mockFastifyInstance.post.mock.calls[0][1];
        
        const request = {
          headers: {},
          body: { method: 'initialize' },
          raw: {}
        };
        const reply = {
          status: vi.fn().mockReturnThis(),
          send: vi.fn(),
          raw: {}
        };
        
        (isInitializeRequest as any).mockReturnValue(true);
        
        await postHandler(request, reply);
        
        expect(mockStreamableHTTPServerTransport).toHaveBeenCalled();
        expect(mockServer.connect).toHaveBeenCalledWith(mockTransportInstance);
      });

      it('should handle POST /mcp with existing session', async () => {
        const { main } = await import('./server.js');
        
        mockConfig.server.transport = 'http';
        await main();
        
        // First create a session
        const postHandler = mockFastifyInstance.post.mock.calls[0][1];
        const { isInitializeRequest } = await import('@modelcontextprotocol/sdk/types.js');
        (isInitializeRequest as any).mockReturnValue(true);
        
        // Create initial session
        await postHandler(
          { headers: {}, body: { method: 'initialize' }, raw: {} },
          { status: vi.fn().mockReturnThis(), send: vi.fn(), raw: {} }
        );
        
        // Call onsessioninitialized to store the transport
        const onsessioninitialized = mockStreamableHTTPServerTransport.mock.calls[0][0].onsessioninitialized;
        onsessioninitialized('test-session-123');
        
        // Now test with existing session
        const request = {
          headers: { 'mcp-session-id': 'test-session-123' },
          body: { method: 'tools/list' },
          raw: {}
        };
        const reply = { status: vi.fn().mockReturnThis(), send: vi.fn(), raw: {} };
        
        await postHandler(request, reply);
        
        expect(mockTransportInstance.handleRequest).toHaveBeenCalled();
      });

      it('should handle POST /mcp with invalid request', async () => {
        const { main } = await import('./server.js');
        const { isInitializeRequest } = await import('@modelcontextprotocol/sdk/types.js');
        
        mockConfig.server.transport = 'http';
        await main();
        
        const postHandler = mockFastifyInstance.post.mock.calls[0][1];
        
        const request = {
          headers: {},
          body: { method: 'tools/list' }, // Not an initialize request
          raw: {}
        };
        const reply = {
          status: vi.fn().mockReturnThis(),
          send: vi.fn(),
          raw: {}
        };
        
        (isInitializeRequest as any).mockReturnValue(false);
        
        await postHandler(request, reply);
        
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
          error: expect.objectContaining({
            message: 'Bad Request: No valid session ID provided'
          })
        }));
      });

      it('should handle GET /mcp with valid session', async () => {
        const { main } = await import('./server.js');
        
        mockConfig.server.transport = 'http';
        await main();
        
        // Setup session first
        const postHandler = mockFastifyInstance.post.mock.calls[0][1];
        const { isInitializeRequest } = await import('@modelcontextprotocol/sdk/types.js');
        (isInitializeRequest as any).mockReturnValue(true);
        
        await postHandler(
          { headers: {}, body: { method: 'initialize' }, raw: {} },
          { status: vi.fn().mockReturnThis(), send: vi.fn(), raw: {} }
        );
        
        const onsessioninitialized = mockStreamableHTTPServerTransport.mock.calls[0][0].onsessioninitialized;
        onsessioninitialized('test-session-123');
        
        // Test GET with session
        const getHandler = mockFastifyInstance.get.mock.calls.find((call: any) => call[0] === '/mcp')[1];
        
        const request = {
          headers: { 'mcp-session-id': 'test-session-123' },
          raw: {}
        };
        const reply = { status: vi.fn().mockReturnThis(), send: vi.fn(), raw: {} };
        
        await getHandler(request, reply);
        
        expect(mockTransportInstance.handleRequest).toHaveBeenCalled();
      });

      it('should handle GET /mcp with invalid session', async () => {
        const { main } = await import('./server.js');
        
        mockConfig.server.transport = 'http';
        await main();
        
        const getHandler = mockFastifyInstance.get.mock.calls.find((call: any) => call[0] === '/mcp')[1];
        
        const request = {
          headers: { 'mcp-session-id': 'invalid-session' },
          raw: {}
        };
        const reply = {
          status: vi.fn().mockReturnThis(),
          send: vi.fn(),
          raw: {}
        };
        
        await getHandler(request, reply);
        
        expect(reply.status).toHaveBeenCalledWith(400);
        expect(reply.send).toHaveBeenCalledWith('Invalid or missing session ID');
      });

      it('should handle DELETE /mcp', async () => {
        const { main } = await import('./server.js');
        
        mockConfig.server.transport = 'http';
        await main();
        
        // Setup session
        const postHandler = mockFastifyInstance.post.mock.calls[0][1];
        const { isInitializeRequest } = await import('@modelcontextprotocol/sdk/types.js');
        (isInitializeRequest as any).mockReturnValue(true);
        
        await postHandler(
          { headers: {}, body: { method: 'initialize' }, raw: {} },
          { status: vi.fn().mockReturnThis(), send: vi.fn(), raw: {} }
        );
        
        const onsessioninitialized = mockStreamableHTTPServerTransport.mock.calls[0][0].onsessioninitialized;
        onsessioninitialized('test-session-123');
        
        // Test DELETE
        const deleteHandler = mockFastifyInstance.delete.mock.calls[0][1];
        
        const request = {
          headers: { 'mcp-session-id': 'test-session-123' },
          raw: {}
        };
        const reply = { raw: {} };
        
        await deleteHandler(request, reply);
        
        expect(mockTransportInstance.handleRequest).toHaveBeenCalled();
      });

      it('should handle /health endpoint', async () => {
        const { main } = await import('./server.js');
        
        mockConfig.server.transport = 'http';
        await main();
        
        const healthHandler = mockFastifyInstance.get.mock.calls.find((call: any) => call[0] === '/health')[1];
        
        const request = {};
        const reply = {
          send: vi.fn()
        };
        
        await healthHandler(request, reply);
        
        expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
          status: 'healthy',
          transport: 'http',
          activeSessions: expect.any(Number)
        }));
      });

      it('should handle Fastify listen error', async () => {
        const { main } = await import('./server.js');
        const { logger } = await import('./logger-pino.js');
        
        mockConfig.server.transport = 'http';
        mockFastifyInstance.listen.mockRejectedValueOnce(new Error('Port in use'));
        
        await main();
        
        expect(logger.fatal).toHaveBeenCalledWith('HTTP server error', { error: 'Port in use' });
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should handle transport cleanup on close', async () => {
        const { main } = await import('./server.js');
        
        mockConfig.server.transport = 'http';
        await main();
        
        // Setup session
        const postHandler = mockFastifyInstance.post.mock.calls[0][1];
        const { isInitializeRequest } = await import('@modelcontextprotocol/sdk/types.js');
        (isInitializeRequest as any).mockReturnValue(true);
        
        await postHandler(
          { headers: {}, body: { method: 'initialize' }, raw: {} },
          { status: vi.fn().mockReturnThis(), send: vi.fn(), raw: {} }
        );
        
        const onsessioninitialized = mockStreamableHTTPServerTransport.mock.calls[0][0].onsessioninitialized;
        onsessioninitialized('test-session-123');
        
        // Trigger onclose
        mockTransportInstance.onclose();
        
        // Now GET should fail with this session
        const getHandler = mockFastifyInstance.get.mock.calls.find((call: any) => call[0] === '/mcp')[1];
        const reply = { status: vi.fn().mockReturnThis(), send: vi.fn(), raw: {} };
        
        await getHandler(
          { headers: { 'mcp-session-id': 'test-session-123' }, raw: {} },
          reply
        );
        
        expect(reply.status).toHaveBeenCalledWith(400);
      });
    });

    describe('Error Scenarios', () => {
      it('should handle WeatherMCPServer initialization errors', async () => {
        const { main } = await import('./server.js');
        const { logger } = await import('./logger-pino.js');
        
        mockWeatherMCPServer.mockImplementationOnce(() => {
          throw new Error('Server initialization failed');
        });
        
        await main();
        
        expect(logger.fatal).toHaveBeenCalledWith(
          'Failed to start MCP Weather Server',
          expect.objectContaining({
            error: 'Server initialization failed'
          })
        );
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should handle configuration errors', async () => {
        const { getConfig } = await import('./config/config.js');
        const { main } = await import('./server.js');
        const { logger } = await import('./logger-pino.js');
        
        (getConfig as any).mockImplementationOnce(() => {
          throw new Error('Configuration error');
        });
        
        await main();
        
        expect(logger.fatal).toHaveBeenCalledWith(
          'Failed to start MCP Weather Server',
          expect.objectContaining({
            error: 'Configuration error'
          })
        );
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });

      it('should handle transport connection errors', async () => {
        const { main } = await import('./server.js');
        const { logger } = await import('./logger-pino.js');
        
        mockServer.connect.mockRejectedValueOnce(new Error('Connection failed'));
        
        mockConfig.server.transport = 'stdio';
        
        await main();
        
        expect(logger.fatal).toHaveBeenCalledWith(
          'Failed to start MCP Weather Server',
          expect.objectContaining({
            error: 'Connection failed'
          })
        );
        expect(processExitSpy).toHaveBeenCalledWith(1);
      });
    });

    describe('Process Signal Handling', () => {
      it('should handle SIGTERM for HTTP transport', async () => {
        const { main } = await import('./server.js');
        const { logger } = await import('./logger-pino.js');
        
        // Mock streaming metrics
        vi.mock('./undici-resilience/streaming/streaming-metrics.js', () => ({
          streamingMetricsCollector: {
            cleanup: vi.fn()
          }
        }));
        
        mockConfig.server.transport = 'http';
        await main();
        
        // Setup a session to test cleanup
        const postHandler = mockFastifyInstance.post.mock.calls[0][1];
        const { isInitializeRequest } = await import('@modelcontextprotocol/sdk/types.js');
        (isInitializeRequest as any).mockReturnValue(true);
        
        await postHandler(
          { headers: {}, body: { method: 'initialize' }, raw: {} },
          { status: vi.fn().mockReturnThis(), send: vi.fn(), raw: {} }
        );
        
        const onsessioninitialized = mockStreamableHTTPServerTransport.mock.calls[0][0].onsessioninitialized;
        onsessioninitialized('test-session-123');
        
        // Execute SIGTERM handler
        const sigTermCall = processOnSpy.mock.calls.find(
          (call: any[]) => call[0] === 'SIGTERM'
        );
        
        // Use setTimeout to handle async operations
        vi.useFakeTimers();
        
        if (sigTermCall && sigTermCall[1]) {
          const shutdownPromise = sigTermCall[1]();
          vi.advanceTimersByTime(200);
          await shutdownPromise;
          
          expect(logger.info).toHaveBeenCalledWith('Shutting down gracefully');
          expect(mockTransportInstance.close).toHaveBeenCalled();
          expect(mockFastifyInstance.close).toHaveBeenCalled();
        }
        
        vi.useRealTimers();
      });

      it('should handle SIGTERM for SSE transport', async () => {
        const { main } = await import('./server.js');
        const { logger } = await import('./logger-pino.js');
        
        mockConfig.server.transport = 'sse';
        await main();
        
        // Find and execute SIGTERM handler
        const sigTermCall = processOnSpy.mock.calls.find(
          (call: any[]) => call[0] === 'SIGTERM'
        );
        
        if (sigTermCall && sigTermCall[1]) {
          await sigTermCall[1]();
          expect(logger.info).toHaveBeenCalledWith('Shutting down SSE server gracefully');
          expect(mockSSEInstance.close).toHaveBeenCalled();
          expect(processExitSpy).toHaveBeenCalledWith(0);
        }
      });

      it('should prevent multiple shutdown attempts', async () => {
        const { main } = await import('./server.js');
        
        mockConfig.server.transport = 'http';
        await main();
        
        // Get the SIGTERM handler (should be the safeShutdown wrapper)
        const removeListenersSpy = vi.spyOn(process, 'removeAllListeners');
        
        // Verify removeAllListeners was called
        expect(removeListenersSpy).toHaveBeenCalledWith('SIGTERM');
        expect(removeListenersSpy).toHaveBeenCalledWith('SIGINT');
      });
    });

    describe('Session Management', () => {
      it('should handle session creation and cleanup', async () => {
        const { main } = await import('./server.js');
        
        mockConfig.server.transport = 'stdio';
        await main();
        
        expect(mockGetServer).toHaveBeenCalled();
        expect(mockServer).toBeDefined();
      });
    });

    describe('SSE Transport Path', () => {
      it('should execute main function with SSE transport', async () => {
        const { main } = await import('./server.js');
        const { logger } = await import('./logger-pino.js');
        
        mockConfig.server.transport = 'sse';
        mockConfig.server.ssePort = 8081;
        
        await main();
        
        expect(mockWeatherMCPServer).toHaveBeenCalled();
        expect(mockSimpleSSETransport).toHaveBeenCalled();
        expect(mockSSEStart).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith('Using Simple SSE transport', { port: 8081 });
        expect(logger.info).toHaveBeenCalledWith('Simple SSE server started on port 8081');
      });

      it('should handle SIGINT for SSE transport', async () => {
        const { main } = await import('./server.js');
        
        mockConfig.server.transport = 'sse';
        await main();
        
        const sigIntCall = processOnSpy.mock.calls.find(
          (call: any[]) => call[0] === 'SIGINT'
        );
        
        if (sigIntCall && sigIntCall[1]) {
          await sigIntCall[1]();
          expect(mockSSEInstance.close).toHaveBeenCalled();
          expect(processExitSpy).toHaveBeenCalledWith(0);
        }
      });
    });
  });
});