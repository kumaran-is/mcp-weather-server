#!/usr/bin/env node

/**
 * MCP Weather Server Entry Point
 * Supports both stdio and HTTP transports
 */

import 'dotenv/config';
import express from 'express';
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
async function main() {
  try {
    const config = getConfig();
    const transportType = process.env.MCP_TRANSPORT || 'stdio';

    logger.info({
      transport: transportType,
      nodeVersion: process.version,
      platform: process.platform
    }, 'Starting MCP Weather Server');

    // Create MCP server instance
    const weatherServer = new WeatherMCPServer();
    const server = weatherServer.getServer();

    // Choose transport based on configuration
    if (config.transport.type === 'http') {
      const port = config.transport.http?.port || 8080;
      logger.info({ port }, 'Using HTTP transport');

      // Create Express app for HTTP server
      const app = express();
      app.use(express.json());

      // Map to store transports by session ID
      const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

      // Handle POST requests for client-to-server communication
      app.post('/mcp', async (req, res) => {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          // Reuse existing transport
          transport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
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
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided',
            },
            id: null,
          });
          return;
        }

        // Handle the request
        await transport.handleRequest(req, res, req.body);
      });

      // Handle GET requests for server-to-client notifications via SSE
      app.get('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
          res.status(400).send('Invalid or missing session ID');
          return;
        }

        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
      });

      // Handle DELETE requests for session termination
      app.delete('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
          res.status(400).send('Invalid or missing session ID');
          return;
        }

        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
      });

      // Add health check endpoint
      app.get('/health', (req, res) => {
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          transport: 'http',
          activeSessions: Object.keys(transports).length,
        });
      });

      // Start the HTTP server
      const httpServer = app.listen(port, () => {
        logger.info(`MCP Weather Server started successfully with HTTP transport on port ${port}`);
      });

      // Handle server errors
      httpServer.on('error', (error) => {
        logger.fatal(error as Error, 'HTTP server error');
        process.exit(1);
      });

      // Graceful shutdown
      process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down gracefully');
        httpServer.close();
        // Close all transports
        for (const transport of Object.values(transports)) {
          await transport.close();
        }
        process.exit(0);
      });

      process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down gracefully');
        httpServer.close();
        // Close all transports
        for (const transport of Object.values(transports)) {
          await transport.close();
        }
        process.exit(0);
      });

    } else {
      logger.info('Using stdio transport');

      const stdioTransport = new StdioServerTransport();
      await server.connect(stdioTransport);

      logger.info('MCP Weather Server started successfully with stdio transport');
    }

  } catch (error) {
    logger.fatal(error as Error, 'Failed to start MCP Weather Server');
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.fatal(error, 'Uncaught exception in main process');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal(reason as Error, 'Unhandled rejection in main process');
  process.exit(1);
});

// Start the server
main().catch((error) => {
  logger.fatal(error, 'Fatal error during server startup');
  process.exit(1);
});
