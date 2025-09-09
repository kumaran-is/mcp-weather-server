import { StreamableHTTPTransport } from './http-transport';
import { WeatherMCPServer } from '../mcp-server';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'node:crypto';

// Mock dependencies
vi.mock('http');
vi.mock('../mcp-server');
vi.mock('../config/config', () => ({
  getConfig: () => ({
    transport: { http: { port: 8080 } },
    security: { allowedOrigins: ['http://localhost:3000'] }
  }),
  getTransportConfig: () => ({
    http: { port: 8080 }
  })
}));
vi.mock('../logger', () => ({
  logger: {
    logTransportEvent: vi.fn(),
    logError: vi.fn(),
    logSecurityEvent: vi.fn(),
    logMCPRequest: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}));

describe('StreamableHTTPTransport', () => {
  let transport: StreamableHTTPTransport;
  let mockServer: any;
  let mockWeatherServer: any;
  let mockHttpServer: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock WeatherMCPServer
    mockWeatherServer = {
      processMessage: vi.fn()
    };

    // Mock MCP Server
    mockServer = {};

    // Mock HTTP server
    mockHttpServer = {
      listen: vi.fn(),
      close: vi.fn(),
      on: vi.fn()
    };

    (createServer as any).mockReturnValue(mockHttpServer);

    transport = new StreamableHTTPTransport(mockServer, mockWeatherServer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create transport instance', () => {
      expect(transport).toBeDefined();
      expect(createServer).toHaveBeenCalled();
    });

    it('should start HTTP server on specified port', () => {
      expect(mockHttpServer.listen).toHaveBeenCalledWith(8080, expect.any(Function));
    });

    it('should set up error handling', () => {
      expect(mockHttpServer.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Request Handling', () => {
    let mockReq: Partial<IncomingMessage>;
    let mockRes: Partial<ServerResponse>;

    beforeEach(() => {
      mockReq = {
        method: 'POST',
        url: '/mcp',
        headers: {
          'mcp-protocol-version': '2025-06-18',
          'content-type': 'application/json',
          origin: 'http://localhost:3000'
        },
        on: vi.fn(),
        setEncoding: vi.fn()
      };

      mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
        setHeader: vi.fn()
      };
    });

    describe('Origin Validation', () => {
      it('should accept allowed origin', () => {
        const isAllowed = (transport as any).isOriginAllowed(mockReq);
        expect(isAllowed).toBe(true);
      });

      it('should reject disallowed origin', () => {
        mockReq.headers = { ...mockReq.headers, origin: 'http://malicious.com' };
        const isAllowed = (transport as any).isOriginAllowed(mockReq);
        expect(isAllowed).toBe(false);
      });

      it('should accept requests without origin', () => {
        mockReq.headers = { ...mockReq.headers, origin: undefined };
        const isAllowed = (transport as any).isOriginAllowed(mockReq);
        expect(isAllowed).toBe(true);
      });
    });

    describe('Protocol Version Validation', () => {
      it('should accept supported protocol version', () => {
        const isValid = (transport as any).isProtocolVersionValid('2025-06-18');
        expect(isValid).toBe(true);
      });

      it('should accept legacy protocol version', () => {
        const isValid = (transport as any).isProtocolVersionValid('2025-03-26');
        expect(isValid).toBe(true);
      });

      it('should reject unsupported protocol version', () => {
        const isValid = (transport as any).isProtocolVersionValid('2024-01-01');
        expect(isValid).toBe(false);
      });
    });

    describe('POST Requests', () => {
      beforeEach(() => {
        mockReq.method = 'POST';
        (mockReq.on as any).mockImplementation((event: string, callback: Function) => {
          if (event === 'data') {
            callback(JSON.stringify({
              jsonrpc: '2.0',
              id: '123',
              method: 'initialize',
              params: {
                protocolVersion: '2025-06-18',
                capabilities: {},
                clientInfo: { name: 'test', version: '1.0.0' }
              }
            }));
          } else if (event === 'end') {
            callback();
          }
        });
      });

      it('should handle initialize request', async () => {
        mockWeatherServer.processMessage.mockResolvedValue({
          jsonrpc: '2.0',
          id: '123',
          result: {
            protocolVersion: '2025-06-18',
            capabilities: { tools: {} },
            serverInfo: { name: 'weather-mcp-server', version: '1.0.0' }
          }
        });

        await (transport as any).handlePOST(mockReq as IncomingMessage, mockRes as ServerResponse, 'session-123', '2025-06-18');

        expect(mockWeatherServer.processMessage).toHaveBeenCalledWith({
          jsonrpc: '2.0',
          id: '123',
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0.0' }
          }
        });

        expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
          'Content-Type': 'application/json',
          'Mcp-Session-Id': 'session-123'
        }));
      });

      it('should handle tool call request', async () => {
        const toolRequest = {
          jsonrpc: '2.0',
          id: '456',
          method: 'tools/call',
          params: {
            name: 'get_current_weather',
            arguments: { city: 'London' }
          }
        };

        (mockReq.on as any).mockImplementation((event: string, callback: Function) => {
          if (event === 'data') {
            callback(JSON.stringify(toolRequest));
          } else if (event === 'end') {
            callback();
          }
        });

        mockWeatherServer.processMessage.mockResolvedValue({
          content: [{
            type: 'text',
            text: 'Weather in London: 15°C'
          }]
        });

        await (transport as any).handlePOST(mockReq as IncomingMessage, mockRes as ServerResponse, 'session-456', '2025-06-18');

        expect(mockWeatherServer.processMessage).toHaveBeenCalledWith(toolRequest);
        expect(mockRes.end).toHaveBeenCalled();
      });

      it('should handle notification (no response expected)', async () => {
        const notification = {
          jsonrpc: '2.0',
          method: 'notifications/initialized'
        };

        (mockReq.on as any).mockImplementation((event: string, callback: Function) => {
          if (event === 'data') {
            callback(JSON.stringify(notification));
          } else if (event === 'end') {
            callback();
          }
        });

        await (transport as any).handlePOST(mockReq as IncomingMessage, mockRes as ServerResponse, 'session-789', '2025-06-18');

        expect(mockWeatherServer.processMessage).toHaveBeenCalledWith(notification);
        expect(mockRes.writeHead).toHaveBeenCalledWith(202, expect.any(Object));
        expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ status: 'accepted' }));
      });

      it('should handle invalid JSON', async () => {
        (mockReq.on as any).mockImplementation((event: string, callback: Function) => {
          if (event === 'data') {
            callback('invalid json');
          } else if (event === 'end') {
            callback();
          }
        });

        await (transport as any).handlePOST(mockReq as IncomingMessage, mockRes as ServerResponse, 'session-999', '2025-06-18');

        expect(mockRes.writeHead).toHaveBeenCalledWith(400, expect.objectContaining({
          'Content-Type': 'application/json'
        }));
      });

      it('should reject invalid origin', async () => {
        mockReq.headers = { ...mockReq.headers, origin: 'http://malicious.com' };

        await (transport as any).handlePOST(mockReq as IncomingMessage, mockRes as ServerResponse, 'session-123', '2025-06-18');

        expect(mockRes.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
        expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({
          error: 'Invalid Origin'
        }));
      });
    });

    describe('GET Requests (SSE)', () => {
      beforeEach(() => {
        mockReq.method = 'GET';
        mockReq.headers = {
          ...mockReq.headers,
          accept: 'text/event-stream'
        };
      });

      it('should establish SSE connection', async () => {
        await (transport as any).handleGET(mockReq as IncomingMessage, mockRes as ServerResponse, 'session-123');

        expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Mcp-Session-Id': 'session-123'
        }));
      });

      it('should reject non-SSE accept header', async () => {
        mockReq.headers = { ...mockReq.headers, accept: 'application/json' };

        await (transport as any).handleGET(mockReq as IncomingMessage, mockRes as ServerResponse, 'session-123');

        expect(mockRes.writeHead).toHaveBeenCalledWith(406, expect.any(Object));
        expect(mockRes.end).toHaveBeenCalledWith('Accept: text/event-stream or */* required');
      });

      it('should handle client disconnect', async () => {
        const mockOn = vi.fn();
        mockReq.on = mockOn;

        await (transport as any).handleGET(mockReq as IncomingMessage, mockRes as ServerResponse, 'session-123');

        expect(mockOn).toHaveBeenCalledWith('close', expect.any(Function));
        expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
      });
    });

    describe('DELETE Requests', () => {
      beforeEach(() => {
        mockReq.method = 'DELETE';
      });

      it('should terminate session', async () => {
        await (transport as any).handleDELETE(mockReq as IncomingMessage, mockRes as ServerResponse, 'session-123');

        expect(mockRes.writeHead).toHaveBeenCalledWith(204, expect.objectContaining({
          'Mcp-Session-Id': 'session-123'
        }));
        expect(mockRes.end).toHaveBeenCalled();
      });
    });

    describe('Health Check', () => {
      beforeEach(() => {
        mockReq.method = 'GET';
        mockReq.url = '/health';
      });

      it('should return health status', async () => {
        await (transport as any).handleHealth(mockReq as IncomingMessage, mockRes as ServerResponse);

        expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
          'Content-Type': 'application/json'
        }));

        expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('"status":"healthy"'));
      });
    });
  });

  describe('SSE Message Handling', () => {
    it('should send message to connected client', async () => {
      const mockClient = {
        res: { write: vi.fn() },
        sessionId: 'session-123'
      };

      (transport as any).clients.set('session-123', mockClient);

      await transport.send({ test: 'message' }, { sessionId: 'session-123' });

      expect(mockClient.res.write).toHaveBeenCalled();
    });

    it('should queue message for disconnected client', async () => {
      await transport.send({ test: 'message' }, { sessionId: 'disconnected-session' });

      const queue = (transport as any).messageQueues.get('disconnected-session');
      expect(queue).toContainEqual({ test: 'message' });
    });

    it('should handle SSE response formatting', () => {
      const mockRes = { write: vi.fn() };

      (transport as any).sendSSEResponse(mockRes, 'test', { data: 'value' }, 'event-123');

      expect(mockRes.write).toHaveBeenCalledWith('id: event-123\n');
      expect(mockRes.write).toHaveBeenCalledWith('event: test\n');
      expect(mockRes.write).toHaveBeenCalledWith('data: {"data":"value"}\n\n');
    });
  });

  describe('Error Responses', () => {
    it('should send error response', () => {
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      (transport as any).sendErrorResponse(mockRes as any, 400, 'Bad Request');

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, expect.objectContaining({
        'Content-Type': 'application/json'
      }));
      expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({
        error: 'Bad Request'
      }));
    });

    it('should send JSON-RPC error response', () => {
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn()
      };

      (transport as any).sendJSONRPCError(mockRes as any, -32600, 'Invalid Request', 'session-123');

      expect(mockRes.writeHead).toHaveBeenCalledWith(400, expect.objectContaining({
        'Content-Type': 'application/json',
        'Mcp-Session-Id': 'session-123'
      }));

      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('"code":-32600'));
    });
  });

  describe('Lifecycle Management', () => {
    it('should close transport gracefully', async () => {
      const mockClient = {
        res: { end: vi.fn() },
        sessionId: 'session-123'
      };

      (transport as any).clients.set('session-123', mockClient);

      const closePromise = transport.close();

      await expect(closePromise).resolves.not.toThrow();
      expect(mockHttpServer.close).toHaveBeenCalled();
    });

    it('should get transport statistics', () => {
      const stats = (transport as any).getStats();

      expect(stats).toEqual({
        activeClients: 0,
        queuedMessages: 0,
        port: 8080
      });
    });
  });

  describe('Session Management', () => {
    it('should generate unique session IDs', () => {
      const sessionId1 = randomUUID();
      const sessionId2 = randomUUID();

      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should handle session initialization', () => {
      const mockOnSessionInitialized = vi.fn();
      const mockTransport = {
        sessionId: null,
        onclose: null
      };

      // Simulate session initialization
      mockOnSessionInitialized('new-session-123');
      expect(mockOnSessionInitialized).toHaveBeenCalledWith('new-session-123');
    });
  });

  describe('CORS Handling', () => {
    it('should get allowed origins', () => {
      const origins = (transport as any).getAllowedOrigins();
      expect(origins).toBe('http://localhost:3000');
    });

    it('should validate allowed origins', () => {
      const mockReq = { headers: { origin: 'http://localhost:3000' } };
      const isAllowed = (transport as any).isOriginAllowed(mockReq);
      expect(isAllowed).toBe(true);
    });

    it('should reject disallowed origins', () => {
      const mockReq = { headers: { origin: 'http://malicious.com' } };
      const isAllowed = (transport as any).isOriginAllowed(mockReq);
      expect(isAllowed).toBe(false);
    });

    it('should allow requests without origin', () => {
      const mockReq = { headers: {} };
      const isAllowed = (transport as any).isOriginAllowed(mockReq);
      expect(isAllowed).toBe(true);
    });
  });

  describe('MCP Message Processing', () => {
    it('should process MCP message through weather server', async () => {
      const message = {
        jsonrpc: '2.0',
        id: '123',
        method: 'tools/list'
      };

      const expectedResponse = {
        jsonrpc: '2.0',
        id: '123',
        result: { tools: [] }
      };

      mockWeatherServer.processMessage.mockResolvedValue(expectedResponse);

      const result = await (transport as any).processMCPMessage(message);

      expect(mockWeatherServer.processMessage).toHaveBeenCalledWith(message);
      expect(result).toEqual(expectedResponse);
    });

    it('should handle MCP processing errors', async () => {
      const message = {
        jsonrpc: '2.0',
        id: '123',
        method: 'invalid/method'
      };

      mockWeatherServer.processMessage.mockRejectedValue(new Error('Method not found'));

      const result = await (transport as any).processMCPMessage(message);

      expect(result).toEqual({
        jsonrpc: '2.0',
        id: '123',
        error: {
          code: -32603,
          message: 'Internal error',
          data: { details: 'Method not found' }
        }
      });
    });
  });
});
