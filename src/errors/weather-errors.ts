/**
 * Custom error classes for Weather MCP Server
 * Provides better error discrimination and handling
 */

/**
 * Base error class for all weather service errors
 */
export class WeatherServiceError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly timestamp: Date;

  constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = 'WeatherServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date();

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when geocoding fails to find a city
 */
export class GeocodingError extends WeatherServiceError {
  public readonly city: string;

  constructor(message: string, city: string) {
    super(
      message || `Unable to find location: ${city}`,
      'GEOCODING_ERROR',
      404,
    );
    this.name = 'GeocodingError';
    this.city = city;
  }
}

/**
 * Error thrown when weather API request fails
 */
export class WeatherAPIError extends WeatherServiceError {
  public readonly endpoint?: string;
  public readonly originalError?: Error;

  constructor(message: string, endpoint?: string, originalError?: Error) {
    super(
      message || 'Weather API request failed',
      'WEATHER_API_ERROR',
      502,
    );
    this.name = 'WeatherAPIError';
    this.endpoint = endpoint;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends WeatherServiceError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(message: string, field?: string, value?: any) {
    super(
      message || 'Validation failed',
      'VALIDATION_ERROR',
      400,
    );
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends WeatherServiceError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(
      message || 'Rate limit exceeded',
      'RATE_LIMIT_ERROR',
      429,
    );
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerError extends WeatherServiceError {
  public readonly service: string;
  public readonly recoveryTime?: Date;

  constructor(service: string, recoveryTime?: Date) {
    super(
      `Circuit breaker open for service: ${service}`,
      'CIRCUIT_BREAKER_OPEN',
      503,
    );
    this.name = 'CircuitBreakerError';
    this.service = service;
    this.recoveryTime = recoveryTime;
  }
}

/**
 * Error thrown when cache operation fails
 */
export class CacheError extends WeatherServiceError {
  public readonly operation: 'get' | 'set' | 'delete' | 'clear';

  constructor(message: string, operation: 'get' | 'set' | 'delete' | 'clear') {
    super(
      message || `Cache ${operation} operation failed`,
      'CACHE_ERROR',
      500,
    );
    this.name = 'CacheError';
    this.operation = operation;
  }
}

/**
 * Error thrown when MCP protocol violation occurs
 */
export class MCPProtocolError extends WeatherServiceError {
  public readonly method?: string;
  public readonly expectedVersion?: string;
  public readonly receivedVersion?: string;

  constructor(
    message: string,
    method?: string,
    expectedVersion?: string,
    receivedVersion?: string,
  ) {
    super(
      message || 'MCP protocol violation',
      'MCP_PROTOCOL_ERROR',
      400,
    );
    this.name = 'MCPProtocolError';
    this.method = method;
    this.expectedVersion = expectedVersion;
    this.receivedVersion = receivedVersion;
  }
}

/**
 * Type guard to check if error is a WeatherServiceError
 */
export function isWeatherServiceError(error: unknown): error is WeatherServiceError {
  return error instanceof WeatherServiceError;
}

/**
 * Type guard to check if error has a statusCode
 */
export function hasStatusCode(error: unknown): error is { statusCode: number } {
  return typeof error === 'object' &&
         error !== null &&
         'statusCode' in error &&
         typeof (error as any).statusCode === 'number';
}

/**
 * Convert any error to a WeatherServiceError
 */
export function toWeatherServiceError(error: unknown): WeatherServiceError {
  if (isWeatherServiceError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new WeatherServiceError(
      error.message,
      'UNKNOWN_ERROR',
      500,
    );
  }

  return new WeatherServiceError(
    String(error),
    'UNKNOWN_ERROR',
    500,
  );
}

