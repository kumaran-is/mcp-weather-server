/**
 * @fileoverview Rate limiting middleware for MCP Weather Server
 * Provides advanced rate limiting based on Context7 rate-limiter-flexible patterns
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { config } from '../config/auth-config';
import { generateRateLimitKey } from '../security/sanitizer';
import { logger } from '../logger-pino';
import { AuthenticatedRequest } from './auth';

/**
 * Rate limiter configuration interface
 */
interface RateLimiterConfig {
  points: number;
  duration: number;
  blockDuration?: number;
  execEvenly?: boolean;
}

/**
 * Rate limiting manager using Context7 patterns
 */
export class RateLimitManager {
  private globalLimiter: RateLimiterMemory;
  private perClientLimiter: RateLimiterMemory;
  private perIPLimiter: RateLimiterMemory;
  private perEndpointLimiter: Map<string, RateLimiterMemory>;

  constructor() {
    // Global rate limiter - applies to all requests
    this.globalLimiter = new RateLimiterMemory({
      points: 1000, // 1000 requests
      duration: 60, // Per 60 seconds
      blockDuration: 60, // Block for 60 seconds if exceeded
      execEvenly: true, // Spread requests evenly across duration
    });

    // Per-client rate limiter (based on API key)
    this.perClientLimiter = new RateLimiterMemory({
      points: config.RATE_LIMIT_PER_CLIENT, // From config
      duration: Math.floor(config.RATE_LIMIT_WINDOW_MS / 1000), // Convert to seconds
      blockDuration: 300, // Block for 5 minutes
      execEvenly: true,
    });

    // Per-IP rate limiter (for requests without API keys)
    this.perIPLimiter = new RateLimiterMemory({
      points: 50, // 50 requests per IP
      duration: 60, // Per 60 seconds
      blockDuration: 600, // Block for 10 minutes
      execEvenly: false,
    });

    // Per-endpoint rate limiters
    this.perEndpointLimiter = new Map();
    this.initializeEndpointLimiters();
  }

  /**
   * Initialize endpoint-specific rate limiters
   */
  private initializeEndpointLimiters(): void {
    const endpointConfigs: Record<string, RateLimiterConfig> = {
      '/weather': {
        points: 100,
        duration: 60,
        blockDuration: 60,
        execEvenly: true,
      },
      '/forecast': {
        points: 50,
        duration: 60,
        blockDuration: 120,
        execEvenly: true,
      },
      '/health': {
        points: 20,
        duration: 60,
        blockDuration: 30,
        execEvenly: false,
      },
      '/mcp': {
        points: 200,
        duration: 60,
        blockDuration: 60,
        execEvenly: true,
      },
    };

    for (const [endpoint, config] of Object.entries(endpointConfigs)) {
      this.perEndpointLimiter.set(endpoint, new RateLimiterMemory(config));
    }
  }

  /**
   * Check rate limits for a request
   */
  async checkRateLimit(
    request: FastifyRequest,
    identifier: string,
    endpoint: string,
  ): Promise<{ allowed: boolean; rateLimiterRes?: RateLimiterRes; headers: Record<string, string> }> {
    const correlationId = request.headers['x-correlation-id'] || 'unknown';

    try {
      // Check global rate limit first
      const globalRes = await this.globalLimiter.consume('global');

      // Check per-client/IP rate limit
      const clientRes = await this.perClientLimiter.consume(identifier);

      // Check IP-based rate limit for additional protection
      const ipRes = await this.perIPLimiter.consume(request.ip);

      // Check endpoint-specific rate limit
      let endpointRes: RateLimiterRes | null = null;
      const endpointLimiter = this.getEndpointLimiter(endpoint);
      if (endpointLimiter) {
        const endpointKey = generateRateLimitKey(identifier, endpoint);
        endpointRes = await endpointLimiter.consume(endpointKey);
      }

      // Use the most restrictive rate limiter result
      const restrictiveRes = this.getMostRestrictive([globalRes, clientRes, ipRes, endpointRes]);

      const headers = this.buildRateLimitHeaders(restrictiveRes, this.perClientLimiter);

      logger.debug('Rate limit check passed', {
        correlationId,
        identifier,
        endpoint,
        remainingPoints: restrictiveRes.remainingPoints,
        resetTime: restrictiveRes.msBeforeNext,
      });

      return {
        allowed: true,
        rateLimiterRes: restrictiveRes,
        headers,
      };

    } catch (rateLimiterRes) {
      // Rate limit exceeded
      const res = rateLimiterRes as RateLimiterRes;
      const headers = this.buildRateLimitHeaders(res, this.perClientLimiter);

      logger.warn('Rate limit exceeded', {
        correlationId,
        identifier,
        endpoint,
        ip: request.ip,
        msBeforeNext: res.msBeforeNext,
        totalHits: (res as any).totalHits || 0,
      });

      return {
        allowed: false,
        rateLimiterRes: res,
        headers,
      };
    }
  }

