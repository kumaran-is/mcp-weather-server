import { describe, it, expect } from 'vitest';
import {
  WeatherServiceError,
  GeocodingError,
  WeatherAPIError,
  ValidationError,
  RateLimitError,
  CircuitBreakerError,
  CacheError,
  MCPProtocolError,
  isWeatherServiceError,
  hasStatusCode,
  toWeatherServiceError,
} from './weather-errors';

describe('Weather Errors', () => {
  describe('WeatherServiceError (base class)', () => {
    it('should create WeatherServiceError with message and code', () => {
      const error = new WeatherServiceError('Test error', 'TEST_ERROR');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(WeatherServiceError);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('WeatherServiceError');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBeUndefined();
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should create WeatherServiceError with status code', () => {
      const error = new WeatherServiceError('Test error', 'TEST_ERROR', 500);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(500);
    });

    it('should have proper stack trace', () => {
      const error = new WeatherServiceError('Test error', 'TEST_ERROR');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('WeatherServiceError');
    });

    it('should serialize to JSON', () => {
      const error = new WeatherServiceError('Test error', 'TEST_ERROR', 500);
      const json = error.toJSON();

      expect(json.name).toBe('WeatherServiceError');
      expect(json.message).toBe('Test error');
      expect(json.code).toBe('TEST_ERROR');
      expect(json.statusCode).toBe(500);
      expect(json.timestamp).toEqual(error.timestamp);
      expect(json.stack).toBe(error.stack);
    });
  });

  describe('GeocodingError', () => {
    it('should create GeocodingError with city', () => {
      const error = new GeocodingError('City not found', 'London');

      expect(error).toBeInstanceOf(WeatherServiceError);
      expect(error).toBeInstanceOf(GeocodingError);
      expect(error.message).toBe('City not found');
      expect(error.name).toBe('GeocodingError');
      expect(error.code).toBe('GEOCODING_ERROR');
      expect(error.statusCode).toBe(404);
      expect(error.city).toBe('London');
    });

    it('should use default message if not provided', () => {
      const error = new GeocodingError('', 'Paris');

      expect(error.message).toBe('Unable to find location: Paris');
    });
  });

  describe('WeatherAPIError', () => {
    it('should create WeatherAPIError with message', () => {
      const error = new WeatherAPIError('API request failed');

      expect(error).toBeInstanceOf(WeatherServiceError);
      expect(error).toBeInstanceOf(WeatherAPIError);
      expect(error.message).toBe('API request failed');
      expect(error.name).toBe('WeatherAPIError');
      expect(error.code).toBe('WEATHER_API_ERROR');
      expect(error.statusCode).toBe(502);
    });

    it('should create WeatherAPIError with endpoint and original error', () => {
      const originalError = new Error('Network timeout');
      const error = new WeatherAPIError('Request failed', '/weather', originalError);

      expect(error.endpoint).toBe('/weather');
      expect(error.originalError).toBe(originalError);
    });

    it('should use default message if not provided', () => {
      const error = new WeatherAPIError('');

      expect(error.message).toBe('Weather API request failed');
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with basic info', () => {
      const error = new ValidationError('Invalid input');

      expect(error).toBeInstanceOf(WeatherServiceError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.field).toBeUndefined();
      expect(error.value).toBeUndefined();
    });

    it('should create ValidationError with field and value', () => {
      const error = new ValidationError('Invalid value', 'username', 'test@');

      expect(error.message).toBe('Invalid value');
      expect(error.field).toBe('username');
      expect(error.value).toBe('test@');
    });

    it('should handle null and undefined values', () => {
      const error1 = new ValidationError('Null value', 'field', null);
      const error2 = new ValidationError('Undefined value', 'field', undefined);

      expect(error1.value).toBeNull();
      expect(error2.value).toBeUndefined();
    });

    it('should use default message if not provided', () => {
      const error = new ValidationError('');

      expect(error.message).toBe('Validation failed');
    });
  });

  describe('RateLimitError', () => {
    it('should create RateLimitError with basic info', () => {
      const error = new RateLimitError('Too many requests');

      expect(error).toBeInstanceOf(WeatherServiceError);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toBe('Too many requests');
      expect(error.name).toBe('RateLimitError');
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.statusCode).toBe(429);
    });

    it('should create RateLimitError with retry after', () => {
      const error = new RateLimitError('Rate limit exceeded', 60);

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.retryAfter).toBe(60);
    });

    it('should use default message if not provided', () => {
      const error = new RateLimitError('');

      expect(error.message).toBe('Rate limit exceeded');
    });
  });

  describe('CircuitBreakerError', () => {
    it('should create CircuitBreakerError with service', () => {
      const error = new CircuitBreakerError('weather-api');

      expect(error).toBeInstanceOf(WeatherServiceError);
      expect(error).toBeInstanceOf(CircuitBreakerError);
      expect(error.message).toBe('Circuit breaker open for service: weather-api');
      expect(error.name).toBe('CircuitBreakerError');
      expect(error.code).toBe('CIRCUIT_BREAKER_OPEN');
      expect(error.statusCode).toBe(503);
      expect(error.service).toBe('weather-api');
    });

    it('should create CircuitBreakerError with recovery time', () => {
      const recoveryTime = new Date('2025-01-01T00:00:00Z');
      const error = new CircuitBreakerError('api-service', recoveryTime);

      expect(error.service).toBe('api-service');
      expect(error.recoveryTime).toEqual(recoveryTime);
    });
  });

  describe('CacheError', () => {
    it('should create CacheError with message and operation', () => {
      const error = new CacheError('Cache operation failed', 'get');

      expect(error).toBeInstanceOf(WeatherServiceError);
      expect(error).toBeInstanceOf(CacheError);
      expect(error.message).toBe('Cache operation failed');
      expect(error.name).toBe('CacheError');
      expect(error.code).toBe('CACHE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.operation).toBe('get');
    });

    it('should use default message if not provided', () => {
      const error = new CacheError('', 'set');

      expect(error.message).toBe('Cache set operation failed');
    });

    it('should handle all operation types', () => {
      const operations: Array<'get' | 'set' | 'delete' | 'clear'> = ['get', 'set', 'delete', 'clear'];

      operations.forEach(op => {
        const error = new CacheError('', op);
        expect(error.operation).toBe(op);
        expect(error.message).toBe(`Cache ${op} operation failed`);
      });
    });
  });

  describe('MCPProtocolError', () => {
    it('should create MCPProtocolError with basic info', () => {
      const error = new MCPProtocolError('Protocol violation');

      expect(error).toBeInstanceOf(WeatherServiceError);
      expect(error).toBeInstanceOf(MCPProtocolError);
      expect(error.message).toBe('Protocol violation');
      expect(error.name).toBe('MCPProtocolError');
      expect(error.code).toBe('MCP_PROTOCOL_ERROR');
      expect(error.statusCode).toBe(400);
    });

    it('should create MCPProtocolError with method and versions', () => {
      const error = new MCPProtocolError(
        'Invalid version',
        'initialize',
        '2025-06-18',
        '2024-01-01',
      );

      expect(error.method).toBe('initialize');
      expect(error.expectedVersion).toBe('2025-06-18');
      expect(error.receivedVersion).toBe('2024-01-01');
    });

    it('should use default message if not provided', () => {
      const error = new MCPProtocolError('');

      expect(error.message).toBe('MCP protocol violation');
    });
  });

  describe('Type guards', () => {
    it('should identify WeatherServiceError correctly', () => {
      const weatherError = new WeatherServiceError('Test', 'TEST');
      const normalError = new Error('Normal error');
      const string = 'not an error';

      expect(isWeatherServiceError(weatherError)).toBe(true);
      expect(isWeatherServiceError(normalError)).toBe(false);
      expect(isWeatherServiceError(string)).toBe(false);
      expect(isWeatherServiceError(null)).toBe(false);
      expect(isWeatherServiceError(undefined)).toBe(false);
    });

    it('should check for statusCode correctly', () => {
      const errorWithCode = new WeatherServiceError('Test', 'TEST', 404);
      const errorWithoutCode = new WeatherServiceError('Test', 'TEST');
      const objectWithCode = { statusCode: 200 };
      const objectWithoutCode = { message: 'error' };

      expect(hasStatusCode(errorWithCode)).toBe(true);
      expect(hasStatusCode(errorWithoutCode)).toBe(false);
      expect(hasStatusCode(objectWithCode)).toBe(true);
      expect(hasStatusCode(objectWithoutCode)).toBe(false);
      expect(hasStatusCode(null)).toBe(false);
      expect(hasStatusCode('string')).toBe(false);
    });
  });

  describe('Error conversion', () => {
    it('should return WeatherServiceError as-is', () => {
      const originalError = new WeatherServiceError('Test', 'TEST');
      const result = toWeatherServiceError(originalError);

      expect(result).toBe(originalError);
    });

    it('should convert Error to WeatherServiceError', () => {
      const normalError = new Error('Normal error');
      const result = toWeatherServiceError(normalError);

      expect(result).toBeInstanceOf(WeatherServiceError);
      expect(result.message).toBe('Normal error');
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.statusCode).toBe(500);
    });

    it('should convert string to WeatherServiceError', () => {
      const result = toWeatherServiceError('String error');

      expect(result).toBeInstanceOf(WeatherServiceError);
      expect(result.message).toBe('String error');
      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.statusCode).toBe(500);
    });

    it('should convert other types to WeatherServiceError', () => {
      const result1 = toWeatherServiceError(123);
      const result2 = toWeatherServiceError({ error: 'object' });
      const result3 = toWeatherServiceError(null);

      expect(result1.message).toBe('123');
      expect(result2.message).toBe('[object Object]');
      expect(result3.message).toBe('null');
    });
  });

  describe('Error inheritance and instanceof checks', () => {
    it('should properly inherit from base classes', () => {
      const errors = [
        new GeocodingError('', 'city'),
        new WeatherAPIError(''),
        new ValidationError(''),
        new RateLimitError(''),
        new CircuitBreakerError('service'),
        new CacheError('', 'get'),
        new MCPProtocolError(''),
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(WeatherServiceError);
      });
    });

    it('should not be instances of other error types', () => {
      const validationError = new ValidationError('Invalid');

      expect(validationError).not.toBeInstanceOf(GeocodingError);
      expect(validationError).not.toBeInstanceOf(WeatherAPIError);
      expect(validationError).not.toBeInstanceOf(RateLimitError);
      expect(validationError).not.toBeInstanceOf(CircuitBreakerError);
      expect(validationError).not.toBeInstanceOf(CacheError);
      expect(validationError).not.toBeInstanceOf(MCPProtocolError);
    });
  });

  describe('Error serialization', () => {
    it('should be serializable to JSON', () => {
      const error = new ValidationError('Invalid input', 'username', 'test@');
      const json = error.toJSON();

      expect(json.name).toBe('ValidationError');
      expect(json.message).toBe('Invalid input');
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(json.statusCode).toBe(400);
      expect(json.timestamp).toEqual(error.timestamp);
    });

    it('should preserve all properties in serialization', () => {
      const originalError = new Error('Network error');
      const error = new WeatherAPIError('API failed', '/endpoint', originalError);
      const json = error.toJSON();

      expect(json.name).toBe('WeatherAPIError');
      expect(json.message).toBe('API failed');
      expect(json.code).toBe('WEATHER_API_ERROR');
      expect(json.statusCode).toBe(502);
      expect(json.stack).toBeDefined();
    });
  });

  describe('Timestamp handling', () => {
    it('should set timestamp on error creation', () => {
      const before = new Date();
      const error = new WeatherServiceError('Test', 'TEST');
      const after = new Date();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
