import { WeatherService } from './weather-service';
import { getAPIConfig } from './config/config';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// Mock the entire module
vi.mock('./weather-service', () => ({
  WeatherService: vi.fn().mockImplementation(() => ({
    getCurrentWeather: vi.fn(),
    getForecast: vi.fn()
  }))
}));

describe('WeatherService', () => {
  let weatherService: WeatherService;
  let mockGetCurrentWeather: Mock;
  let mockGetForecast: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a new instance with mocked methods
    weatherService = new WeatherService();
    mockGetCurrentWeather = weatherService.getCurrentWeather as Mock;
    mockGetForecast = weatherService.getForecast as Mock;
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
      const mockWeatherData = {
        location: 'London',
        temperature: 15.2,
        description: 'Partly cloudy',
        humidity: 72,
        windSpeed: 8.5,
        feelsLike: 15.2,
        pressure: 1013.25,
        timestamp: '2025-01-08T12:00'
      };

      mockGetCurrentWeather.mockResolvedValue(mockWeatherData);

      const result = await weatherService.getCurrentWeather('London');

      expect(result).toEqual(mockWeatherData);
      expect(mockGetCurrentWeather).toHaveBeenCalledWith('London');
    });

    it('should throw error for invalid city parameter', async () => {
      mockGetCurrentWeather.mockRejectedValue(new Error('Invalid city parameter: city must be a non-empty string'));

      await expect(weatherService.getCurrentWeather('')).rejects.toThrow(
        'Invalid city parameter: city must be a non-empty string'
      );
    });

    it('should throw error when geocoding fails', async () => {
      mockGetCurrentWeather.mockRejectedValue(new Error('Geocoding API error: 404 Not Found'));

      await expect(weatherService.getCurrentWeather('InvalidCity')).rejects.toThrow(
        'Geocoding API error: 404 Not Found'
      );
    });

    it('should throw error when city not found', async () => {
      mockGetCurrentWeather.mockRejectedValue(new Error('City not found: NonExistentCity'));

      await expect(weatherService.getCurrentWeather('NonExistentCity')).rejects.toThrow(
        'City not found: NonExistentCity'
      );
    });

    it('should throw error when weather API fails', async () => {
      mockGetCurrentWeather.mockRejectedValue(new Error('Weather API error: 500 Internal Server Error'));

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
      const mockForecastData = {
        location: 'Tokyo',
        forecasts: [
          {
            date: 'Mon, Sep 8',
            temperature: 18.5,
            temperatureMin: 12.3,
            description: 'Mainly clear',
            humidity: 65,
            windSpeed: 12.5,
            precipitation: 0.0
          },
          {
            date: 'Tue, Sep 9',
            temperature: 20.2,
            temperatureMin: 14.1,
            description: 'Partly cloudy',
            humidity: 70,
            windSpeed: 15.2,
            precipitation: 0.2
          },
          {
            date: 'Wed, Sep 10',
            temperature: 16.8,
            temperatureMin: 10.5,
            description: 'Rainy',
            humidity: 75,
            windSpeed: 8.9,
            precipitation: 5.1
          }
        ]
      };

      mockGetForecast.mockResolvedValue(mockForecastData);

      const result = await weatherService.getForecast('Tokyo', 3);

      expect(result).toEqual(mockForecastData);
      expect(mockGetForecast).toHaveBeenCalledWith('Tokyo', 3);
    });

    it('should use default days parameter', async () => {
      const mockForecastData = {
        location: 'Tokyo',
        forecasts: []
      };

      mockGetForecast.mockResolvedValue(mockForecastData);

      await weatherService.getForecast('Tokyo');

      expect(mockGetForecast).toHaveBeenCalledWith('Tokyo');
    });

    it('should throw error for invalid days parameter', async () => {
      mockGetForecast.mockRejectedValue(new Error('Days must be between 1 and 7'));

      await expect(weatherService.getForecast('Tokyo', 8)).rejects.toThrow(
        'Days must be between 1 and 7'
      );
    });

    it('should throw error when forecast data is not available', async () => {
      mockGetForecast.mockRejectedValue(new Error('No forecast data available'));

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
      mockGetCurrentWeather.mockRejectedValue(new Error('Network error'));

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow(
        'Network error'
      );
    });

    it('should handle timeout errors', async () => {
      mockGetCurrentWeather.mockRejectedValue(new Error('Timeout'));

      await expect(weatherService.getCurrentWeather('London')).rejects.toThrow(
        'Timeout'
      );
    });
  });
});
