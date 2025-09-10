/**
 * Request validation middleware for MCP protocol compliance
 * Ensures all incoming requests meet the JSON-RPC 2.0 and MCP specifications
 */

import { logger } from '../logger-pino.js';
import { ValidationError, MCPProtocolError } from '../errors/weather-errors.js';

/**
 * JSON-RPC 2.0 request structure
 */
export interface JSONRPCRequest {
  jsonrpc: string;
  method: string;
  params?: any;
  id?: string | number | null;
}

/**
 * MCP request validation rules
 */
export interface ValidationRule {
  field: string;
  required: boolean;
  type?: string;
  validator?: (value: any) => boolean;
  message?: string;
}

/**
 * Validation context for detailed error reporting
 */
export interface ValidationContext {
  transport: 'stdio' | 'http' | 'sse';
  clientId?: string;
  requestId?: string | number;
}

/**
 * Validate JSON-RPC 2.0 protocol compliance
 */
export function validateJSONRPC(request: any, context?: ValidationContext): void {
  // Check if request is an object
  if (!request || typeof request !== 'object') {
    throw new MCPProtocolError(
      'Request must be a JSON object',
      request?.method,
    );
  }

  // Validate jsonrpc version
  if (request.jsonrpc !== '2.0') {
    throw new MCPProtocolError(
      'Invalid JSON-RPC version',
      request.method,
      '2.0',
      request.jsonrpc,
    );
  }

  // Validate method
  if (!request.method || typeof request.method !== 'string') {
    throw new ValidationError(
      'Method must be a non-empty string',
      'method',
      request.method,
    );
  }

  // Validate id if present
  if ('id' in request) {
    const validIdType = ['string', 'number'].includes(typeof request.id) || request.id === null;
    if (!validIdType) {
      throw new ValidationError(
        'ID must be a string, number, or null',
        'id',
        request.id,
      );
    }
  }

  logger.debug('JSON-RPC validation passed', {
    method: request.method,
    id: request.id,
    hasParams: 'params' in request,
    ...context,
  });
}

/**
 * Validate MCP initialize request
 */
export function validateInitializeRequest(params: any): void {
  if (!params) {
    throw new ValidationError('Initialize params are required', 'params');
  }

  if (!params.protocolVersion) {
    throw new ValidationError('Protocol version is required', 'protocolVersion');
  }

  if (!params.capabilities) {
    throw new ValidationError('Capabilities are required', 'capabilities');
  }

  if (!params.clientInfo) {
    throw new ValidationError('Client info is required', 'clientInfo');
  }

  if (!params.clientInfo.name || !params.clientInfo.version) {
    throw new ValidationError(
      'Client info must include name and version',
      'clientInfo',
      params.clientInfo,
    );
  }

  logger.debug('Initialize request validated', {
    protocolVersion: params.protocolVersion,
    clientName: params.clientInfo.name,
    clientVersion: params.clientInfo.version,
  });
}

/**
 * Validate MCP tool call request
 */
export function validateToolCallRequest(params: any): void {
  if (!params) {
    throw new ValidationError('Tool call params are required', 'params');
  }

  if (!params.name || typeof params.name !== 'string') {
    throw new ValidationError(
      'Tool name must be a non-empty string',
      'name',
      params.name,
    );
  }

  // Tool-specific validation
  switch (params.name) {
    case 'get_current_weather':
      validateWeatherToolParams(params.arguments);
      break;
    case 'get_forecast':
      validateForecastToolParams(params.arguments);
      break;
    case 'analyze_weather_query':
      validateAnalyzeQueryParams(params.arguments);
      break;
    default:
      throw new ValidationError(
        `Unknown tool: ${params.name}`,
        'name',
        params.name,
      );
  }

  logger.debug('Tool call request validated', {
    tool: params.name,
    hasArguments: !!params.arguments,
  });
}

/**
 * Validate weather tool parameters
 */
function validateWeatherToolParams(args: any): void {
  if (!args || typeof args !== 'object') {
    throw new ValidationError('Weather tool arguments must be an object', 'arguments');
  }

  if (!args.city || typeof args.city !== 'string') {
    throw new ValidationError(
      'City must be a non-empty string',
      'city',
      args.city,
    );
  }

  if (args.city.trim().length === 0) {
    throw new ValidationError(
      'City cannot be empty or whitespace',
      'city',
      args.city,
    );
  }

  if (args.city.length > 100) {
    throw new ValidationError(
      'City name is too long (max 100 characters)',
      'city',
      args.city,
    );
  }
}