  /**
   * Get endpoint-specific rate limiter
   */
  private getEndpointLimiter(endpoint: string): RateLimiterMemory | null {
    // Find the most specific matching endpoint
    for (const [pattern, limiter] of this.perEndpointLimiter.entries()) {
      if (endpoint.startsWith(pattern)) {
        return limiter;
      }
    }
    return null;
  }

  /**
   * Get the most restrictive rate limiter result
   */
  private getMostRestrictive(results: (RateLimiterRes | null)[]): RateLimiterRes {
    const validResults = results.filter((res): res is RateLimiterRes => res !== null);

    if (validResults.length === 0) {
      throw new Error('No valid rate limiter results');
    }

    // Return the result with the least remaining points
    return validResults.reduce((mostRestrictive, current) =>
      current.remainingPoints < mostRestrictive.remainingPoints ? current : mostRestrictive,
    );
  }

  /**
   * Build standard rate limit headers
   */
  private buildRateLimitHeaders(
    rateLimiterRes: RateLimiterRes,
    limiter: RateLimiterMemory,
  ): Record<string, string> {
    return {
      'X-RateLimit-Limit': String(limiter.points),
      'X-RateLimit-Remaining': String(rateLimiterRes.remainingPoints),
      'X-RateLimit-Reset': String(Math.ceil((Date.now() + rateLimiterRes.msBeforeNext) / 1000)),
      'Retry-After': String(Math.ceil(rateLimiterRes.msBeforeNext / 1000)),
    };
  }

  /**
   * Reset rate limit for a specific identifier (admin function)
   */
  async resetRateLimit(identifier: string): Promise<void> {
    await Promise.all([
      this.perClientLimiter.delete(identifier),
      this.perIPLimiter.delete(identifier),
      // Reset endpoint-specific limits
      ...Array.from(this.perEndpointLimiter.values()).map(limiter =>
        limiter.delete(identifier),
      ),
    ]);

    logger.info('Rate limit reset', { identifier });
  }

