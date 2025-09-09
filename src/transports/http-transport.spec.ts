import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock all dependencies
vi.mock('http');
vi.mock('uuid');
vi.mock('../mcp-server.js');
vi.mock('../logger.js');
vi.mock('../config/config.js');

// Mock logger to prevent config access issues
const mockLogger = {
  logTransportEvent: vi.fn(),
  logSecurityEvent: vi.fn(),
  logError: vi.fn(),
  logMCPRequest: vi.fn(),
  logMCPResponse: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn()
};

vi.mocked(require('../logger.js')).logger = mockLogger;

// Mock the config module before importing
const mockConfig = {
  security: {
    allowedOrigins: ['http://localhost:3000', 'http://localhost:8080']
  }
};

const mockTransportConfig = {
  http: {
    port: 8080
  }
};

vi.mocked(require('../config/config.js')).getConfig.mockReturnValue(mockConfig);
vi.mocked(require('../config/config.js')).getTransportConfig.mockReturnValue(mockTransportConfig);

// Import after mocking
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { WeatherMCPServer } from '../mcp-server.js';
import { logger } from '../logger.js';
import { getConfig, getTransportConfig } from '../config/config.js';
import { StreamableHTTPTransport } from './http-transport';

describe('StreamableHTTPTransport', () => {
  let mockServer: any;
  let mockWeatherServer: any;
  let mockConfig: any;
  let mockTransportConfig: any;
  let mockHttpServer: any;
  let transport: StreamableHTTPTransport;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockServer = {
      connect: vi.fn().mockResolvedValue(undefined)
    };

    mockWeatherServer = {
      processMessage: vi.fn().mockResolvedValue({ result: 'success' })
    };

    mockConfig = {
      security: {
        allowedOrigins: ['http://localhost:3000', 'http://localhost:8080']
      }
    };

    mockTransportConfig = {
      http: {
        port: 8080
      }
    };

    mockHttpServer = {
      listen: vi.fn().mockImplementation((port, callback) => {
        callback();
        return mockHttpServer;
      }),
      close: vi.fn().mockImplementation((callback) => {
        callback();
      }),
      on: vi.fn()
    };

    // Setup mock implementations
    (WeatherMCPServer as any).mockImplementation(() => mockWeatherServer);
    (getConfig as Mock).mockReturnValue(mockConfig);
    (getTransportConfig as Mock).mockReturnValue(mockTransportConfig);
    (createServer as Mock).mockImplementation((handler) => {
      mockHttpServer.requestHandler = handler;
      return mockHttpServer;
    });
    (uuidv4 as Mock).mockReturnValue('test-uuid');

    // Create transport instance
    transport = new StreamableHTTPTransport(mockServer, mockWeatherServer);
  });

  describe('Constructor', () => {
    it('should create HTTP server and start listening', () => {
      expect(createServer).toHaveBeenCalled();
      expect(mockHttpServer.listen).toHaveBeenCalledWith(8080, expect.any(Function));
      expect(logger.logTransportEvent).toHaveBeenCalledWith('HTTP server started', { port: 8080 });
    });

    it('should setup error handler for HTTP server', () => {
      expect(mockHttpServer.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should setup graceful shutdown handlers', () => {
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
  });

  describe('Request Handling', () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
      mockReq = { ...mockIncomingMessage };
      mockRes = { ...mockServerResponse };
    });

    it('should handle GET requests', async () => {
      mockReq.method = 'GET';
      mockReq.url = '/';
      mockReq.headers.accept = 'text/event-stream';

      await transport['handleRequest'](mockReq as unknown as IncomingMessage, mockRes as unknown as ServerResponse);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream'
      }));
    });

    it('should handle POST requests', async () => {
      mockReq.method = 'POST';
      mockReq.headers = {
        'mcp-session-id': 'test-session',
        'mcp-protocol-version': '2025-06-18'
      };

      let dataHandler: Function = () => {};
      let endHandler: Function = () => {};

      mockReq.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'data') dataHandler = handler;
        if (event === 'end') endHandler = handler;
      });

      // Start request handling
      const handlePromise = transport['handleRequest'](mockReq as IncomingMessage, mockRes as ServerResponse);

      // Simulate receiving data
      dataHandler(JSON.stringify({
        jsonrpc: '2.0',
        method: 'test',
        id: 1
      }));

      // Simulate end of data
      endHandler();

      await handlePromise;

      expect(mockWeatherServer.processMessage).toHaveBeenCalled();
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'application/json'
      }));
    });

    it('should handle DELETE requests', async () => {
      mockReq.method = 'DELETE';
      mockReq.headers = {
        'mcp-session-id': 'test-session'
      };

      await transport['handleRequest'](mockReq as IncomingMessage, mockRes as ServerResponse);

      expect(mockRes.writeHead).toHaveBeenCalledWith(204, expect.objectContaining({
        'Mcp-Session-Id': 'test-session'
      }));
    });

    it('should handle health check requests', async () => {
      mockReq.method = 'GET';
      mockReq.url = '/health';

      await transport['handleRequest'](mockReq as IncomingMessage, mockRes as ServerResponse);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'application/json'
      }));
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('healthy'));
    });

    it('should reject unsupported methods', async () => {
      mockReq.method = 'PUT';

      await transport['handleRequest'](mockReq as IncomingMessage, mockRes as ServerResponse);

      expect(mockRes.writeHead).toHaveBeenCalledWith(405, 'Method Not Allowed');
    });
  });

  describe('Origin Validation', () => {
    it('should allow valid origins', () => {
      const mockReq = {
        headers: { origin: 'http://localhost:3000' }
      };

      const result = transport['isOriginAllowed'](mockReq as IncomingMessage);

      expect(result).toBe(true);
    });

    it('should reject invalid origins', () => {
      const mockReq = {
        headers: { origin: 'https://malicious.com' }
      };

      const result = transport['isOriginAllowed'](mockReq as IncomingMessage);

      expect(result).toBe(false);
    });

    it('should allow empty origin', () => {
      const mockReq = {
        headers: { origin: '' }
      };

      const result = transport['isOriginAllowed'](mockReq as IncomingMessage);

      expect(result).toBe(true);
    });
  });

  describe('Protocol Version Validation', () => {
    it('should accept valid protocol version', async () => {
      const mockReq = {
        ...mockIncomingMessage,
        method: 'GET',
        headers: {
          'mcp-protocol-version': '2025-06-18',
          accept: 'text/event-stream'
        }
      };
      const mockRes = { ...mockServerResponse };

      await transport['handleRequest'](mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it('should reject invalid protocol version', async () => {
      const mockReq = {
        ...mockIncomingMessage,
        method: 'GET',
        headers: {
          'mcp-protocol-version': '2024-01-01',
          accept: 'text/event-stream'
        }
      };
      const mockRes = { ...mockServerResponse };

      await transport['handleRequest'](mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Unsupported protocol version'));
    });
  });

  describe('SSE Stream Handling', () => {
    it('should setup SSE stream correctly', async () => {
      const mockReq = {
        ...mockIncomingMessage,
        method: 'GET',
        headers: {
          'mcp-session-id': 'test-session',
          accept: 'text/event-stream'
        }
      };
      const mockRes = { ...mockServerResponse };

      let closeHandler: Function = () => {};
      let errorHandler: Function = () => {};

      mockReq.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'close') closeHandler = handler;
        if (event === 'error') errorHandler = handler;
      });

      await transport['handleRequest'](mockReq as IncomingMessage, mockRes as ServerResponse);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }));

      expect(logger.logTransportEvent).toHaveBeenCalledWith('SSE stream opened', { sessionId: 'test-session' });
    });

    it('should handle client disconnect', async () => {
      const mockReq = {
        ...mockIncomingMessage,
        method: 'GET',
        headers: {
          'mcp-session-id': 'test-session',
          accept: 'text/event-stream'
        }
      };
      const mockRes = { ...mockServerResponse };

      let closeHandler: Function = () => {};

      mockReq.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'close') closeHandler = handler;
      });

      await transport['handleRequest'](mockReq as IncomingMessage, mockRes as ServerResponse);

      // Simulate client disconnect
      closeHandler();

      expect(logger.logTransportEvent).toHaveBeenCalledWith('SSE stream closed', { sessionId: 'test-session' });
    });
  });

  describe('Message Processing', () => {
    it('should process valid JSON-RPC messages', async () => {
      const message = {
        jsonrpc: '2.0',
        method: 'test',
        id: 1,
        params: { test: 'data' }
      };

      const result = await transport['processMCPMessage'](message);

      expect(mockWeatherServer.processMessage).toHaveBeenCalledWith(message);
      expect(result).toEqual({ result: 'success' });
    });

    it('should handle message processing errors', async () => {
      mockWeatherServer.processMessage.mockRejectedValue(new Error('Processing failed'));

      const message = {
        jsonrpc: '2.0',
        method: 'test',
        id: 1
      };

      const result = await transport['processMCPMessage'](message);

      expect(result).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32603,
          message: 'Internal error',
          data: { details: 'Processing failed' }
        }
      });
    });
  });

  describe('Send Method', () => {
    it('should send message to connected client', async () => {
      // First establish a connection
      const mockReq = {
        ...mockIncomingMessage,
        method: 'GET',
        headers: {
          'mcp-session-id': 'test-session',
          accept: 'text/event-stream'
        }
      };
      const mockRes = { ...mockServerResponse };

      await transport['handleRequest'](mockReq, mockRes);

      // Now send a message
      await transport.send({ test: 'data' }, { sessionId: 'test-session' });

      expect(mockRes.write).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ sessionId: 'test-session', message: { test: 'data' } }, 'Sent SSE message');
    });

    it('should queue message for disconnected client', async () => {
      await transport.send({ test: 'data' }, { sessionId: 'disconnected-session' });

      expect(logger.warn).toHaveBeenCalledWith({ sessionId: 'disconnected-session' }, 'No client found for session');
    });
  });

  describe('Receive Method', () => {
    it('should return async generator', async () => {
      const generator = transport.receive();

      expect(generator).toBeDefined();
      expect(typeof generator[Symbol.asyncIterator]).toBe('function');
    });
  });

  describe('Close Method', () => {
    it('should close all client connections', async () => {
      // Add a mock client
      transport['clients'].set('test-session', {
        res: mockServerResponse,
        sessionId: 'test-session',
        connectedAt: Date.now()
      });

      await transport.close();

      expect(mockServerResponse.end).toHaveBeenCalled();
      expect(logger.logTransportEvent).toHaveBeenCalledWith('HTTP server closed');
    });
  });

  describe('Start Method', () => {
    it('should be callable', async () => {
      await expect(transport.start()).resolves.not.toThrow();
      expect(logger.debug).toHaveBeenCalledWith('Transport start method called');
    });
  });

  describe('Statistics', () => {
    it('should return server statistics', () => {
      // Add some mock clients and queues
      transport['clients'].set('session1', {
        res: mockServerResponse,
        sessionId: 'session1',
        connectedAt: Date.now()
      });
      transport['messageQueues'].set('session2', [{}, {}]);

      const stats = transport.getStats();

      expect(stats).toEqual({
        activeClients: 1,
        queuedMessages: 2,
        port: 8080
      });
    });
  });

  describe('Error Responses', () => {
    it('should send error responses correctly', () => {
      const mockRes = { ...mockServerResponse };

      transport['sendErrorResponse'](mockRes, 404, 'Not Found', { details: 'test' });

      expect(mockRes.writeHead).toHaveBeenCalledWith(404, expect.objectContaining({
        'Content-Type': 'application/json'
      }));
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({
        error: 'Not Found',
        details: 'test'
      }));
    });

    it('should send JSON-RPC error responses', () => {
      const mockRes = { ...mockServerResponse };

      transport['sendJSONRPCError'](mockRes, -32600, 'Invalid Request', 'test-session', { details: 'test' });

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, expect.objectContaining({
        'Content-Type': 'application/json',
        'Mcp-Session-Id': 'test-session'
      }));
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: { details: 'test' }
        }
      }));
    });
  });

  describe('SSE Response Formatting', () => {
    it('should format SSE responses correctly', () => {
      const mockRes = { ...mockServerResponse };

      transport['sendSSEResponse'](mockRes, 'message', { test: 'data' }, 'event-id');

      expect(mockRes.write).toHaveBeenCalledWith('id: event-id\n');
      expect(mockRes.write).toHaveBeenCalledWith('event: message\n');
      expect(mockRes.write).toHaveBeenCalledWith('data: {"test":"data"}\n\n');
    });

    it('should handle SSE write errors gracefully', () => {
      const mockRes = {
        ...mockServerResponse,
        write: vi.fn().mockImplementation(() => {
          throw new Error('Write failed');
        })
      };

      transport['sendSSEResponse'](mockRes, 'message', { test: 'data' }, 'event-id');

      expect(logger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        { event: 'message', eventId: 'event-id', operation: 'sendSSEResponse' }
      );
    });
  });

  describe('CORS Headers', () => {
    it('should set correct CORS headers', () => {
      const allowedOrigins = transport['getAllowedOrigins']();

      expect(allowedOrigins).toBe('http://localhost:3000, http://localhost:8080');
    });
  });
});
