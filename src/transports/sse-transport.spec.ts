import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimpleSSETransport } from './sse-transport.js';
import http from 'http';
import { EventEmitter } from 'events';

// Mock modules
vi.mock('http');
vi.mock('../logger-pino.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }
}));

vi.mock('../config/config.js', () => ({
  getConfig: vi.fn(() => ({
    server: {
      ssePort: 8081
    }
  }))
}));

describe('SimpleSSETransport', () => {
  let transport: SimpleSSETransport;
  let mockServer: any;
  let mockWeatherServer: any;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create mock server
    mockServer = new EventEmitter() as any;
    mockServer.listen = vi.fn((port, callback) => {
      if (callback) callback();
    });
    mockServer.close = vi.fn((callback) => {
      if (callback) callback();
    });
    mockServer.listening = false;

    // Mock http.createServer
    (http.createServer as any).mockReturnValue(mockServer);

    // Create mock weather server
    mockWeatherServer = {
      processMessage: vi.fn().mockResolvedValue({
        jsonrpc: '2.0',
        result: { status: 'success' },
        id: 1
      })
    };

    // Create mock request and response
    mockRequest = new EventEmitter() as any;
    mockRequest.method = 'GET';
    mockRequest.url = '/sse';
    mockRequest.headers = {};

    mockResponse = {
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
      on: vi.fn()
    };

    transport = new SimpleSSETransport(mockWeatherServer);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create transport instance', () => {
      expect(transport).toBeDefined();
      expect(transport).toBeInstanceOf(SimpleSSETransport);
    });

    it('should set default port from config', () => {
      expect(transport['port']).toBe(8081);
    });

    it('should handle missing ssePort in config', () => {
      const { getConfig } = require('../config/config.js');
      getConfig.mockReturnValueOnce({ server: {} });
      
      const customTransport = new SimpleSSETransport(mockWeatherServer);
      expect(customTransport['port']).toBe(8081);
    });
  });

  describe('start method', () => {
    it('should start the server successfully', async () => {
      await transport.start();

      expect(http.createServer).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalledWith(8081, expect.any(Function));
    });

    it('should handle server errors during startup', async () => {
      const error = new Error('Port in use');
      mockServer.listen = vi.fn((port, callback) => {
        mockServer.emit('error', error);
      });

      await expect(transport.start()).rejects.toThrow('Port in use');
    });

    it('should log server start', async () => {
      const { logger } = require('../logger-pino.js');
      await transport.start();
      
      expect(logger.info).toHaveBeenCalledWith(
        'Simple SSE transport started on port 8081'
      );
    });
  });

  describe('Request handling', () => {
    let handler: any;

    beforeEach(async () => {
      await transport.start();
      handler = (http.createServer as any).mock.calls[0][0];
    });

    describe('CORS headers', () => {
      it('should set CORS headers for all requests', () => {
        mockRequest.url = '/sse';
        handler(mockRequest, mockResponse);

        expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Last-Event-Id');
      });

      it('should handle OPTIONS preflight requests', () => {
        mockRequest.method = 'OPTIONS';
        mockRequest.url = '/sse';
        handler(mockRequest, mockResponse);

        expect(mockResponse.writeHead).toHaveBeenCalledWith(204);
        expect(mockResponse.end).toHaveBeenCalled();
      });
    });

    describe('Health endpoint', () => {
      it('should handle health check request', () => {
        mockRequest.url = '/health';
        handler(mockRequest, mockResponse);

        expect(mockResponse.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
        expect(mockResponse.end).toHaveBeenCalledWith(JSON.stringify({
          status: 'healthy',
          transport: 'sse',
          port: 8081,
          clients: 0,
        }));
      });
    });

    describe('SSE endpoint', () => {
      it('should handle SSE connection for /sse path', () => {
        mockRequest.url = '/sse';
        mockRequest.method = 'GET';
        handler(mockRequest, mockResponse);

        expect(mockResponse.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }));
      });

      it('should handle SSE connection for root path', () => {
        mockRequest.url = '/';
        mockRequest.method = 'GET';
        handler(mockRequest, mockResponse);

        expect(mockResponse.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
          'Content-Type': 'text/event-stream',
        }));
      });

      it('should send endpoint event to new clients', () => {
        mockRequest.url = '/sse';
        handler(mockRequest, mockResponse);

        expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('event: endpoint'));
        expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('data: http://localhost:8081/messages/'));
      });

      it('should handle Last-Event-Id header', () => {
        mockRequest.url = '/sse';
        mockRequest.headers['last-event-id'] = 'event-123';
        handler(mockRequest, mockResponse);

        const { logger } = require('../logger-pino.js');
        expect(logger.info).toHaveBeenCalledWith(
          'SSE client connected',
          expect.objectContaining({ lastEventId: 'event-123' })
        );
      });

      it('should send X-SSE-Client-Id header', () => {
        mockRequest.url = '/sse';
        handler(mockRequest, mockResponse);

        expect(mockResponse.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
          'X-SSE-Client-Id': expect.stringMatching(/^sse-\d+-[a-z0-9]+$/)
        }));
      });

      it('should reject non-GET methods for SSE endpoint', () => {
        mockRequest.method = 'POST';
        mockRequest.url = '/sse';
        handler(mockRequest, mockResponse);

        expect(mockResponse.writeHead).toHaveBeenCalledWith(405, { 'Content-Type': 'text/plain' });
        expect(mockResponse.end).toHaveBeenCalledWith('Method not allowed');
      });

      it('should set up keepalive interval', () => {
        mockRequest.url = '/sse';
        handler(mockRequest, mockResponse);

        vi.advanceTimersByTime(30000);
        expect(mockResponse.write).toHaveBeenCalledWith(':keepalive\n\n');
      });

      it('should handle client disconnect', () => {
        mockRequest.url = '/sse';
        handler(mockRequest, mockResponse);

        expect(transport['clients'].size).toBe(1);
        
        mockRequest.emit('close');
        
        expect(transport['clients'].size).toBe(0);
        
        const { logger } = require('../logger-pino.js');
        expect(logger.info).toHaveBeenCalledWith(
          'SSE client disconnected',
          expect.any(Object)
        );
      });

      it('should handle connection errors', () => {
        mockRequest.url = '/sse';
        handler(mockRequest, mockResponse);

        const error = new Error('Connection reset');
        mockRequest.emit('error', error);
        
        expect(transport['clients'].size).toBe(0);
        
        const { logger } = require('../logger-pino.js');
        expect(logger.error).toHaveBeenCalledWith(
          'SSE connection error',
          expect.objectContaining({ error: 'Connection reset' })
        );
      });

      it('should clear keepalive on disconnect', () => {
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
        
        mockRequest.url = '/sse';
        handler(mockRequest, mockResponse);

        mockRequest.emit('close');
        
        expect(clearIntervalSpy).toHaveBeenCalled();
      });
    });

    describe('Messages endpoint', () => {
      let handler: any;
      
      beforeEach(async () => {
        await transport.start();
        handler = (http.createServer as any).mock.calls[0][0];
      });
      
      it('should handle POST to messages endpoint', async () => {
        // First establish SSE connection
        mockRequest.url = '/sse';
        handler(mockRequest, mockResponse);
        
        // Get client ID from the endpoint event
        const writeCall = mockResponse.write.mock.calls.find((call: any) => 
          call[0].includes('event: endpoint')
        );
        const dataCall = mockResponse.write.mock.calls.find((call: any) => 
          call[0].includes('data: http://localhost:8081/messages/')
        );
        const clientId = dataCall[0].match(/messages\/([^\\n]+)/)[1];
        
        // Now test POST to messages endpoint
        const messageReq = new EventEmitter() as any;
        messageReq.method = 'POST';
        messageReq.url = `/messages/${clientId}`;
        messageReq.headers = {};
        
        const messageRes = {
          writeHead: vi.fn(),
          end: vi.fn(),
          setHeader: vi.fn()
        };
        
        const messageData = JSON.stringify({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {},
          id: 1
        });
        
        handler(messageReq, messageRes);
        
        messageReq.emit('data', Buffer.from(messageData));
        messageReq.emit('end');
        
        await vi.runAllTimersAsync();
        
        expect(mockWeatherServer.processMessage).toHaveBeenCalledWith({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {},
          id: 1
        });
        
        expect(messageRes.writeHead).toHaveBeenCalledWith(202, { 'Content-Type': 'application/json' });
        expect(messageRes.end).toHaveBeenCalledWith('{}');
      });

      it('should handle invalid client ID', async () => {
        const messageReq = new EventEmitter() as any;
        messageReq.method = 'POST';
        messageReq.url = '/messages/invalid-client';
        messageReq.headers = {};
        
        const messageRes = {
          writeHead: vi.fn(),
          end: vi.fn(),
          setHeader: vi.fn()
        };
        
        handler(messageReq, messageRes);
        
        messageReq.emit('data', Buffer.from('{"test": "data"}'));
        messageReq.emit('end');
        
        await vi.runAllTimersAsync();
        
        expect(messageRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
        expect(messageRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Client not found' }));
      });

      it('should handle invalid JSON in message', async () => {
        // First establish SSE connection
        mockRequest.url = '/sse';
        handler(mockRequest, mockResponse);
        
        const dataCall = mockResponse.write.mock.calls.find((call: any) => 
          call[0].includes('data: http://localhost:8081/messages/')
        );
        const clientId = dataCall[0].match(/messages\/([^\\n]+)/)[1];
        
        const messageReq = new EventEmitter() as any;
        messageReq.method = 'POST';
        messageReq.url = `/messages/${clientId}`;
        
        const messageRes = {
          writeHead: vi.fn(),
          end: vi.fn(),
          setHeader: vi.fn()
        };
        
        handler(messageReq, messageRes);
        
        messageReq.emit('data', Buffer.from('invalid json'));
        messageReq.emit('end');
        
        await vi.runAllTimersAsync();
        
        expect(messageRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
        expect(messageRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Internal server error' }));
      });

      it('should reject non-POST methods for messages endpoint', () => {
        mockRequest.method = 'GET';
        mockRequest.url = '/messages/client-123';
        handler(mockRequest, mockResponse);

        expect(mockResponse.writeHead).toHaveBeenCalledWith(405, { 'Content-Type': 'text/plain' });
        expect(mockResponse.end).toHaveBeenCalledWith('Method not allowed');
      });

      it('should send SSE response for processed message', async () => {
        // Establish SSE connection
        mockRequest.url = '/sse';
        handler(mockRequest, mockResponse);
        
        const dataCall = mockResponse.write.mock.calls.find((call: any) => 
          call[0].includes('data: http://localhost:8081/messages/')
        );
        const clientId = dataCall[0].match(/messages\/([^\\n]+)/)[1];
        
        // Clear previous calls
        mockResponse.write.mockClear();
        
        const messageReq = new EventEmitter() as any;
        messageReq.method = 'POST';
        messageReq.url = `/messages/${clientId}`;
        
        const messageRes = {
          writeHead: vi.fn(),
          end: vi.fn(),
          setHeader: vi.fn()
        };
        
        const messageData = JSON.stringify({
          jsonrpc: '2.0',
          method: 'test',
          id: 123
        });
        
        handler(messageReq, messageRes);
        
        messageReq.emit('data', Buffer.from(messageData));
        messageReq.emit('end');
        
        await vi.runAllTimersAsync();
        
        expect(mockResponse.write).toHaveBeenCalledWith('id: 123\n');
        expect(mockResponse.write).toHaveBeenCalledWith('event: message\n');
        expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('data: '));
      });

      it('should handle processMCPMessage errors', async () => {
        mockWeatherServer.processMessage.mockRejectedValueOnce(new Error('Processing failed'));
        
        // Establish SSE connection
        mockRequest.url = '/sse';
        handler(mockRequest, mockResponse);
        
        const dataCall = mockResponse.write.mock.calls.find((call: any) => 
          call[0].includes('data: http://localhost:8081/messages/')
        );
        const clientId = dataCall[0].match(/messages\/([^\\n]+)/)[1];
        
        const messageReq = new EventEmitter() as any;
        messageReq.method = 'POST';
        messageReq.url = `/messages/${clientId}`;
        
        const messageRes = {
          writeHead: vi.fn(),
          end: vi.fn(),
          setHeader: vi.fn()
        };
        
        handler(messageReq, messageRes);
        
        messageReq.emit('data', Buffer.from('{"method": "test", "id": 1}'));
        messageReq.emit('end');
        
        await vi.runAllTimersAsync();
        
        expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"error"'));
        expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"code":-32603'));
      });
    });

    describe('404 handling', () => {
      it('should return 404 for unknown paths', () => {
        mockRequest.url = '/unknown';
        handler(mockRequest, mockResponse);

        expect(mockResponse.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/plain' });
        expect(mockResponse.end).toHaveBeenCalledWith('Not found');
      });
    });
  });

  describe('broadcast method', () => {
    it('should broadcast to all connected clients', async () => {
      await transport.start();
      const handler = (http.createServer as any).mock.calls[0][0];
      
      // Connect two clients
      const client1Req = new EventEmitter() as any;
      client1Req.url = '/sse';
      client1Req.method = 'GET';
      client1Req.headers = {};
      const client1Res = {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        setHeader: vi.fn()
      };
      
      const client2Req = new EventEmitter() as any;
      client2Req.url = '/sse';
      client2Req.method = 'GET';
      client2Req.headers = {};
      const client2Res = {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        setHeader: vi.fn()
      };
      
      handler(client1Req, client1Res);
      handler(client2Req, client2Res);
      
      // Clear previous writes
      client1Res.write.mockClear();
      client2Res.write.mockClear();
      
      // Broadcast message
      transport.broadcast('test-event', { message: 'broadcast data' });
      
      // Check both clients received the event
      expect(client1Res.write).toHaveBeenCalledWith('event: test-event\n');
      expect(client1Res.write).toHaveBeenCalledWith(expect.stringContaining('"message":"broadcast data"'));
      
      expect(client2Res.write).toHaveBeenCalledWith('event: test-event\n');
      expect(client2Res.write).toHaveBeenCalledWith(expect.stringContaining('"message":"broadcast data"'));
    });
  });

  describe('close method', () => {
    it('should close all client connections', async () => {
      await transport.start();
      const handler = (http.createServer as any).mock.calls[0][0];
      
      // Connect a client
      mockRequest.url = '/sse';
      handler(mockRequest, mockResponse);
      
      expect(transport['clients'].size).toBe(1);
      
      await transport.close();
      
      expect(mockResponse.write).toHaveBeenCalledWith('event: shutdown\n');
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('"message":"Server shutting down"'));
      expect(mockResponse.end).toHaveBeenCalled();
      expect(transport['clients'].size).toBe(0);
    });

    it('should close HTTP server', async () => {
      await transport.start();
      await transport.close();
      
      expect(mockServer.close).toHaveBeenCalled();
      
      const { logger } = require('../logger-pino.js');
      expect(logger.info).toHaveBeenCalledWith('SSE server closed');
    });

    it('should handle errors when closing clients', async () => {
      await transport.start();
      const handler = (http.createServer as any).mock.calls[0][0];
      
      // Connect a client with failing response
      mockRequest.url = '/sse';
      const failingResponse = {
        writeHead: vi.fn(),
        write: vi.fn().mockImplementation(() => {
          throw new Error('Write failed');
        }),
        end: vi.fn(),
        setHeader: vi.fn()
      };
      handler(mockRequest, failingResponse);
      
      await transport.close();
      
      const { logger } = require('../logger-pino.js');
      expect(logger.error).toHaveBeenCalledWith(
        'Error closing client',
        expect.objectContaining({ error: 'Write failed' })
      );
    });
  });

  describe('getStats method', () => {
    it('should return server statistics', async () => {
      await transport.start();
      const handler = (http.createServer as any).mock.calls[0][0];
      
      // Connect two clients
      mockRequest.url = '/sse';
      handler(mockRequest, mockResponse);
      handler(mockRequest, mockResponse);
      
      const stats = transport.getStats();
      
      expect(stats).toEqual({
        activeClients: 2,
        port: 8081,
        transport: 'sse'
      });
    });
  });

  describe('Error handling', () => {
    it('should handle sendSSEEvent errors', async () => {
      await transport.start();
      const handler = (http.createServer as any).mock.calls[0][0];
      
      const failingResponse = {
        writeHead: vi.fn(),
        write: vi.fn().mockImplementation(() => {
          throw new Error('Write failed');
        }),
        end: vi.fn(),
        setHeader: vi.fn()
      };
      
      mockRequest.url = '/sse';
      handler(mockRequest, failingResponse);
      
      // Should not throw even if write fails
      expect(() => transport.broadcast('test', {})).not.toThrow();
      
      const { logger } = require('../logger-pino.js');
      expect(logger.error).toHaveBeenCalledWith(
        'Error sending SSE event',
        expect.objectContaining({ error: 'Write failed' })
      );
    });

    it('should handle missing host header', async () => {
      await transport.start();
      const handler = (http.createServer as any).mock.calls[0][0];
      
      mockRequest.url = '/health';
      mockRequest.headers = {};
      delete mockRequest.headers.host;
      
      // Should not throw
      expect(() => handler(mockRequest, mockResponse)).not.toThrow();
      
      expect(mockResponse.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    });
  });

  describe('Client ID generation', () => {
    it('should generate unique client IDs', async () => {
      await transport.start();
      const handler = (http.createServer as any).mock.calls[0][0];
      
      const clientIds = new Set();
      
      for (let i = 0; i < 10; i++) {
        const req = new EventEmitter() as any;
        req.url = '/sse';
        req.method = 'GET';
        req.headers = {};
        
        const res = {
          writeHead: vi.fn((status, headers) => {
            if (headers['X-SSE-Client-Id']) {
              clientIds.add(headers['X-SSE-Client-Id']);
            }
          }),
          write: vi.fn(),
          end: vi.fn(),
          setHeader: vi.fn()
        };
        
        handler(req, res);
      }
      
      // All client IDs should be unique
      expect(clientIds.size).toBe(10);
      
      // Check format
      for (const id of clientIds) {
        expect(id).toMatch(/^sse-\d+-[a-z0-9]+$/);
      }
    });
  });
});