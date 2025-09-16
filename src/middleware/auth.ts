/**
 * @fileoverview Authentication middleware for MCP Weather Server
 * Provides API key validation and security enforcement based on Context7 patterns
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/auth-config';
import { SecurityManager } from '../security/sanitizer';
import { logger } from '../logger-pino';

/**
 * Authentication context for validated requests
 */
export interface AuthContext {
  apiKey: string;
  keyId: string;
  permissions: string[];
  rateLimit: {
    limit: number;
    window: number;
  };
}

/**
 * Extended FastifyRequest with authentication context
 */
export interface AuthenticatedRequest extends FastifyRequest {
  auth?: AuthContext;
}

/**
 * API key validation patterns
 */
const API_KEY_PATTERNS = {
  development: /^dev_[a-zA-Z0-9]{32}$/,
  production: /^prod_[a-zA-Z0-9]{64}$/,
  test: /^test_[a-zA-Z0-9]{16}$/,
} as const;

/**
 * Authentication middleware factory
 * Validates API keys and enriches request context with authentication information
 */
export function createAuthMiddleware() {
  const securityManager = new SecurityManager();

  return async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const correlationId = request.headers['x-correlation-id'] || 'unknown';
    const startTime = Date.now();

    try {
      // Extract API key from Authorization header or query parameter
      let apiKey = extractApiKey(request);

      if (!apiKey) {
        logger.warn('Authentication failed: Missing API key', {
          correlationId,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          path: request.url,
        });

        return reply.code(401).send({
          error: {
            code: 'MISSING_API_KEY',
            message: 'API key is required',
            hint: 'Provide API key in Authorization header as "Bearer <key>" or api_key query parameter',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Sanitize API key input
      apiKey = securityManager.sanitizeInput(apiKey) as string;

      // Validate API key format
      if (!isValidApiKeyFormat(apiKey)) {
        logger.warn('Authentication failed: Invalid API key format', {
          correlationId,
          ip: request.ip,
          keyPrefix: apiKey.substring(0, 8) + '...',
        });

        return reply.code(401).send({
          error: {
            code: 'INVALID_API_KEY_FORMAT',
            message: 'Invalid API key format',
            hint: 'API key must match the expected format for your environment',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate API key and get context
      const authContext = await validateApiKey(apiKey);

      if (!authContext) {
        logger.warn('Authentication failed: Invalid API key', {
          correlationId,
          ip: request.ip,
          keyPrefix: apiKey.substring(0, 8) + '...',
        });

        return reply.code(401).send({
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid or expired API key',
            hint: 'Verify your API key is correct and not expired',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Enrich request with authentication context
      (request as AuthenticatedRequest).auth = authContext;

      // Log successful authentication
      logger.info('Authentication successful', {
        correlationId,
        keyId: authContext.keyId,
        permissions: authContext.permissions,
        duration: Date.now() - startTime,
      });

    } catch (error) {
      logger.error('Authentication middleware error', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
      });

      return reply.code(500).send({
        error: {
          code: 'AUTH_MIDDLEWARE_ERROR',
          message: 'Internal authentication error',
          hint: 'Please try again or contact support if the issue persists',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
}

/**
 * Extract API key from request headers or query parameters
 */
function extractApiKey(request: FastifyRequest): string | null {
  // Check Authorization header first (preferred method)
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check X-API-Key header (alternative method)
  const apiKeyHeader = request.headers['x-api-key'];
  if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }

  // Check query parameter (least secure, for development only)
  if (config.NODE_ENV === 'development') {
    const query = request.query as Record<string, unknown>;
    if (query.api_key && typeof query.api_key === 'string') {
      return query.api_key;
    }
  }

  return null;
}

/**
 * Validate API key format based on environment
 */
function isValidApiKeyFormat(apiKey: string): boolean {
  const pattern = API_KEY_PATTERNS[config.NODE_ENV as keyof typeof API_KEY_PATTERNS];
  if (!pattern) {
    // For unknown environments, accept any key with minimum length
    return apiKey.length >= 32 && /^[a-zA-Z0-9_-]+$/.test(apiKey);
  }

  return pattern.test(apiKey);
}

/**
 * Validate API key against configured store and return authentication context
 */
async function validateApiKey(apiKey: string): Promise<AuthContext | null> {
  try {
  // Check if MCP server authentication is enabled
    const mcpServerKeys = getMcpServerApiKeys();

    if (mcpServerKeys.size === 0) {
    // Authentication disabled - allow all requests with default permissions
      return {
        apiKey,
        keyId: 'unauthenticated',
        permissions: ['weather:read', 'weather:forecast'],
        rateLimit: {
          limit: config.RATE_LIMIT_PER_CLIENT,
          window: config.RATE_LIMIT_WINDOW_MS,
        },
      };
    }

    // Authentication enabled - validate against configured keys
    if (!mcpServerKeys.has(apiKey)) {
      return null;
    }

    const keyInfo = mcpServerKeys.get(apiKey);
    if (!keyInfo) {
      return null;
    }

    return {
      apiKey,
      keyId: keyInfo.id,
      permissions: keyInfo.permissions,
      rateLimit: {
        limit: keyInfo.rateLimit || config.RATE_LIMIT_PER_CLIENT,
        window: keyInfo.rateLimitWindow || config.RATE_LIMIT_WINDOW_MS,
      },
    };
  } catch (error) {
    logger.error('API key validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Get MCP server API keys from configuration (optional authentication)
 * Returns empty map if authentication is disabled
 */
function getMcpServerApiKeys(): Map<string, {
  id: string;
  permissions: string[];
  rateLimit?: number;
  rateLimitWindow?: number;
}> {
  const keys = new Map();

  // Check for MCP server API keys in environment
  const mcpServerKeys = process.env.MCP_SERVER_API_KEYS?.split(',') || [];

  mcpServerKeys.forEach((key, index) => {
    if (key.trim()) {
      keys.set(key.trim(), {
        id: `mcp_client_${index}`,
        permissions: ['weather:read', 'weather:forecast', 'weather:alerts'],
        rateLimit: config.RATE_LIMIT_PER_CLIENT,
        rateLimitWindow: config.RATE_LIMIT_WINDOW_MS,
      });
    }
  });

  // Development keys (only if MCP_SERVER_API_KEYS not set)
  if (keys.size === 0 && config.NODE_ENV === 'development') {
    // No authentication required in development by default
    logger.info('MCP server authentication disabled - allowing all requests');
  }

  return keys;
}

/**
 * Check if request has required permission
 */
export function hasPermission(request: AuthenticatedRequest, permission: string): boolean {
  if (!request.auth) {
    return false;
  }

  return request.auth.permissions.includes(permission) ||
         request.auth.permissions.includes('*');
}

/**
 * Create permission check middleware
 */
export function requirePermission(permission: string) {
  return async function permissionMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const authRequest = request as AuthenticatedRequest;

    if (!hasPermission(authRequest, permission)) {
      const correlationId = request.headers['x-correlation-id'] || 'unknown';

      logger.warn('Permission denied', {
        correlationId,
        keyId: authRequest.auth?.keyId,
        requiredPermission: permission,
        userPermissions: authRequest.auth?.permissions || [],
      });

      return reply.code(403).send({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Permission '${permission}' is required`,
          hint: 'Contact your administrator to request additional permissions',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
}

/**
 * Optional authentication middleware - does not reject unauthenticated requests
 */
export function createOptionalAuthMiddleware() {
  const authMiddleware = createAuthMiddleware();

  return async function optionalAuthMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      await authMiddleware(request, reply);
    } catch (error) {
      // Continue without authentication for optional auth
      logger.debug('Optional authentication failed, continuing without auth', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}