/**
 * Validate forecast tool parameters
 */
function validateForecastToolParams(args: any): void {
  // First validate city parameter
  validateWeatherToolParams(args);

  // Validate days parameter if present
  if ('days' in args) {
    const days = args.days;
    
    if (typeof days !== 'number') {
      throw new ValidationError(
        'Days must be a number',
        'days',
        days,
      );
    }

    if (!Number.isInteger(days)) {
      throw new ValidationError(
        'Days must be an integer',
        'days',
        days,
      );
    }

    if (days < 1 || days > 7) {
      throw new ValidationError(
        'Days must be between 1 and 7',
        'days',
        days,
      );
    }
  }
}

/**
 * Validate analyze query parameters
 */
function validateAnalyzeQueryParams(args: any): void {
  if (!args || typeof args !== 'object') {
    throw new ValidationError('Analyze query arguments must be an object', 'arguments');
  }

  if (!args.query || typeof args.query !== 'string') {
    throw new ValidationError(
      'Query must be a non-empty string',
      'query',
      args.query,
    );
  }

  if (args.query.trim().length === 0) {
    throw new ValidationError(
      'Query cannot be empty or whitespace',
      'query',
      args.query,
    );
  }

  if (args.query.length > 1000) {
    throw new ValidationError(
      'Query is too long (max 1000 characters)',
      'query',
      args.query.substring(0, 50) + '...',
    );
  }
}

/**
 * Validate HTTP transport headers
 */
export function validateHTTPHeaders(headers: any): void {
  if (!headers['content-type']?.includes('application/json')) {
    throw new ValidationError(
      'Content-Type must be application/json',
      'content-type',
      headers['content-type'],
    );
  }
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  // Remove control characters
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000);
  }
  
  return sanitized;
}

/**
 * Validation middleware factory for different transports
 */
export function createValidationMiddleware(transport: 'stdio' | 'http' | 'sse') {
  return async function validateRequest(request: any, context?: any): Promise<void> {
    const validationContext: ValidationContext = {
      transport,
      clientId: context?.clientId,
      requestId: request?.id,
    };

    try {
      // Validate JSON-RPC structure
      validateJSONRPC(request, validationContext);

      // Method-specific validation
      switch (request.method) {
        case 'initialize':
          validateInitializeRequest(request.params);
          break;
        case 'tools/call':
          validateToolCallRequest(request.params);
          break;
        case 'tools/list':
          // No additional validation needed
          break;
        case 'notifications/initialized':
          // Notification, no validation needed
          break;
        case 'shutdown':
          // No additional validation needed
          break;
        default:
          // Unknown methods are allowed per MCP spec, just log
          logger.warn('Unknown method received', {
            method: request.method,
            ...validationContext,
          });
      }

      logger.debug('Request validation passed', {
        method: request.method,
        ...validationContext,
      });
    } catch (error) {
      logger.error('Request validation failed', {
        error: (error as Error).message,
        method: request?.method,
        ...validationContext,
      });
      throw error;
    }
  };
}

/**
 * Rate limiting validator
 */
export class RateLimitValidator {
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if request should be rate limited
   */
  shouldRateLimit(clientId: string): boolean {
    const now = Date.now();
    const clientData = this.requestCounts.get(clientId);

    if (!clientData || now > clientData.resetTime) {
      // New window
      this.requestCounts.set(clientId, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return false;
    }

    clientData.count++;
    
    if (clientData.count > this.maxRequests) {
      logger.warn('Rate limit exceeded', {
        clientId,
        count: clientData.count,
        maxRequests: this.maxRequests,
      });
      return true;
    }

    return false;
  }

  /**
   * Clean up old entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [clientId, data] of this.requestCounts.entries()) {
      if (now > data.resetTime) {
        this.requestCounts.delete(clientId);
      }
    }
  }
}

// Export singleton rate limiter
export const rateLimiter = new RateLimitValidator();

// Cleanup interval
setInterval(() => rateLimiter.cleanup(), 60000);