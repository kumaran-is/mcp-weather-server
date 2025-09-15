/**
 * @fileoverview Authentication middleware for MCP Weather Server
 * Provides API key validation and security enforcement based on Context7 patterns
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/auth-config.js';
import { SecurityManager } from '../security/sanitizer.js';
import { logger } from '../logger-pino.js';
import { ValidationError } from '../errors/weather-errors.js';

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
  test: /^test_[a-zA-Z0-9]{16}$/
} as const;

/**
 * Authentication middleware factory
 * Validates API keys and enriches request context with authentication information
 */
export function createAuthMiddleware() {
  const securityManager = new SecurityManager();

  return async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
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
          path: request.url
        });

        return reply.code(401).send({
          error: {
            code: 'MISSING_API_KEY',
            message: 'API key is required',
            hint: 'Provide API key in Authorization header as "Bearer <key>" or api_key query parameter',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Sanitize API key input
      apiKey = securityManager.sanitizeInput(apiKey) as string;

      // Validate API key format
      if (!isValidApiKeyFormat(apiKey)) {
        logger.warn('Authentication failed: Invalid API key format', {
          correlationId,
          ip: request.ip,
          keyPrefix: apiKey.substring(0, 8) + '...'
        });

        return reply.code(401).send({
          error: {
            code: 'INVALID_API_KEY_FORMAT',
            message: 'Invalid API key format',
            hint: 'API key must match the expected format for your environment',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Validate API key and get context
      const authContext = await validateApiKey(apiKey);
      
      if (!authContext) {
        logger.warn('Authentication failed: Invalid API key', {
          correlationId,
          ip: request.ip,
          keyPrefix: apiKey.substring(0, 8) + '...'
        });

        return reply.code(401).send({
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid or expired API key',
            hint: 'Verify your API key is correct and not expired',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Enrich request with authentication context
      (request as AuthenticatedRequest).auth = authContext;

      // Log successful authentication
      logger.info('Authentication successful', {
        correlationId,
        keyId: authContext.keyId,
        permissions: authContext.permissions,
        duration: Date.now() - startTime
      });

    } catch (error) {
      logger.error('Authentication middleware error', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime
      });

      return reply.code(500).send({
        error: {
          code: 'AUTH_MIDDLEWARE_ERROR',
          message: 'Internal authentication error',
          hint: 'Please try again or contact support if the issue persists',
          timestamp: new Date().toISOString()
        }
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
    // In production, this would validate against a database or external service
    // For now, validate against environment configuration
    const validKeys = getValidApiKeys();
    
    if (!validKeys.has(apiKey)) {
      return null;
    }

    const keyInfo = validKeys.get(apiKey)!;
    
    return {
      apiKey,
      keyId: keyInfo.id,
      permissions: keyInfo.permissions,
      rateLimit: {
        limit: keyInfo.rateLimit || config.RATE_LIMIT_PER_CLIENT,
        window: keyInfo.rateLimitWindow || config.RATE_LIMIT_WINDOW_MS
      }
    };
  } catch (error) {
    logger.error('API key validation error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

/**
 * Get valid API keys from configuration
 * In production, this would be replaced with a database lookup
 */
function getValidApiKeys(): Map<string, {
  id: string;
  permissions: string[];
  rateLimit?: number;
  rateLimitWindow?: number;
}> {
  const keys = new Map();

  // Development keys
  if (config.NODE_ENV === 'development') {
    keys.set('dev_12345678901234567890123456789012', {
      id: 'dev_001',
      permissions: ['weather:read', 'weather:forecast'],
      rateLimit: 1000,
      rateLimitWindow: 60000
    });
  }

  // Production keys from environment
  if (config.WEATHER_API_KEY) {
    keys.set(config.WEATHER_API_KEY, {
      id: 'weather_primary',
      permissions: ['weather:read', 'weather:forecast', 'weather:alerts'],
      rateLimit: config.RATE_LIMIT_PER_CLIENT,
      rateLimitWindow: config.RATE_LIMIT_WINDOW_MS
    });
  }

  // Additional keys from environment (comma-separated)
  const additionalKeys = process.env.ADDITIONAL_API_KEYS?.split(',') || [];
  additionalKeys.forEach((key, index) => {
    if (key.trim()) {
      keys.set(key.trim(), {
        id: `additional_${index}`,
        permissions: ['weather:read'],
        rateLimit: Math.floor(config.RATE_LIMIT_PER_CLIENT / 2),
        rateLimitWindow: config.RATE_LIMIT_WINDOW_MS
      });
    }
  });

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
    reply: FastifyReply
  ): Promise<void> {
    const authRequest = request as AuthenticatedRequest;
    
    if (!hasPermission(authRequest, permission)) {
      const correlationId = request.headers['x-correlation-id'] || 'unknown';
      
      logger.warn('Permission denied', {
        correlationId,
        keyId: authRequest.auth?.keyId,
        requiredPermission: permission,
        userPermissions: authRequest.auth?.permissions || []
      });

      return reply.code(403).send({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Permission '${permission}' is required`,
          hint: 'Contact your administrator to request additional permissions',
          timestamp: new Date().toISOString()
        }
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
    reply: FastifyReply
  ): Promise<void> {
    try {
      await authMiddleware(request, reply);
    } catch (error) {
      // Continue without authentication for optional auth
      logger.debug('Optional authentication failed, continuing without auth', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}
