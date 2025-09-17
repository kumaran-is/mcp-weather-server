#!/usr/bin/env node

/**
 * MCP Weather Server Entry Point
 * Supports both stdio and HTTP transports
 */

import 'dotenv/config';
import Fastify from 'fastify';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { WeatherMCPServer } from './mcp-server';
import { logger } from './logger-pino';
import { getConfig } from './config/config';
import { randomUUID } from 'node:crypto';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';
import { securityManager } from './security/sanitizer';
import { securityMonitor } from './security/security-monitor';
import { auditLogger } from './audit/audit-logger';

// Extend Fastify types for security context
declare module 'fastify' {
  interface FastifyRequest {
    mcpSecurityContext?: {
      startTime: number;
      clientIP: string;
      userAgent: string;
      sanitizedHeaders: Record<string, string>;
      threats: any[];
    };
  }
}

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

    // Create MCP server instance with modern SDK
    const weatherMCPServer = new WeatherMCPServer();
    const mcpServer = weatherMCPServer.getServer();

    // Choose transport based on configuration
    if (config.server.transport === 'http') {
      const port = config.server.httpPort;
      logger.info('Using HTTP transport', { port });

      // Create Fastify instance
      const fastify = Fastify({
        logger: false, // We use our own logger
        disableRequestLogging: true, // Disable Fastify's request logging
      });

      // Add security headers hook
      fastify.addHook('onSend', async (request, reply, payload) => {
        // Add security headers
        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('X-Frame-Options', 'DENY');
        reply.header('X-XSS-Protection', '1; mode=block');
        reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
        reply.header('Content-Security-Policy', securityManager.getContentSecurityPolicy());
        reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        
        return payload;
      });

      // Add comprehensive security middleware
      fastify.addHook('preHandler', async (request, reply) => {
        const startTime = Date.now();
        const clientIP = request.ip;
        const userAgent = request.headers['user-agent'] || 'unknown';
        const method = request.method;
        const url = request.url;

        // Security: Sanitize headers
        const sanitizedHeaders = securityManager.sanitizeHeaders(request.headers);
        
        // Security: Monitor request for threats
        const threats = securityMonitor.monitorRequest(
          method,
          url,
          sanitizedHeaders,
          request.body,
          clientIP,
          undefined // No user ID in MCP context
        );

        // Security: Block if critical threats detected
        if (threats.some(threat => threat.severity === 'critical')) {
          // Audit: Log blocked request
          auditLogger.logSecurity('request_blocked', 'http_transport', 'success', 'critical', undefined, {
            method,
            url,
            statusCode: 403,
            duration: Date.now() - startTime,
            ip: clientIP,
            userAgent,
            metadata: { 
              threatsDetected: threats.length,
              threatTypes: threats.map(t => t.type)
            }
          });

          return reply.status(403).send({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Request blocked due to security threat detection'
            },
            id: null
          });
        }

        // Audit: Log all HTTP requests
        auditLogger.logApiUsage(method, url, 0, 0, undefined, {
          ip: clientIP,
          userAgent,
          metadata: { phase: 'request_start' }
        });

        // Add request context for later use
        request.mcpSecurityContext = {
          startTime,
          clientIP,
          userAgent,
          sanitizedHeaders,
          threats
        };
      });

      // Add response logging hook
      fastify.addHook('onResponse', async (request, reply) => {
        const context = request.mcpSecurityContext;
        if (!context) return;

        const duration = Date.now() - context.startTime;
        const statusCode = reply.statusCode;

        // Audit: Log completed request
        auditLogger.logApiUsage(
          request.method,
          request.url,
          statusCode,
          duration,
          undefined,
          {
            ip: context.clientIP,
            userAgent: context.userAgent,
            metadata: { 
              phase: 'request_complete',
              threatsDetected: context.threats.length
            }
          }
        );

        // Security: Log suspicious response patterns
        if (statusCode >= 400) {
          auditLogger.logSecurity(
            'http_error_response',
            'http_transport',
            statusCode < 500 ? 'failure' : 'error',
            statusCode >= 500 ? 'high' : 'medium',
            undefined,
            {
              method: request.method,
              url: request.url,
              statusCode,
              duration,
              ip: context.clientIP,
              userAgent: context.userAgent
            }
          );
        }
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
            onsessioninitialized: (sessionId: string) => {
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

          // Connect the modern MCP server to the transport
          await mcpServer.connect(transport);
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
      fastify.get('/health', async (_request, reply) => {
        return reply.send({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          transport: 'http',
          activeSessions: Object.keys(transports).length,
        });
      });

      // Add security monitoring endpoints
      fastify.get('/security/threats', async (request, reply) => {
        const threats = securityMonitor.getThreats();
        
        // Audit: Log security data access
        auditLogger.logDataAccess('read', 'security_threats', 'success', undefined, {
          method: 'GET',
          url: '/security/threats',
          payload: { threatsCount: threats.length },
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });

        return reply.send({
          threats: threats.slice(0, 100), // Limit to last 100 threats
          totalCount: threats.length,
          timestamp: new Date().toISOString()
        });
      });

      fastify.get('/security/blocked-ips', async (request, reply) => {
        // Note: This would need to be implemented in SecurityMonitor
        // For now, return empty list
        auditLogger.logDataAccess('read', 'blocked_ips', 'success', undefined, {
          method: 'GET',
          url: '/security/blocked-ips',
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });

        return reply.send({
          blockedIPs: [],
          timestamp: new Date().toISOString()
        });
      });

      // Add audit endpoints
      fastify.get('/audit/events', async (request, reply) => {
        const query = request.query as { limit?: string; offset?: string } || {};
        const filter = {
          limit: parseInt(query.limit as string) || 50,
          offset: parseInt(query.offset as string) || 0
        };

        const events = auditLogger.query(filter);
        
        // Audit: Log audit data access
        auditLogger.logDataAccess('read', 'audit_events', 'success', undefined, {
          method: 'GET',
          url: '/audit/events',
          payload: filter,
          metadata: { eventsReturned: events.length },
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });

        return reply.send({
          events,
          pagination: {
            limit: filter.limit,
            offset: filter.offset,
            total: events.length
          },
          timestamp: new Date().toISOString()
        });
      });

      fastify.get('/audit/statistics', async (request, reply) => {
        const statistics = auditLogger.getStatistics();
        
        // Audit: Log statistics access
        auditLogger.logDataAccess('read', 'audit_statistics', 'success', undefined, {
          method: 'GET',
          url: '/audit/statistics',
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });

        return reply.send({
          statistics,
          timestamp: new Date().toISOString()
        });
      });

      // Add configuration endpoint
      fastify.get('/config/security', async (request, reply) => {
        const config = {
          auditEnabled: auditLogger.getConfiguration().enabled,
          securityMonitoringEnabled: true, // Hardcoded for now
          allowedHeaders: ['content-type', 'authorization', 'mcp-session-id', 'user-agent'],
          rateLimiting: {
            enabled: true,
            requestsPerMinute: 100
          }
        };

        // Audit: Log config access
        auditLogger.logDataAccess('read', 'security_config', 'success', undefined, {
          method: 'GET',
          url: '/config/security',
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });

        return reply.send({
          config,
          timestamp: new Date().toISOString()
        });
      });

      // Start the Fastify server
      try {
        await fastify.listen({ port, host: '0.0.0.0' });
        logger.info(`MCP Weather Server started successfully with HTTP transport on port ${port}`);
      } catch (error) {
        logger.fatal('HTTP server error', { error: (error as Error).message });
        process.exit(1);
      }

      // Graceful shutdown
      const shutdown = async () => {
        logger.info('Shutting down gracefully');
        
        // Stop metrics collection
        const { streamingMetricsCollector } = await import('./undici-resilience/streaming/streaming-metrics');
        streamingMetricsCollector.cleanup();
        
        // Close all transports
        for (const transport of Object.values(transports)) {
          await transport.close();
        }
        
        // Close Fastify server
        await fastify.close();
        
        // Give a moment for cleanup
        setTimeout(() => {
          logger.info('Shutdown complete');
          process.exit(0);
        }, 100);
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
      
      // Prevent multiple shutdown attempts
      let shutdownInProgress = false;
      const safeShutdown = async () => {
        if (!shutdownInProgress) {
          shutdownInProgress = true;
          await shutdown();
        }
      };
      
      process.removeAllListeners('SIGTERM');
      process.removeAllListeners('SIGINT');
      process.on('SIGTERM', safeShutdown);
      process.on('SIGINT', safeShutdown);

    } else {
      logger.info('Using stdio transport');

      const stdioTransport = new StdioServerTransport();
      await mcpServer.connect(stdioTransport);

      logger.info('MCP Weather Server started successfully with stdio transport');
    }

  } catch (error) {
    logger.fatal('Failed to start MCP Weather Server', { error: (error as Error).message });
    process.exit(1);
  }
}

// Only run main if this is the entry point (not imported as a module)
// In CommonJS, check if require.main === module
if (require.main === module) {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.fatal('Uncaught exception in main process', { error: (error as Error).message });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, _promise) => {
    logger.fatal('Unhandled rejection in main process', { reason: (reason as Error).message });
    process.exit(1);
  });

  // Start the server
  main().catch((error) => {
    logger.fatal('Fatal error during server startup', { error: (error as Error).message });
    process.exit(1);
  });
}
