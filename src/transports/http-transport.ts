import { createServer, IncomingMessage, ServerResponse } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { Server } from '@modelcontextprotocol/sdk/server';
import { WeatherMCPServer } from '../mcp-server.js';
import { getConfig, getTransportConfig } from '../config/config.js';
import { logger } from '../logger.js';

/**
 * Streamable HTTP Transport for MCP Server
 * Custom transport implementation for HTTP-based communication
 * Supports Server-Sent Events (SSE) for real-time message delivery
 */
export class StreamableHTTPTransport {
  private server: Server;
  private weatherServer: WeatherMCPServer;
  private httpServer: import('http').Server;
  private clients: Map<string, ClientConnection> = new Map();
  private messageQueues: Map<string, unknown[]> = new Map();
  private config = getConfig();
  private transportConfig = getTransportConfig();

  constructor(mcpServer: Server, weatherServer: WeatherMCPServer) {
    this.server = mcpServer;
    this.weatherServer = weatherServer;
    this.httpServer = createServer(this.handleRequest.bind(this));

    const port = this.transportConfig.http?.port || 8080;
    this.httpServer.listen(port, () => {
      logger.logTransportEvent('HTTP server started', { port });
    });

    // Handle server errors
    this.httpServer.on('error', (error) => {
      logger.logError(error as Error, { operation: 'HTTP server' });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.close());
    process.on('SIGINT', () => this.close());
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const startTime = Date.now();
    const sessionId = req.headers['mcp-session-id'] as string || uuidv4();
    const protocolVersion = req.headers['mcp-protocol-version'] as string || '2025-06-18';
    const lastEventId = req.headers['last-event-id'] as string;

    try {
      // Validate Origin for security
      if (!this.isOriginAllowed(req)) {
        logger.logSecurityEvent('Invalid origin rejected', {
          origin: req.headers.origin,
          sessionId,
        });
        this.sendErrorResponse(res, 403, 'Invalid Origin');
        return;
      }

      // Validate protocol version
      if (protocolVersion !== '2025-06-18') {
        logger.logSecurityEvent('Unsupported protocol version', {
          protocolVersion,
          sessionId,
        });
        this.sendErrorResponse(res, 400, 'Unsupported protocol version', {
          supported: ['2025-06-18'],
          requested: protocolVersion,
        });
        return;
      }

      // Handle different HTTP methods
      switch (req.method) {
      case 'POST':
        await this.handlePOST(req, res, sessionId, protocolVersion);
        break;
      case 'GET':
        await this.handleGET(req, res, sessionId, lastEventId);
        break;
      case 'DELETE':
        await this.handleDELETE(req, res, sessionId);
        break;
      default:
        this.sendErrorResponse(res, 405, 'Method Not Allowed');
      }

      logger.logPerformance('handleRequest', startTime, {
        method: req.method,
        sessionId,
        statusCode: res.statusCode,
      });

    } catch (error) {
      logger.logError(error as Error, {
        method: req.method,
        sessionId,
        operation: 'handleRequest',
      });
      this.sendErrorResponse(res, 500, 'Internal Server Error');
    }
  }

  /**
   * Handle POST requests (send messages to MCP server)
   */
  private async handlePOST(
    req: IncomingMessage,
    res: ServerResponse,
    sessionId: string,
    protocolVersion: string,
  ) {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const message = JSON.parse(body);

        // Validate JSON-RPC format
        if (!message.jsonrpc || message.jsonrpc !== '2.0') {
          throw new Error('Invalid JSON-RPC format');
        }

        logger.logMCPRequest(message.method, message.id, message.params);

        // Handle the message with the MCP server
        if (message.id) {
          // Request with ID - expect response
          const response = await this.processMCPMessage(message);

          // Check if this is a JSON-RPC response (not SSE)
          if (response && typeof response === 'object' && 'jsonrpc' in response) {
            // Send as regular JSON response
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Mcp-Session-Id': sessionId,
              'MCP-Protocol-Version': protocolVersion,
              'Access-Control-Allow-Origin': this.getAllowedOrigins(),
              'Access-Control-Allow-Headers': 'MCP-Protocol-Version, Mcp-Session-Id, Content-Type',
            });
            res.end(JSON.stringify(response));
          } else {
            // Send as SSE for streaming responses
            this.setupSSEForResponse(res, sessionId, protocolVersion);
            this.sendSSEResponse(res, 'response', response, sessionId);
            res.end();
          }
        } else {
          // Notification - no response expected
          await this.processMCPMessage(message);
          res.writeHead(202, {
            'Mcp-Session-Id': sessionId,
            'MCP-Protocol-Version': protocolVersion,
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': this.getAllowedOrigins(),
          });
          res.end(JSON.stringify({ status: 'accepted' }));
        }

      } catch (error) {
        logger.logError(error as Error, { body, sessionId });
        this.sendJSONRPCError(res, -32700, 'Parse error', sessionId);
      }
    });
  }

  /**
   * Handle GET requests (establish SSE stream for receiving messages)
   */
  private async handleGET(
    req: IncomingMessage,
    res: ServerResponse,
    sessionId: string,
    lastEventId?: string,
  ) {
      // Validate Accept header for SSE requests
      if (!req.headers.accept?.includes('text/event-stream') && !req.headers.accept?.includes('*/*')) {
        logger.logSecurityEvent('Invalid Accept header', {
          accept: req.headers.accept,
          sessionId,
        });
        this.sendErrorResponse(res, 406, 'Accept: text/event-stream or */* required');
        return;
      }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Mcp-Session-Id': sessionId,
      'MCP-Protocol-Version': '2025-06-18',
      'Access-Control-Allow-Origin': this.getAllowedOrigins(),
      'Access-Control-Allow-Headers': 'MCP-Protocol-Version, Mcp-Session-Id, Last-Event-Id, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    });

    // Store client connection
    this.clients.set(sessionId, {
      res,
      sessionId,
      lastEventId,
      connectedAt: Date.now(),
    });

    logger.logTransportEvent('SSE stream opened', { sessionId });

    // Send queued messages if resuming
    if (lastEventId) {
      const queued = this.messageQueues.get(sessionId) || [];
      for (const msg of queued) {
        this.sendSSEResponse(res, 'message', msg, sessionId);
      }
    }

    // Handle client disconnect
    req.on('close', () => {
      this.clients.delete(sessionId);
      this.messageQueues.delete(sessionId);
      logger.logTransportEvent('SSE stream closed', { sessionId });
    });

    req.on('error', (error) => {
      logger.logError(error as Error, { sessionId, operation: 'SSE stream' });
      this.clients.delete(sessionId);
      this.messageQueues.delete(sessionId);
    });
  }

  /**
   * Handle DELETE requests (terminate session)
   */
  private async handleDELETE(req: IncomingMessage, res: ServerResponse, sessionId: string) {
    this.clients.delete(sessionId);
    this.messageQueues.delete(sessionId);

    res.writeHead(204, {
      'Mcp-Session-Id': sessionId,
      'MCP-Protocol-Version': '2025-06-18',
    });
    res.end();

    logger.logTransportEvent('Session terminated', { sessionId });
  }

  /**
   * Send message to client via SSE
   */
  async send(message: unknown, options?: { sessionId?: string; [key: string]: unknown }): Promise<void> {
    // Extract sessionId from options or use default
    const sessionId = options?.sessionId || '';
    const client = this.clients.get(sessionId);

    if (!client) {
      logger.warn({ sessionId }, 'No client found for session');

      // Queue message for later delivery
      if (!this.messageQueues.has(sessionId)) {
        this.messageQueues.set(sessionId, []);
      }
      const queue = this.messageQueues.get(sessionId);
      if (queue) {
        queue.push(message);
      }
      return;
    }

    const eventId = uuidv4();
    this.sendSSEResponse(client.res, 'message', message, eventId);

    logger.debug({ sessionId, message }, 'Sent SSE message');
  }

  /**
   * Receive method (required by Transport interface)
   * Not used in HTTP transport as messages come via POST
   */
  async *receive(): AsyncGenerator<unknown> {
    // HTTP transport doesn't use this method
    // Messages are received via POST requests
    yield {};
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    // Close all client connections
    for (const [sessionId, client] of this.clients) {
      try {
        client.res.end();
      } catch (error) {
        logger.logError(error as Error, { sessionId, operation: 'close client' });
      }
    }

    this.clients.clear();
    this.messageQueues.clear();

    // Close HTTP server
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        logger.logTransportEvent('HTTP server closed');
        resolve();
      });
    });
  }

  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(req: IncomingMessage): boolean {
    const origin = req.headers.origin || '';
    return this.config.security.allowedOrigins.includes(origin) || origin === '';
  }

  /**
   * Get allowed origins for CORS
   */
  private getAllowedOrigins(): string {
    return this.config.security.allowedOrigins.join(', ');
  }

  /**
   * Set up SSE headers for response
   */
  private setupSSEForResponse(res: ServerResponse, sessionId: string, protocolVersion: string) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Mcp-Session-Id': sessionId,
      'MCP-Protocol-Version': protocolVersion,
      'Access-Control-Allow-Origin': this.getAllowedOrigins(),
    });
  }

  /**
   * Send SSE response
   */
  private sendSSEResponse(res: ServerResponse, event: string, data: unknown, eventId: string) {
    try {
      res.write(`id: ${eventId}\n`);
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      logger.logError(error as Error, { event, eventId, operation: 'sendSSEResponse' });
    }
  }

  /**
   * Send error response
   */
  private sendErrorResponse(
    res: ServerResponse,
    statusCode: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': this.getAllowedOrigins(),
    });
    res.end(JSON.stringify({
      error: message,
      ...details,
    }));
  }

  /**
   * Send JSON-RPC error response
   */
  private sendJSONRPCError(
    res: ServerResponse,
    code: number,
    message: string,
    sessionId: string,
    details?: Record<string, unknown>,
  ) {
    const errorResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code,
        message,
        data: details,
      },
    };

    res.writeHead(400, {
      'Content-Type': 'application/json',
      'Mcp-Session-Id': sessionId,
      'MCP-Protocol-Version': '2025-06-18',
    });
    res.end(JSON.stringify(errorResponse));
  }

  /**
   * Process MCP message using the weather server's processMessage method
   */
  private async processMCPMessage(message: Record<string, unknown>): Promise<unknown> {
    try {
      // Use the weather server's processMessage method
      return await this.weatherServer.processMessage(message);
    } catch (error) {
      logger.logError(error as Error, {
        method: (message as { method?: string }).method,
        id: (message as { id?: string | number }).id,
      });

      return {
        jsonrpc: '2.0',
        id: (message as { id?: string | number }).id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: { details: (error as Error).message },
        },
      };
    }
  }

  /**
   * Start the transport (required by MCP SDK Transport interface)
   */
  async start(): Promise<void> {
    // Transport is already started in constructor
    // This method is required by the Transport interface
    logger.debug('Transport start method called');
  }

  /**
   * Get server information for diagnostics
   */
  public getStats() {
    return {
      activeClients: this.clients.size,
      queuedMessages: Array.from(this.messageQueues.values()).reduce((sum, queue) => sum + queue.length, 0),
      port: this.transportConfig.http?.port || 8080,
    };
  }
}

/**
 * Client connection interface
 */
interface ClientConnection {
  res: ServerResponse;
  sessionId: string;
  lastEventId?: string;
  connectedAt: number;
}
