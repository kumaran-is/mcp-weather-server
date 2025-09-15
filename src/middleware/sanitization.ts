/**
 * @fileoverview Input sanitization middleware for MCP Weather Server
 * Provides comprehensive input sanitization based on DOMPurify Context7 patterns
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { SecurityManager, validateInputSize } from '../security/sanitizer.js';
import { logger } from '../logger-pino.js';

/**
 * Sanitization middleware factory
 * Sanitizes all request inputs (body, query, params, headers) before processing
 */
export function createSanitizationMiddleware() {
  const securityManager = new SecurityManager();

  return async function sanitizationMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const correlationId = request.headers['x-correlation-id'] || 'unknown';
    const startTime = Date.now();

    try {
      // Check request size limits first
      const maxSize = 1048576; // 1MB default
      
      if (request.body && !validateInputSize(request.body, maxSize)) {
        logger.warn('Request rejected: Input size exceeds limit', {
          correlationId,
          ip: request.ip,
          path: request.url,
          maxSize
        });

        return reply.code(413).send({
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Request payload exceeds size limit',
            hint: `Maximum payload size is ${maxSize} bytes`,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Sanitize request body
      if (request.body) {
        try {
          const sanitizedBody = securityManager.sanitizeInput(request.body);
          
          // Check for attack patterns in the original body
          const bodyString = JSON.stringify(request.body);
          if (securityManager.containsAttackPatterns(bodyString)) {
            logger.warn('Request rejected: Attack patterns detected in body', {
              correlationId,
              ip: request.ip,
              path: request.url,
              bodySize: bodyString.length
            });

            return reply.code(400).send({
              error: {
                code: 'MALICIOUS_INPUT_DETECTED',
                message: 'Request contains potentially malicious content',
                hint: 'Please review your input and remove any suspicious content',
                timestamp: new Date().toISOString()
              }
            });
          }

          // Replace original body with sanitized version
          request.body = sanitizedBody;
        } catch (error) {
          logger.warn('Request body sanitization failed', {
            correlationId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          return reply.code(400).send({
            error: {
              code: 'INVALID_REQUEST_BODY',
              message: 'Request body contains invalid data',
              hint: 'Please check your request format and try again',
              timestamp: new Date().toISOString()
            }
          });
        }
      }

      // Sanitize query parameters
      if (request.query && typeof request.query === 'object') {
        const sanitizedQuery: Record<string, any> = {};
        
        for (const [key, value] of Object.entries(request.query)) {
          if (typeof value === 'string') {
            // Check for attack patterns
            if (securityManager.containsAttackPatterns(value)) {
              logger.warn('Request rejected: Attack patterns detected in query', {
                correlationId,
                ip: request.ip,
                path: request.url,
                parameter: key
              });

              return reply.code(400).send({
                error: {
                  code: 'MALICIOUS_QUERY_PARAMETER',
                  message: `Query parameter '${key}' contains potentially malicious content`,
                  hint: 'Please review your query parameters and remove any suspicious content',
                  timestamp: new Date().toISOString()
                }
              });
            }

            sanitizedQuery[key] = securityManager.sanitizeInput(value);
          } else {
            sanitizedQuery[key] = securityManager.sanitizeInput(value);
          }
        }

        // Replace original query with sanitized version
        request.query = sanitizedQuery;
      }

      // Sanitize URL parameters
      if (request.params && typeof request.params === 'object') {
        const sanitizedParams: Record<string, any> = {};
        
        for (const [key, value] of Object.entries(request.params)) {
          sanitizedParams[key] = securityManager.sanitizeInput(value);
        }

        // Replace original params with sanitized version
        request.params = sanitizedParams;
      }

      // Sanitize and validate headers
      const sanitizedHeaders = securityManager.sanitizeHeaders(request.headers);
      
      // Add sanitized headers back to request
      Object.assign(request.headers, sanitizedHeaders);

      // Add Content Security Policy header to response
      reply.header('Content-Security-Policy', securityManager.getContentSecurityPolicy());
      
      // Add other security headers
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('X-Frame-Options', 'DENY');
      reply.header('X-XSS-Protection', '1; mode=block');
      reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
      reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

      // Log successful sanitization
      logger.debug('Request sanitization completed', {
        correlationId,
        path: request.url,
        method: request.method,
        hasBody: !!request.body,
        queryParams: Object.keys(request.query || {}).length,
        duration: Date.now() - startTime
      });

    } catch (error) {
      logger.error('Sanitization middleware error', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        path: request.url,
        duration: Date.now() - startTime
      });

      return reply.code(500).send({
        error: {
          code: 'SANITIZATION_ERROR',
          message: 'Internal request processing error',
          hint: 'Please try again or contact support if the issue persists',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Weather-specific input sanitization middleware
 * Validates and sanitizes weather-related parameters
 */
export function createWeatherSanitizationMiddleware() {
  const securityManager = new SecurityManager();

  return async function weatherSanitizationMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const correlationId = request.headers['x-correlation-id'] || 'unknown';

    try {
      // Sanitize city names if present
      const query = request.query as Record<string, any>;
      
      if (query.city || query.q) {
        const cityName = query.city || query.q;
        const sanitizedCity = securityManager.sanitizeCityName(cityName);
        
        if (!sanitizedCity) {
          logger.warn('Invalid city name in request', {
            correlationId,
            originalCity: cityName,
            ip: request.ip
          });

          return reply.code(400).send({
            error: {
              code: 'INVALID_CITY_NAME',
              message: 'Invalid city name format',
              hint: 'City name should contain only letters, spaces, hyphens, and apostrophes',
              timestamp: new Date().toISOString()
            }
          });
        }

        if (query.city) query.city = sanitizedCity;
        if (query.q) query.q = sanitizedCity;
      }

      // Sanitize coordinates if present
      if (query.lat && query.lon) {
        const coordinates = securityManager.sanitizeCoordinates(query.lat, query.lon);
        
        if (!coordinates) {
          logger.warn('Invalid coordinates in request', {
            correlationId,
            lat: query.lat,
            lon: query.lon,
            ip: request.ip
          });

          return reply.code(400).send({
            error: {
              code: 'INVALID_COORDINATES',
              message: 'Invalid latitude or longitude values',
              hint: 'Latitude must be between -90 and 90, longitude between -180 and 180',
              timestamp: new Date().toISOString()
            }
          });
        }

        query.lat = coordinates.lat;
        query.lon = coordinates.lon;
      }

      // Validate numeric parameters (days, limit, etc.)
      const numericParams = ['days', 'limit', 'forecast_days', 'past_days'];
      
      for (const param of numericParams) {
        if (query[param] !== undefined) {
          const value = parseInt(String(query[param]), 10);
          
          if (isNaN(value) || value < 0 || value > 365) {
            logger.warn('Invalid numeric parameter in request', {
              correlationId,
              parameter: param,
              value: query[param],
              ip: request.ip
            });

            return reply.code(400).send({
              error: {
                code: 'INVALID_NUMERIC_PARAMETER',
                message: `Invalid value for parameter '${param}'`,
                hint: 'Numeric parameters must be valid positive integers within reasonable limits',
                timestamp: new Date().toISOString()
              }
            });
          }

          query[param] = value;
        }
      }

      logger.debug('Weather-specific sanitization completed', {
        correlationId,
        hasCity: !!(query.city || query.q),
        hasCoordinates: !!(query.lat && query.lon)
      });

    } catch (error) {
      logger.error('Weather sanitization middleware error', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      return reply.code(500).send({
        error: {
          code: 'WEATHER_SANITIZATION_ERROR',
          message: 'Internal weather parameter processing error',
          hint: 'Please try again or contact support if the issue persists',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Create combined sanitization middleware for comprehensive protection
 */
export function createComprehensiveSanitizationMiddleware() {
  const generalSanitization = createSanitizationMiddleware();
  const weatherSanitization = createWeatherSanitizationMiddleware();

  return async function comprehensiveSanitizationMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // First apply general sanitization
    await generalSanitization(request, reply);
    
    // If response was already sent (error case), don't continue
    if (reply.sent) {
      return;
    }

    // Then apply weather-specific sanitization for weather endpoints
    if (request.url.includes('/weather') || request.url.includes('/forecast')) {
      await weatherSanitization(request, reply);
    }
  };
}

/**
 * Response sanitization helper
 * Sanitizes outgoing response data to prevent information leakage
 */
export function sanitizeResponse(data: any): any {
  const securityManager = new SecurityManager();
  
  // Remove sensitive fields from response
  const sensitiveFields = [
    'password',
    'secret',
    'key',
    'token',
    'auth',
    'private',
    'internal',
    'debug'
  ];

  function removeSensitiveFields(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => removeSensitiveFields(item));
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        // Skip sensitive fields
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          continue;
        }

        sanitized[key] = removeSensitiveFields(value);
      }

      return sanitized;
    }

    // Sanitize string values
    if (typeof obj === 'string') {
      return securityManager.sanitizeInput(obj);
    }

    return obj;
  }

  return removeSensitiveFields(data);
}

/**
 * Create response sanitization middleware
 */
export function createResponseSanitizationMiddleware() {
  return async function responseSanitizationMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Hook into response serialization
    const originalSend = reply.send.bind(reply);
    
    reply.send = function(payload: any) {
      if (payload && typeof payload === 'object') {
        const sanitizedPayload = sanitizeResponse(payload);
        return originalSend(sanitizedPayload);
      }
      return originalSend(payload);
    };
  };
}
