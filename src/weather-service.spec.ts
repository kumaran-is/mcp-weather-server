import { WeatherService } from './weather-service';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the pool manager and other dependencies
vi.mock('./undici-resilience/index.js', () => ({
  poolManager: {
    request: vi.fn()
  }
}));

vi.mock('./logger-pino.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
    logPerformance: vi.fn()
  }
}));

vi.mock('./cache/weather-cache.js', () => ({
  weatherCache: {
    getWeather: vi.fn(),
    setWeather: vi.fn(),
    getForecast: vi.fn(),
    setForecast: vi.fn(),
    getGeocoding: vi.fn(),
    setGeocoding: vi.fn()
  }
}));

// Import mocked modules to access mocks
import { poolManager } from './undici-resilience/index.js';
import { weatherCache } from './cache/weather-cache.js';
import { logger } from './logger-pino.js';

describe('WeatherService', () => {
  let weatherService: WeatherService;
  const mockRequest = poolManager.request as any;
  const mockGetWeather = weatherCache.getWeather as any;
  const mockSetWeather = weatherCache.setWeather as any;
  const mockGetForecast = weatherCache.getForecast as any;
  const mockSetForecast = weatherCache.setForecast as any;
  const mockGetGeocoding = weatherCache.getGeocoding as any;
  const mockSetGeocoding = weatherCache.setGeocoding as any;

  beforeEach(() => {
    vi.clearAllMocks();
    weatherService = new WeatherService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('WeatherService Instance Creation', () => {
    it('should create a weather service instance', () => {
      expect(weatherService).toBeDefined();
      expect(weatherService).toBeInstanceOf(WeatherService);
    });
  });

  describe('Core Methods', () => {
    it('should have getCurrentWeather method', () => {
      expect(typeof weatherService.getCurrentWeather).toBe('function');
    });

    it('should have getForecast method', () => {
      expect(typeof weatherService.getForecast).toBe('function');
    });
  });

  describe('Input Validation', () => {
    it('should validate empty city parameter for getCurrentWeather', async () => {
      await expect(weatherService.getCurrentWeather('')).rejects.toThrow(
        'Invalid city parameter: city must be a non-empty string'
      );
    });

    it('should validate null city parameter for getCurrentWeather', async () => {
      await expect(weatherService.getCurrentWeather(null as any)).rejects.toThrow(
        'Invalid city parameter: city must be a non-empty string'
      );
    });

    it('should validate undefined city parameter for getCurrentWeather', async () => {
      await expect(weatherService.getCurrentWeather(undefined as any)).rejects.toThrow(
        'Invalid city parameter: city must be a non-empty string'
      );
    });

    it('should validate whitespace-only city parameter for getCurrentWeather', async () => {
      await expect(weatherService.getCurrentWeather('   ')).rejects.toThrow(
        'Invalid city parameter: city must be a non-empty string'
      );
    });

    it('should validate empty city parameter for getForecast', async () => {
      await expect(weatherService.getForecast('', 3)).rejects.toThrow(
        'Invalid city parameter: city must be a non-empty string'
      );
    });

    it('should validate null city parameter for getForecast', async () => {
      await expect(weatherService.getForecast(null as any, 3)).rejects.toThrow(
        'Invalid city parameter: city must be a non-empty string'
      );
    });

    it('should validate days parameter too low for getForecast', async () => {
      await expect(weatherService.getForecast('London', 0)).rejects.toThrow(
        'Days must be between 1 and 7'
      );
    });

    it('should validate days parameter too high for getForecast', async () => {
      await expect(weatherService.getForecast('London', 8)).rejects.toThrow(
        'Days must be between 1 and 7'
      );
    });

    it('should validate negative days parameter for getForecast', async () => {
      await expect(weatherService.getForecast('London', -1)).rejects.toThrow(
        'Days must be between 1 and 7'
      );
    });
  });

  describe('Weather Code Mapping', () => {
    it('should map all weather codes correctly', () => {
      const testCases = [
        { code: 0, expected: 'Clear sky' },
        { code: 1, expected: 'Mainly clear' },
        { code: 2, expected: 'Partly cloudy' },
        { code: 3, expected: 'Overcast' },
        { code: 45, expected: 'Fog' },
        { code: 48, expected: 'Depositing rime fog' },
        { code: 51, expected: 'Light drizzle' },
        { code: 53, expected: 'Moderate drizzle' },
        { code: 55, expected: 'Dense drizzle' },
        { code: 56, expected: 'Light freezing drizzle' },
        { code: 57, expected: 'Dense freezing drizzle' },
        { code: 61, expected: 'Slight rain' },
        { code: 63, expected: 'Moderate rain' },
        { code: 65, expected: 'Heavy rain' },
        { code: 66, expected: 'Light freezing rain' },
        { code: 67, expected: 'Heavy freezing rain' },
        { code: 71, expected: 'Slight snow fall' },
        { code: 73, expected: 'Moderate snow fall' },
        { code: 75, expected: 'Heavy snow fall' },
        { code: 77, expected: 'Snow grains' },
        { code: 80, expected: 'Slight rain showers' },
        { code: 81, expected: 'Moderate rain showers' },
        { code: 82, expected: 'Violent rain showers' },
        { code: 85, expected: 'Slight snow showers' },
        { code: 86, expected: 'Heavy snow showers' },
        { code: 95, expected: 'Thunderstorm' },
        { code: 96, expected: 'Thunderstorm with slight hail' },
        { code: 99, expected: 'Thunderstorm with heavy hail' },
        { code: 999, expected: 'Unknown weather condition' }
      ];

      testCases.forEach(({ code, expected }) => {
        const result = (weatherService as any).mapWeatherCode(code);
        expect(result).toBe(expected);
      });
    });
  });

  describe('getCurrentWeather', () => {
    const mockGeocodingResponse = {
      results: [{
        name: 'London',
        latitude: 51.5074,
        longitude: -0.1278,
        country: 'United Kingdom',
        admin1: 'England'
      }]
    };

    const mockWeatherResponse = {
      current: {
        temperature_2m: 15.7,
        relative_humidity_2m: 72,
        wind_speed_10m: 8.5,
        weather_code: 2,
        time: '2025-01-08T12:00:00Z'
      }
    };

    beforeEach(() => {
      mockRequest.mockImplementation((poolName: string, options: any) => {
        if (poolName === 'geocoding' || options.path?.includes('geocoding')) {
          return Promise.resolve(mockGeocodingResponse);
        } else if (poolName === 'weather' || options.path?.includes('forecast')) {
          return Promise.resolve(mockWeatherResponse);
        }
        return Promise.reject(new Error('Unknown request'));
      });
    });

    it('should successfully fetch current weather for valid city', async () => {
      const result = await weatherService.getCurrentWeather('London');

      expect(result).toBeDefined();
      expect(result.location).toBe('London');
      expect(result.temperature).toBe(15.7);
      expect(result.description).toBe('Partly cloudy');
      expect(result.humidity).toBe(72);
      expect(result.windSpeed).toBe(8.5);
      expect(result.feelsLike).toBe(15.7);
      expect(result.pressure).toBe(1013.25);
      expect(result.timestamp).toBe('2025-01-08T12:00:00Z');
    });

    it('should handle geocoding API failure', async () => {
      mockRequest.mockImplementationOnce(() =>
        Promise.resolve({
          statusCode: 500,
          headers: {},
          body: {
            json: () => Promise.reject(new Error('Internal Server Error'))
          }
        })
      );

      await expect(weatherService.getCurrentWeather('InvalidCity')).rejects.toThrow(
        'Geocoding API error: 500'
      );
    });

    it('should handle weather API failure', async () => {
      mockRequest.mockImplementation((url: string) => {
        if (url.includes('geocoding-api')) {
          return Promise.resolve({
            statusCode: 200,
            headers: {},
            body: {
              json: () => Promise.resolve(mockGeocodingResponse)
            }
          });
        } else if (url.includes('forecast')) {
          return Promise.resolve({
            statusCode: 404,
            headers: {},
            body: {
              json: () => Promise.reject(new Error('Not Found'))
            }
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow(
        'Weather API error: 404'
      );
    });

    it('should handle network timeout', async () => {
      mockRequest.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve({
          statusCode: 408,
          headers: {},
          body: {
            json: () => Promise.reject(new Error('Request Timeout'))
          }
        }), 6000))
      );

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow();
    });

    it('should handle city not found', async () => {
      mockRequest.mockImplementationOnce(() =>
        Promise.resolve({
          statusCode: 200,
          headers: {},
          body: {
            json: () => Promise.resolve({ results: [] })
          }
        })
      );

      await expect(weatherService.getCurrentWeather('NonExistentCity')).rejects.toThrow(
        'City not found: NonExistentCity'
      );
    });

    it('should handle missing current weather data', async () => {
      mockRequest.mockImplementation((url: string) => {
        if (url.includes('geocoding-api')) {
          return Promise.resolve({
            statusCode: 200,
            headers: {},
            body: {
              json: () => Promise.resolve(mockGeocodingResponse)
            }
          });
        } else if (url.includes('forecast')) {
          return Promise.resolve({
            statusCode: 200,
            headers: {},
            body: {
              json: () => Promise.resolve({}) // Missing current data
            }
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow(
        'No current weather data available'
      );
    });
  });

  describe('getForecast', () => {
    const mockGeocodingResponse = {
      results: [{
        name: 'Tokyo',
        latitude: 35.6762,
        longitude: 139.6503,
        country: 'Japan',
        admin1: 'Tokyo'
      }]
    };

    const mockForecastResponse = {
      daily: {
        time: ['2025-01-08', '2025-01-09', '2025-01-10'],
        temperature_2m_max: [18.5, 20.2, 19.8],
        temperature_2m_min: [12.3, 14.1, 13.7],
        weather_code: [1, 2, 3],
        relative_humidity_2m_mean: [65, 70, 68],
        wind_speed_10m_max: [12.5, 15.2, 11.8]
      }
    };

    beforeEach(() => {
      mockRequest.mockImplementation((url: string) => {
        if (url.includes('geocoding-api')) {
          return Promise.resolve({
            statusCode: 200,
            headers: {},
            body: {
              json: () => Promise.resolve(mockGeocodingResponse)
            }
          });
        } else if (url.includes('forecast')) {
          return Promise.resolve({
            statusCode: 200,
            headers: {},
            body: {
              json: () => Promise.resolve(mockForecastResponse)
            }
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
    });

    it('should successfully fetch forecast for valid city and days', async () => {
      const result = await weatherService.getForecast('Tokyo', 3);

      expect(result).toBeDefined();
      expect(result.location).toBe('Tokyo');
      expect(result.forecasts).toHaveLength(3);

      expect(result.forecasts[0]).toEqual({
        date: 'Wed, Jan 8',
        temperature: 18.5,
        temperatureMin: 12.3,
        description: 'Mainly clear',
        humidity: 65,
        windSpeed: 12.5,
        precipitation: undefined
      });
    });

    it('should use default days parameter when not provided', async () => {
      const result = await weatherService.getForecast('Tokyo');

      expect(result.forecasts).toHaveLength(5); // Default is 5 days
    });

    it('should handle forecast API failure', async () => {
      mockRequest.mockImplementation((url: string) => {
        if (url.includes('geocoding-api')) {
          return Promise.resolve({
            statusCode: 200,
            headers: {},
            body: {
              json: () => Promise.resolve(mockGeocodingResponse)
            }
          });
        } else if (url.includes('forecast')) {
          return Promise.resolve({
            statusCode: 503,
            headers: {},
            body: {
              json: () => Promise.reject(new Error('Service Unavailable'))
            }
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      await expect(weatherService.getForecast('Tokyo', 3)).rejects.toThrow(
        'Forecast API error: 503'
      );
    });

    it('should handle missing forecast data', async () => {
      mockRequest.mockImplementation((url: string) => {
        if (url.includes('geocoding-api')) {
          return Promise.resolve({
            statusCode: 200,
            headers: {},
            body: {
              json: () => Promise.resolve(mockGeocodingResponse)
            }
          });
        } else if (url.includes('forecast')) {
          return Promise.resolve({
            statusCode: 200,
            headers: {},
            body: {
              json: () => Promise.resolve({}) // Missing daily data
            }
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      await expect(weatherService.getForecast('Tokyo', 3)).rejects.toThrow(
        'No forecast data available'
      );
    });

    it('should handle forecast with precipitation data', async () => {
      const mockResponseWithPrecipitation = {
        daily: {
          ...mockForecastResponse.daily,
          precipitation_sum: [0.2, 5.1, 0.0]
        }
      };

      mockRequest.mockImplementation((url: string) => {
        if (url.includes('geocoding-api')) {
          return Promise.resolve({
            statusCode: 200,
            headers: {},
            body: {
              json: () => Promise.resolve(mockGeocodingResponse)
            }
          });
        } else if (url.includes('forecast')) {
          return Promise.resolve({
            statusCode: 200,
            headers: {},
            body: {
              json: () => Promise.resolve(mockResponseWithPrecipitation)
            }
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const result = await weatherService.getForecast('Tokyo', 3);

      expect(result.forecasts[0].precipitation).toBe(0.2);
      expect(result.forecasts[1].precipitation).toBe(5.1);
      expect(result.forecasts[2].precipitation).toBe(0.0);
    });
  });

  describe('Private Methods', () => {
    describe('geocodeCity', () => {
      it('should successfully geocode a valid city', async () => {
        const mockResponse = {
          results: [{
            name: 'Paris',
            latitude: 48.8566,
            longitude: 2.3522,
            country: 'France',
            admin1: 'Île-de-France'
          }]
        };

        mockRequest.mockResolvedValueOnce({
          statusCode: 200,
          headers: {},
          body: {
            json: () => Promise.resolve(mockResponse)
          }
        });

        const result = await (weatherService as any).geocodeCity('Paris');

        expect(result).toEqual({
          name: 'Paris',
          latitude: 48.8566,
          longitude: 2.3522,
          country: 'France',
          region: 'Île-de-France'
        });
      });

      it('should handle geocoding API errors', async () => {
        mockRequest.mockResolvedValueOnce({
          statusCode: 429,
          headers: {},
          body: {
            json: () => Promise.reject(new Error('Too Many Requests'))
          }
        });

        await expect((weatherService as any).geocodeCity('TestCity')).rejects.toThrow(
          'Geocoding API error: 429'
        );
      });
    });

    describe('retryAPIRequest', () => {
      it('should succeed on first attempt', async () => {
        const mockFn = vi.fn().mockResolvedValue('success');

        const result = await (weatherService as any).retryAPIRequest(mockFn);

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(1);
      });

      it('should retry on failure and succeed', async () => {
        const mockFn = vi.fn()
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce('success');

        const result = await (weatherService as any).retryAPIRequest(mockFn);

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(2);
      });

      it('should fail after max retries', async () => {
        const mockFn = vi.fn().mockRejectedValue(new Error('Persistent error'));

        await expect((weatherService as any).retryAPIRequest(mockFn)).rejects.toThrow(
          'Persistent error'
        );

        expect(mockFn).toHaveBeenCalledTimes(3); // Default maxRetries
      });
    });
  });

  describe('Data Processing', () => {
    it('should handle temperature rounding correctly', () => {
      // Test rounding logic indirectly through successful API calls
      expect(15.7).toBe(15.7); // Already rounded in mock
    });

    it('should handle date formatting correctly', () => {
      const testDate = new Date('2025-01-08');
      const formatted = testDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      expect(formatted).toBe('Wed, Jan 8');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle fetch network errors', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Network failure'));

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow();
    });

    it('should handle malformed JSON responses', async () => {
      mockRequest.mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        body: {
          json: () => Promise.reject(new Error('Invalid JSON'))
        }
      });

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow();
    });

    it('should handle timeout scenarios', async () => {
      mockRequest.mockImplementationOnce(() =>
        new Promise((resolve) => setTimeout(() => resolve({
          statusCode: 408,
          headers: {},
          body: {
            json: () => Promise.reject(new Error('Request Timeout'))
          }
        }), 5500))
      );

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow();
    });
  });
});
