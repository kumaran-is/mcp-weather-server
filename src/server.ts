#!/usr/bin/env node

/**
 * MCP Weather Server Entry Point
 * Supports both stdio and HTTP transports
 */

import 'dotenv/config';
import Fastify from 'fastify';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { WeatherMCPServer } from './mcp-server.js';
import { logger } from './logger.js';
import { getConfig } from './config/config.js';
import { randomUUID } from 'node:crypto';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

/**
 * Main entry point for the MCP Weather Server
 */
export async function main() {
  try {
    const config = getConfig();
    const transportType = process.env.MCP_TRANSPORT || 'stdio';

    logger.info('Starting MCP Weather Server', {
      transport: transportType,
      nodeVersion: process.version,
      platform: process.platform
    });

    // Create MCP server instance
    const weatherServer = new WeatherMCPServer();
    const server = weatherServer.getServer();

    // Choose transport based on configuration
    if (config.server.transport === 'http') {
      const port = config.server.httpPort;
      logger.info('Using HTTP transport', { port });

      // Create Fastify instance
      const fastify = Fastify({
        logger: false, // We use our own logger
        disableRequestLogging: true, // Disable Fastify's request logging
      });

      // Map to store transports by session ID
      const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

      // Handle POST requests for client-to-server communication
      fastify.post('/mcp', async (request, reply) => {
        // Check for existing session ID
        const sessionId = request.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          // Reuse existing transport
          transport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(request.body)) {
          // New initialization request - create new transport
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId) => {
              // Store the transport by session ID
              transports[sessionId] = transport;
            },
            // Disable DNS rebinding protection for local development
            enableDnsRebindingProtection: false,
          });

          // Clean up transport when closed
          transport.onclose = () => {
            if (transport.sessionId) {
              delete transports[transport.sessionId];
            }
          };

          // Connect the MCP server to the transport
          await server.connect(transport);
        } else {
          // Invalid request
          return reply.status(400).send({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided',
            },
            id: null,
          });
        }

        // Handle the request
        await transport.handleRequest(request.raw, reply.raw, request.body);
      });

      // Handle GET requests for server-to-client notifications via SSE
      fastify.get('/mcp', async (request, reply) => {
        const sessionId = request.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
          return reply.status(400).send('Invalid or missing session ID');
        }

        const transport = transports[sessionId];
        await transport.handleRequest(request.raw, reply.raw);
      });

      // Handle DELETE requests for session termination
      fastify.delete('/mcp', async (request, reply) => {
        const sessionId = request.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
          return reply.status(400).send('Invalid or missing session ID');
        }

        const transport = transports[sessionId];
        await transport.handleRequest(request.raw, reply.raw);
      });

      // Add health check endpoint
      fastify.get('/health', async (request, reply) => {
        return reply.send({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          transport: 'http',
          activeSessions: Object.keys(transports).length,
        });
      });

      // Start the Fastify server
      try {
        await fastify.listen({ port });
        logger.info(`MCP Weather Server started successfully with HTTP transport on port ${port}`);
      } catch (error) {
        logger.fatal('HTTP server error', { error: error.message });
        process.exit(1);
      }

      // Graceful shutdown
      const shutdown = async () => {
        logger.info('Shutting down gracefully');
        await fastify.close();
        // Close all transports
        for (const transport of Object.values(transports)) {
          await transport.close();
        }
        process.exit(0);
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);

    } else {
      logger.info('Using stdio transport');

      const stdioTransport = new StdioServerTransport();
      await server.connect(stdioTransport);

      logger.info('MCP Weather Server started successfully with stdio transport');
    }

  } catch (error) {
    logger.fatal('Failed to start MCP Weather Server', { error: (error as Error).message });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught exception in main process', { error: (error as Error).message });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal('Unhandled rejection in main process', { reason: (reason as Error).message });
  process.exit(1);
});

// Start the server
main().catch((error) => {
  logger.fatal('Fatal error during server startup', { error: (error as Error).message });
  process.exit(1);
});
