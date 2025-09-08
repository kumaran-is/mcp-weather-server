#!/usr/bin/env node

/**
 * MCP Weather Server Entry Point
 * Supports both stdio and HTTP transports
 */

import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WeatherMCPServer } from './mcp-server.js';
import { StreamableHTTPTransport } from './transports/http-transport.js';
import { logger } from './logger.js';
import { getConfig } from './config/config.js';

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
      logger.info({ port: config.transport.http?.port }, 'Using HTTP transport');

      const httpTransport = new StreamableHTTPTransport(server);
      await server.connect(httpTransport);

      logger.info('MCP Weather Server started successfully with HTTP transport');

      // Keep the process running
      process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down gracefully');
        await httpTransport.close();
        process.exit(0);
      });

      process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down gracefully');
        await httpTransport.close();
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
