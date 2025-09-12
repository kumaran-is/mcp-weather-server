/**
 * Simple SSE Transport for MCP Server
 *
 * This transport implements a lightweight Server-Sent Events (SSE) protocol
 * designed for compatibility with Cline and other simple SSE clients.
 * Unlike the Streamable HTTP transport, this uses a single SSE endpoint
 * for bidirectional communication.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { setInterval, clearInterval } from 'timers';
import { WeatherMCPServer } from '../mcp-server.js';
import { logger } from '../logger-pino.js';
import { getConfig } from '../config/config.js';

interface SSEClient {
  res: ServerResponse;
  id: string;
  lastEventId?: string;
}

export class SimpleSSETransport {
  private weatherServer: WeatherMCPServer;
  private httpServer: import('http').Server;
  private clients: Map<string, SSEClient> = new Map();
  private config = getConfig();
  private port: number;

  constructor(weatherServer: WeatherMCPServer) {
    this.weatherServer = weatherServer;
    this.port = this.config.server.ssePort || 8081;
    this.httpServer = createServer(this.handleRequest.bind(this));
  }

  /**
   * Start the SSE server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.port, () => {
        logger.info(`Simple SSE transport started on port ${this.port}`);
        resolve();
      });

      this.httpServer.on('error', (error) => {
        logger.error('SSE server error', { error: (error as Error).message });
        reject(error);
      });
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const host = req.headers?.host || 'localhost:8081';
    const url = new URL(req.url || '/', `http://${host}`);

    // CORS headers for browser clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Last-Event-Id');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        transport: 'sse',
        port: this.port,
        clients: this.clients.size,
      }));
      return;
    }

    // SSE endpoint
    if (url.pathname === '/sse' || url.pathname === '/') {
      if (req.method === 'GET') {
        await this.handleSSEConnection(req, res);
      } else {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method not allowed');
      }
      return;
    }

    // Messages endpoint for POST requests from SSE clients
    if (url.pathname.startsWith('/messages/')) {
      if (req.method === 'POST') {
        await this.handleSSEMessage(req, res);
      } else {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method not allowed');
      }
      return;
    }

    // 404 for other paths
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }

  /**
   * Handle SSE connection (GET request)
   */
  private async handleSSEConnection(req: IncomingMessage, res: ServerResponse) {
    const clientId = this.generateClientId();
    const lastEventId = req.headers['last-event-id'] as string;

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-SSE-Client-Id': clientId,
    });

    // Store client
    const client: SSEClient = {
      res,
      id: clientId,
      lastEventId,
    };
    this.clients.set(clientId, client);

    // Send endpoint event as per MCP SSE protocol
    // This tells the client where to POST messages
    const endpointUrl = `http://localhost:${this.port}/messages/${clientId}`;
    this.sendSSEEvent(res, 'endpoint', endpointUrl);

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(':keepalive\n\n');
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(keepAlive);
      this.clients.delete(clientId);
      logger.info('SSE client disconnected', { clientId });
    });

    req.on('error', (error) => {
      clearInterval(keepAlive);
      this.clients.delete(clientId);
      logger.error('SSE connection error', { clientId, error: (error as Error).message });
    });

    logger.info('SSE client connected', { clientId, lastEventId });
  }

  /**
   * Handle SSE message (POST request)
   */
  private async handleSSEMessage(req: IncomingMessage, res: ServerResponse) {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const message = JSON.parse(body);

        // Extract client ID from URL path
        const urlParts = req.url?.split('/') || [];
        const clientId = urlParts[urlParts.length - 1];

        if (!clientId || !this.clients.has(clientId)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Client not found' }));
          return;
        }

        // Process MCP message
        const response = await this.processMCPMessage(message, clientId);

        // Send response via SSE to the client
        const client = this.clients.get(clientId);
        if (client) {
          this.sendSSEEvent(client.res, 'message', response, message.id);
        }

        // Send empty HTTP response (per MCP spec)
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end('{}');

      } catch (error) {
        logger.error('Error processing SSE message', { error: (error as Error).message });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  }

  /**
   * Process MCP message
   */
  private async processMCPMessage(message: any, clientId: string): Promise<any> {
    try {
      // Use the processMessage method from WeatherMCPServer
      // which handles all MCP protocol messages through the SDK
      return await this.weatherServer.processMessage(message);
    } catch (error) {
      logger.error('Error processing MCP message', {
        error: (error as Error).message,
        method: message.method,
        clientId,
      });

      return {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: (error as Error).message,
        },
        id: message.id,
      };
    }
  }

  /**
   * Send SSE event to client
   */
  private sendSSEEvent(res: ServerResponse, event: string, data: any, id?: string) {
    try {
      if (id) {
        res.write(`id: ${id}\n`);
      }
      res.write(`event: ${event}\n`);
      // For endpoint event, send just the string URL, not JSON
      if (event === 'endpoint') {
        res.write(`data: ${data}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    } catch (error) {
      logger.error('Error sending SSE event', { error: (error as Error).message });
    }
  }

  /**
   * Broadcast to all clients
   */
  public broadcast(event: string, data: any) {
    for (const client of this.clients.values()) {
      this.sendSSEEvent(client.res, event, data);
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `sse-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    // Close all client connections
    for (const [clientId, client] of this.clients) {
      try {
        this.sendSSEEvent(client.res, 'shutdown', { message: 'Server shutting down' });
        client.res.end();
      } catch (error) {
        logger.error('Error closing client', { clientId, error: (error as Error).message });
      }
    }

    this.clients.clear();

    // Close HTTP server
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        logger.info('SSE server closed');
        resolve();
      });
    });
  }

  /**
   * Get server stats
   */
  public getStats() {
    return {
      activeClients: this.clients.size,
      port: this.port,
      transport: 'sse',
    };
  }
}
