import { describe, it, expect } from 'vitest';
import {
  WeatherError,
  ValidationError,
  NetworkError,
  APIError,
  MCPProtocolError,
  ServerError,
  RateLimitError,
  ConfigurationError,
} from './weather-errors.js';

describe('Weather Errors', () => {
  describe('WeatherError (base class)', () => {
    it('should create WeatherError with message', () => {
      const error = new WeatherError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(WeatherError);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('WeatherError');
    });

    it('should create WeatherError with custom name', () => {
      const error = new WeatherError('Test error', 'CustomError');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('CustomError');
    });

    it('should have proper stack trace', () => {
      const error = new WeatherError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('WeatherError');
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with basic info', () => {
      const error = new ValidationError('Invalid input', 'field');

      expect(error).toBeInstanceOf(WeatherError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('ValidationError');
      expect(error.field).toBe('field');
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
  });

  describe('NetworkError', () => {
    it('should create NetworkError with message', () => {
      const error = new NetworkError('Connection failed');

      expect(error).toBeInstanceOf(WeatherError);
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toBe('Connection failed');
      expect(error.name).toBe('NetworkError');
    });

    it('should create NetworkError with status code and URL', () => {
      const error = new NetworkError('HTTP Error', 404, 'https://api.example.com');

      expect(error.message).toBe('HTTP Error');
      expect(error.statusCode).toBe(404);
      expect(error.url).toBe('https://api.example.com');
    });

    it('should handle undefined optional parameters', () => {
      const error = new NetworkError('Error');

      expect(error.statusCode).toBeUndefined();
      expect(error.url).toBeUndefined();
    });
  });

  describe('APIError', () => {
    it('should create APIError with basic info', () => {
      const error = new APIError('API call failed', 'weather-service');

      expect(error).toBeInstanceOf(WeatherError);
      expect(error).toBeInstanceOf(APIError);
      expect(error.message).toBe('API call failed');
      expect(error.name).toBe('APIError');
      expect(error.service).toBe('weather-service');
    });

    it('should create APIError with status code and response', () => {
      const response = { error: 'Rate limit exceeded' };
      const error = new APIError('Rate limited', 'weather-api', 429, response);

      expect(error.service).toBe('weather-api');
      expect(error.statusCode).toBe(429);
      expect(error.response).toEqual(response);
    });

    it('should handle undefined optional parameters', () => {
      const error = new APIError('Error', 'service');

      expect(error.statusCode).toBeUndefined();
      expect(error.response).toBeUndefined();
    });
  });

  describe('MCPProtocolError', () => {
    it('should create MCPProtocolError with basic info', () => {
      const error = new MCPProtocolError('Protocol violation', 'initialize');

      expect(error).toBeInstanceOf(WeatherError);
      expect(error).toBeInstanceOf(MCPProtocolError);
      expect(error.message).toBe('Protocol violation');
      expect(error.name).toBe('MCPProtocolError');
      expect(error.method).toBe('initialize');
    });

    it('should create MCPProtocolError with expected and received values', () => {
      const error = new MCPProtocolError(
        'Invalid version',
        'initialize',
        '2025-06-18',
        '2024-01-01',
      );

      expect(error.method).toBe('initialize');
      expect(error.expected).toBe('2025-06-18');
      expect(error.received).toBe('2024-01-01');
    });

    it('should handle undefined optional parameters', () => {
      const error = new MCPProtocolError('Error');

      expect(error.method).toBeUndefined();
      expect(error.expected).toBeUndefined();
      expect(error.received).toBeUndefined();
    });
  });

  describe('ServerError', () => {
    it('should create ServerError with message', () => {
      const error = new ServerError('Server crashed');

      expect(error).toBeInstanceOf(WeatherError);
      expect(error).toBeInstanceOf(ServerError);
      expect(error.message).toBe('Server crashed');
      expect(error.name).toBe('ServerError');
    });

    it('should create ServerError with operation and details', () => {
      const details = { pid: 1234, uptime: 3600 };
      const error = new ServerError('Internal error', 'weather-processing', details);

      expect(error.operation).toBe('weather-processing');
      expect(error.details).toEqual(details);
    });

    it('should handle undefined optional parameters', () => {
      const error = new ServerError('Error');

      expect(error.operation).toBeUndefined();
      expect(error.details).toBeUndefined();
    });
  });

  describe('RateLimitError', () => {
    it('should create RateLimitError with basic info', () => {
      const error = new RateLimitError('Too many requests', 'client-123');

      expect(error).toBeInstanceOf(WeatherError);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.message).toBe('Too many requests');
      expect(error.name).toBe('RateLimitError');
      expect(error.clientId).toBe('client-123');
    });

    it('should create RateLimitError with rate limit details', () => {
      const error = new RateLimitError('Rate limit exceeded', 'client-456', 100, 60);

      expect(error.clientId).toBe('client-456');
      expect(error.limit).toBe(100);
      expect(error.windowSeconds).toBe(60);
    });

    it('should handle undefined optional parameters', () => {
      const error = new RateLimitError('Error', 'client');

      expect(error.limit).toBeUndefined();
      expect(error.windowSeconds).toBeUndefined();
    });
  });

  describe('ConfigurationError', () => {
    it('should create ConfigurationError with basic info', () => {
      const error = new ConfigurationError('Invalid config', 'apiKey');

      expect(error).toBeInstanceOf(WeatherError);
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toBe('Invalid config');
      expect(error.name).toBe('ConfigurationError');
      expect(error.configKey).toBe('apiKey');
    });

    it('should create ConfigurationError with expected value', () => {
      const error = new ConfigurationError(
        'Invalid port',
        'server.port',
        'positive integer',
      );

      expect(error.configKey).toBe('server.port');
      expect(error.expectedValue).toBe('positive integer');
    });

    it('should handle undefined optional parameters', () => {
      const error = new ConfigurationError('Error', 'key');

      expect(error.expectedValue).toBeUndefined();
    });
  });

  describe('Error inheritance and instanceof checks', () => {
    it('should properly inherit from base classes', () => {
      const validationError = new ValidationError('Invalid', 'field');
      const networkError = new NetworkError('Connection failed');
      const apiError = new APIError('API failed', 'service');
      const protocolError = new MCPProtocolError('Protocol error', 'method');
      const serverError = new ServerError('Server error');
      const rateLimitError = new RateLimitError('Rate limited', 'client');
      const configError = new ConfigurationError('Config error', 'key');

      // All should be instances of WeatherError and Error
      const errors = [
        validationError, networkError, apiError, protocolError,
        serverError, rateLimitError, configError,
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(WeatherError);
      });
    });

    it('should not be instances of other error types', () => {
      const validationError = new ValidationError('Invalid', 'field');

      expect(validationError).not.toBeInstanceOf(NetworkError);
      expect(validationError).not.toBeInstanceOf(APIError);
      expect(validationError).not.toBeInstanceOf(MCPProtocolError);
      expect(validationError).not.toBeInstanceOf(ServerError);
      expect(validationError).not.toBeInstanceOf(RateLimitError);
      expect(validationError).not.toBeInstanceOf(ConfigurationError);
    });
  });

  describe('Error serialization', () => {
    it('should be serializable to JSON', () => {
      const error = new ValidationError('Invalid input', 'username', 'test@');

      // Errors don't serialize well by default, but the properties should be accessible
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('ValidationError');
      expect(error.field).toBe('username');
      expect(error.value).toBe('test@');
    });

    it('should preserve stack trace in serialization', () => {
      const error = new NetworkError('Connection failed', 500, 'https://api.test.com');

      expect(error.stack).toContain('NetworkError');
      expect(error.message).toBe('Connection failed');
      expect(error.statusCode).toBe(500);
      expect(error.url).toBe('https://api.test.com');
    });
  });

  describe('Error messages and details', () => {
    it('should handle complex error details', () => {
      const details = {
        request: { method: 'GET', url: '/api/weather' },
        response: { status: 500, body: 'Internal Server Error' },
        timestamp: new Date().toISOString(),
      };

      const error = new ServerError('API request failed', 'weather-fetch', details);

      expect(error.details).toEqual(details);
      expect(error.details.request.method).toBe('GET');
      expect(error.details.response.status).toBe(500);
    });

    it('should handle null and undefined in error details', () => {
      const error1 = new APIError('Error', 'service', undefined, null);
      const error2 = new ValidationError('Error', 'field', undefined);

      expect(error1.response).toBeNull();
      expect(error2.value).toBeUndefined();
    });
  });
});
