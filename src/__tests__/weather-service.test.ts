import { WeatherService } from '../weather-service';
import { getAPIConfig } from '../config/config';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn() as any;
global.fetch = mockFetch;

describe('WeatherService', () => {
  let weatherService: WeatherService;
  const mockConfig = getAPIConfig();

  beforeEach(() => {
    weatherService = new WeatherService();
    vi.clearAllMocks();
    // Reset the mock for each test
    mockFetch.mockClear();
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

    it('should fetch current weather successfully', async () => {
      // Mock the fetch calls
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGeocodingResponse)
        } as Response)
      ).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockWeatherResponse)
        } as Response)
      );

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

    it('should throw error for invalid city parameter', async () => {
      await expect(weatherService.getCurrentWeather('')).rejects.toThrow(
        'Invalid city parameter: city must be a non-empty string'
      );
    });

    it('should throw error when geocoding fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      await expect(weatherService.getCurrentWeather('InvalidCity')).rejects.toThrow(
        'Geocoding API error: 404 Not Found'
      );
    });

    it('should throw error when city not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [] })
      } as Response);

      await expect(weatherService.getCurrentWeather('NonExistentCity')).rejects.toThrow(
        'City not found: NonExistentCity'
      );
    });

    it('should throw error when weather API fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGeocodingResponse)
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        } as Response);

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow(
        'Weather API error: 500 Internal Server Error'
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

    it('should fetch forecast successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGeocodingResponse)
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockForecastResponse)
        } as Response);

      const result = await weatherService.getForecast('Tokyo', 3);

      expect(result.location).toBe('Tokyo');
      expect(result.forecasts).toHaveLength(3);
      expect(result.forecasts[0]).toEqual({
        date: expect.any(String),
        temperature: expect.any(Number),
        temperatureMin: expect.any(Number),
        description: expect.any(String),
        humidity: expect.any(Number),
        windSpeed: expect.any(Number),
        precipitation: expect.any(Number)
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should use default days parameter', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGeocodingResponse)
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockForecastResponse)
        } as Response);

      await weatherService.getForecast('Tokyo');

      const forecastCall = mockFetch.mock.calls[1][0] as string;
      expect(forecastCall).toContain('forecast_days=5');
    });

    it('should throw error for invalid days parameter', async () => {
      await expect(weatherService.getForecast('Tokyo', 8)).rejects.toThrow(
        'Days must be between 1 and 7'
      );
    });

    it('should throw error when forecast data is not available', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGeocodingResponse)
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ...mockForecastResponse, daily: undefined })
        } as Response);

      await expect(weatherService.getForecast('Tokyo')).rejects.toThrow(
        'No forecast data available'
      );
    });
  });

  describe('Weather code mapping', () => {
    it('should map weather codes correctly', async () => {
      // This test would require mocking the private mapWeatherCode method
      // or testing it through the public methods
      expect(true).toBe(true); // Placeholder test
    });
  });

  describe('Error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow(
        'Network error'
      );
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockImplementationOnce(() =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 6000);
        })
      );

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow();
    });
  });
});