  /**
   * Get rate limit status for monitoring
   */
  async getRateLimitStatus(identifier: string): Promise<{
    global: RateLimiterRes | null;
    client: RateLimiterRes | null;
    ip: RateLimiterRes | null;
  }> {
    try {
      const [globalRes, clientRes, ipRes] = await Promise.all([
        this.globalLimiter.get('global'),
        this.perClientLimiter.get(identifier),
        this.perIPLimiter.get(identifier),
      ]);

      return {
        global: globalRes,
        client: clientRes,
        ip: ipRes,
      };
    } catch (error) {
      logger.error('Error getting rate limit status', {
        identifier,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { global: null, client: null, ip: null };
    }
  }
}

/**
 * Global rate limit manager instance
 */
const rateLimitManager = new RateLimitManager();

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware() {
  return async function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const correlationId = request.headers['x-correlation-id'] || 'unknown';
    const startTime = Date.now();

    try {
      // Extract identifier (API key or IP address)
      const authRequest = request as AuthenticatedRequest;
      const identifier = authRequest.auth?.keyId || `ip:${request.ip}`;

      // Extract endpoint for specific limiting
      const endpoint = request.url.split('?')[0]; // Remove query parameters

      // Check rate limits
      const rateLimitResult = await rateLimitManager.checkRateLimit(
        request,
        identifier,
        endpoint,
      );

      // Add rate limit headers to response
      for (const [header, value] of Object.entries(rateLimitResult.headers)) {
        reply.header(header, value);
      }

      if (!rateLimitResult.allowed) {
        const retryAfter = Math.ceil((rateLimitResult.rateLimiterRes?.msBeforeNext || 0) / 1000);

        logger.warn('Request rejected: Rate limit exceeded', {
          correlationId,
          identifier,
          endpoint,
          ip: request.ip,
          retryAfter,
          totalHits: (rateLimitResult.rateLimiterRes as any)?.totalHits || 0,
        });

        return reply.code(429).send({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            hint: `Please wait ${retryAfter} seconds before making another request`,
            retryAfter,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Log successful rate limit check
      logger.debug('Rate limit check passed', {
        correlationId,
        identifier,
        endpoint,
        remainingPoints: rateLimitResult.rateLimiterRes?.remainingPoints,
        duration: Date.now() - startTime,
      });

    } catch (error) {
      logger.error('Rate limit middleware error', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
      });

      // In case of rate limiter error, allow the request but log the issue
      // This prevents rate limiter failures from blocking all traffic
      logger.warn('Rate limiter error - allowing request', { correlationId });
    }
  };
}

/**
 * Create adaptive rate limiting middleware
 * Adjusts limits based on authentication level and request patterns
 */
export function createAdaptiveRateLimitMiddleware() {
  return async function adaptiveRateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const authRequest = request as AuthenticatedRequest;

    // Adjust rate limits based on authentication status
    if (authRequest.auth) {
      // Authenticated requests get higher limits
      const permissions = authRequest.auth.permissions;

      // Premium permissions get even higher limits
      if (permissions.includes('*') || permissions.includes('premium')) {
        // Create temporary higher-limit rate limiter for premium users
        const premiumLimiter = new RateLimiterMemory({
          points: config.RATE_LIMIT_PER_CLIENT * 5,
          duration: Math.floor(config.RATE_LIMIT_WINDOW_MS / 1000),
          blockDuration: 60,
          execEvenly: true,
        });

        try {
          await premiumLimiter.consume(authRequest.auth.keyId);

          // Add premium rate limit headers
          reply.header('X-RateLimit-Tier', 'premium');
          reply.header('X-RateLimit-Limit', String(config.RATE_LIMIT_PER_CLIENT * 5));

        } catch (rateLimiterRes) {
          const res = rateLimiterRes as RateLimiterRes;
          const retryAfter = Math.ceil(res.msBeforeNext / 1000);

          return reply.code(429).send({
            error: {
              code: 'PREMIUM_RATE_LIMIT_EXCEEDED',
              message: 'Premium rate limit exceeded',
              hint: `Please wait ${retryAfter} seconds before making another request`,
              retryAfter,
              timestamp: new Date().toISOString(),
            },
          });
        }
      } else {
        // Standard authenticated rate limiting
        await createRateLimitMiddleware()(request, reply);
      }
    } else {
      // Unauthenticated requests get lower limits
      const strictLimiter = new RateLimiterMemory({
        points: 20, // Much lower limit for unauthenticated
        duration: 60,
        blockDuration: 300,
        execEvenly: false,
      });

      try {
        await strictLimiter.consume(request.ip);

        reply.header('X-RateLimit-Tier', 'unauthenticated');
        reply.header('X-RateLimit-Limit', '20');

      } catch (rateLimiterRes) {
        const res = rateLimiterRes as RateLimiterRes;
        const retryAfter = Math.ceil(res.msBeforeNext / 1000);

        return reply.code(429).send({
          error: {
            code: 'UNAUTHENTICATED_RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded for unauthenticated requests',
            hint: `Please authenticate or wait ${retryAfter} seconds before making another request`,
            retryAfter,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
  };
}

/**
 * Create burst protection middleware
 * Protects against sudden spikes in traffic
 */
export function createBurstProtectionMiddleware() {
  const burstLimiter = new RateLimiterMemory({
    points: 10, // 10 requests
    duration: 1, // Per 1 second
    blockDuration: 10, // Block for 10 seconds
    execEvenly: false, // Don't spread evenly - allow bursts up to limit
  });

  return async function burstProtectionMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const authRequest = request as AuthenticatedRequest;
    const identifier = authRequest.auth?.keyId || `ip:${request.ip}`;
    const correlationId = request.headers['x-correlation-id'] || 'unknown';

    try {
      await burstLimiter.consume(identifier);

      logger.debug('Burst protection check passed', {
        correlationId,
        identifier,
      });

    } catch (rateLimiterRes) {
      const res = rateLimiterRes as RateLimiterRes;
      const retryAfter = Math.ceil(res.msBeforeNext / 1000);

      logger.warn('Request rejected: Burst protection triggered', {
        correlationId,
        identifier,
        ip: request.ip,
        retryAfter,
      });

      return reply.code(429).send({
        error: {
          code: 'BURST_LIMIT_EXCEEDED',
          message: 'Too many requests in a short time',
          hint: `Please wait ${retryAfter} seconds before making another request`,
          retryAfter,
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
}

/**
 * Export rate limit manager for external use
 */
export { rateLimitManager };

/**
 * Health check for rate limiters
 */
export async function checkRateLimiterHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
}> {
  try {
    // Test basic functionality
    const testKey = `health-check-${Date.now()}`;
    const testLimiter = new RateLimiterMemory({
      points: 1,
      duration: 1,
    });

    await testLimiter.consume(testKey);
    await testLimiter.delete(testKey);

    return {
      status: 'healthy',
      details: {
        timestamp: new Date().toISOString(),
        message: 'Rate limiters are functioning correctly',
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
