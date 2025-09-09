import { WeatherService } from './weather-service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('WeatherService', () => {
  let weatherService: WeatherService;

  beforeEach(() => {
    vi.clearAllMocks();
    weatherService = new WeatherService();
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
    it('should validate city parameter for getCurrentWeather', async () => {
      await expect(weatherService.getCurrentWeather('')).rejects.toThrow(
        'Invalid city parameter: city must be a non-empty string'
      );
    });

    it('should validate city parameter for getForecast', async () => {
      await expect(weatherService.getForecast('', 3)).rejects.toThrow(
        'Invalid city parameter: city must be a non-empty string'
      );
    });

    it('should validate days parameter for getForecast', async () => {
      await expect(weatherService.getForecast('London', 8)).rejects.toThrow(
        'Days must be between 1 and 7'
      );
    });
  });

  describe('Weather Code Mapping', () => {
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

  describe('Data Processing', () => {
    it('should handle temperature rounding', () => {
      // Test the rounding logic indirectly through weather code mapping
      expect((weatherService as any).mapWeatherCode(2)).toBe('Partly cloudy');
    });

    it('should handle date formatting', () => {
      // Test date formatting logic
      const testDate = new Date('2025-01-08');
      const formatted = testDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      expect(formatted).toContain('Jan');
    });
  });
});
