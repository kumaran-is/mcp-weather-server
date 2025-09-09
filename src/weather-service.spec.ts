import { WeatherService } from './weather-service';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
vi.mock('node-fetch', () => ({
  default: mockFetch
}));

// Mock config
vi.mock('./config/config', () => ({
  getAPIConfig: vi.fn().mockReturnValue({
    openMeteoBaseUrl: 'https://api.open-meteo.com/v1',
    geocodingApiUrl: 'https://geocoding-api.open-meteo.com/v1',
    timeout: 10000,
    retries: 3,
    retryDelay: 1000
  })
}));

// Mock logger
vi.mock('./logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    logAPIRequest: vi.fn(),
    logAPIResponse: vi.fn(),
    logPerformance: vi.fn(),
    logError: vi.fn()
  }
}));

describe('WeatherService', () => {
  let weatherService: WeatherService;

  beforeEach(() => {
    vi.clearAllMocks();
    weatherService = new WeatherService();
  });

  describe('getCurrentWeather', () => {
    const mockGeocodingResponse = {
      results: [{
        id: 1,
        name: 'London',
        latitude: 51.5074,
        longitude: -0.1278,
        elevation: 11,
        feature_code: 'PPLC',
        country_code: 'GB',
        timezone: 'Europe/London',
        population: 1000000,
        country_id: 1,
        country: 'United Kingdom',
        admin1: 'England'
      }]
    };

    const mockWeatherResponse = {
      latitude: 51.5074,
      longitude: -0.1278,
      generationtime_ms: 0.5,
      utc_offset_seconds: 0,
      timezone: 'Europe/London',
      timezone_abbreviation: 'GMT',
      elevation: 11,
      current: {
        time: '2025-01-08T12:00',
        interval: 900,
        temperature_2m: 15.2,
        relative_humidity_2m: 72,
        wind_speed_10m: 8.5,
        weather_code: 2
      }
    };

    beforeEach(() => {
      // Mock geocoding API call
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGeocodingResponse)
        })
      );
      // Mock weather API call
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockWeatherResponse)
        })
      );
    });

    it('should fetch current weather successfully', async () => {
      const result = await weatherService.getCurrentWeather('London');

      expect(result).toEqual({
        location: 'London',
        temperature: 15.2,
        description: 'Partly cloudy',
        humidity: 72,
        windSpeed: 8.5,
        feelsLike: 15.2,
        pressure: 1013.25,
        timestamp: '2025-01-08T12:00'
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle city with whitespace', async () => {
      const result = await weatherService.getCurrentWeather('  London  ');

      expect(result.location).toBe('London');
    });

    it('should throw error for invalid city parameter', async () => {
      await expect(weatherService.getCurrentWeather('')).rejects.toThrow(
        'Invalid city parameter: city must be a non-empty string'
      );

      await expect(weatherService.getCurrentWeather(null as any)).rejects.toThrow(
        'Invalid city parameter: city must be a non-empty string'
      );
    });

    it('should throw error when geocoding API fails', async () => {
      mockFetch.mockReset();
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        })
      );

      await expect(weatherService.getCurrentWeather('InvalidCity')).rejects.toThrow(
        'Geocoding API error: 404 Not Found'
      );
    });

    it('should throw error when city not found', async () => {
      mockFetch.mockReset();
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ results: [] })
        })
      );

      await expect(weatherService.getCurrentWeather('NonExistentCity')).rejects.toThrow(
        'City not found: NonExistentCity'
      );
    });

    it('should throw error when weather API fails', async () => {
      mockFetch.mockReset();
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGeocodingResponse)
        })
      );
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
      );

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow(
        'Weather API error: 500 Internal Server Error'
      );
    });

    it('should handle timeout', async () => {
      mockFetch.mockReset();
      mockFetch.mockImplementationOnce(() =>
        Promise.reject(new Error('AbortError'))
      );

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow(
        'AbortError'
      );
    });
  });

  describe('getForecast', () => {
    const mockGeocodingResponse = {
      results: [{
        id: 1,
        name: 'Tokyo',
        latitude: 35.6762,
        longitude: 139.6503,
        elevation: 44,
        feature_code: 'PPLC',
        country_code: 'JP',
        timezone: 'Asia/Tokyo',
        population: 14000000,
        country_id: 1,
        country: 'Japan',
        admin1: 'Tokyo'
      }]
    };

    const mockForecastResponse = {
      latitude: 35.6762,
      longitude: 139.6503,
      generationtime_ms: 0.8,
      utc_offset_seconds: 32400,
      timezone: 'Asia/Tokyo',
      timezone_abbreviation: 'JST',
      elevation: 44,
      daily: {
        time: ['2025-01-08', '2025-01-09', '2025-01-10'],
        temperature_2m_max: [18.5, 20.2, 16.8],
        temperature_2m_min: [12.3, 14.1, 10.5],
        weather_code: [1, 2, 61],
        relative_humidity_2m_mean: [65, 70, 75],
        precipitation_sum: [0.0, 0.2, 5.1],
        wind_speed_10m_max: [12.5, 15.2, 8.9]
      }
    };

    beforeEach(() => {
      mockFetch.mockReset();
      // Mock geocoding API call
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGeocodingResponse)
        })
      );
      // Mock forecast API call
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockForecastResponse)
        })
      );
    });

    it('should fetch forecast successfully', async () => {
      const result = await weatherService.getForecast('Tokyo', 3);

      expect(result.location).toBe('Tokyo');
      expect(result.forecasts).toHaveLength(3);
      expect(result.forecasts[0]).toEqual({
        date: 'Wed, Jan 8',
        temperature: 18.5,
        temperatureMin: 12.3,
        description: 'Mainly clear',
        humidity: 65,
        windSpeed: 12.5,
        precipitation: 0.0
      });
    });

    it('should use default days parameter', async () => {
      const result = await weatherService.getForecast('Tokyo');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('forecast_days=5'),
        expect.any(Object)
      );
    });

    it('should throw error for invalid city parameter', async () => {
      await expect(weatherService.getForecast('', 3)).rejects.toThrow(
        'Invalid city parameter: city must be a non-empty string'
      );
    });

    it('should throw error for invalid days parameter', async () => {
      await expect(weatherService.getForecast('Tokyo', 8)).rejects.toThrow(
        'Days must be between 1 and 7'
      );

      await expect(weatherService.getForecast('Tokyo', 0)).rejects.toThrow(
        'Days must be between 1 and 7'
      );
    });

    it('should throw error when forecast API fails', async () => {
      mockFetch.mockReset();
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGeocodingResponse)
        })
      );
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
      );

      await expect(weatherService.getForecast('Tokyo', 3)).rejects.toThrow(
        'Forecast API error: 500 Internal Server Error'
      );
    });

    it('should throw error when no forecast data available', async () => {
      mockFetch.mockReset();
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGeocodingResponse)
        })
      );
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ daily: null })
        })
      );

      await expect(weatherService.getForecast('Tokyo', 3)).rejects.toThrow(
        'No forecast data available'
      );
    });
  });

  describe('Weather code mapping', () => {
    it('should map weather codes correctly', () => {
      const testCases = [
        { code: 0, expected: 'Clear sky' },
        { code: 1, expected: 'Mainly clear' },
        { code: 2, expected: 'Partly cloudy' },
        { code: 3, expected: 'Overcast' },
        { code: 45, expected: 'Fog' },
        { code: 61, expected: 'Slight rain' },
        { code: 95, expected: 'Thunderstorm' },
        { code: 999, expected: 'Unknown weather condition' }
      ];

      testCases.forEach(({ code, expected }) => {
        const result = (weatherService as any).mapWeatherCode(code);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Geocoding functionality', () => {
    it('should geocode city successfully', async () => {
      const mockGeocodingResponse = {
        results: [{
          id: 1,
          name: 'Paris',
          latitude: 48.8566,
          longitude: 2.3522,
          elevation: 35,
          feature_code: 'PPLC',
          country_code: 'FR',
          timezone: 'Europe/Paris',
          population: 2148000,
          country_id: 1,
          country: 'France',
          admin1: 'Île-de-France'
        }]
      };

      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGeocodingResponse)
        })
      );

      const result = await (weatherService as any).geocodeCity('Paris');

      expect(result).toEqual({
        name: 'Paris',
        latitude: 48.8566,
        longitude: 2.3522,
        country: 'France',
        region: 'Île-de-France'
      });
    });

    it('should throw error when geocoding API fails', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests'
        })
      );

      await expect((weatherService as any).geocodeCity('Paris')).rejects.toThrow(
        'Geocoding API error: 429 Too Many Requests'
      );
    });
  });

  describe('Error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.reject(new Error('Network error'))
      );

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow(
        'Network error'
      );
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.reject(new Error('AbortError'))
      );

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow(
        'AbortError'
      );
    });

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error('Invalid JSON'))
        })
      );

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow(
        'Invalid JSON'
      );
    });
  });

  describe('Data transformation', () => {
    it('should round temperature values correctly', async () => {
      const mockGeocodingResponse = {
        results: [{
          id: 1,
          name: 'London',
          latitude: 51.5074,
          longitude: -0.1278,
          country: 'United Kingdom',
          admin1: 'England'
        }]
      };

      const mockWeatherResponse = {
        current: {
          time: '2025-01-08T12:00',
          temperature_2m: 15.234,
          relative_humidity_2m: 72,
          wind_speed_10m: 8.567,
          weather_code: 2
        }
      };

      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGeocodingResponse)
        })
      );
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockWeatherResponse)
        })
      );

      const result = await weatherService.getCurrentWeather('London');

      expect(result.temperature).toBe(15.2);
      expect(result.windSpeed).toBe(8.6);
    });
  });
});
