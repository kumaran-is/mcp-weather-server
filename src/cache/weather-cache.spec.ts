import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WeatherCache } from './weather-cache';
import type { WeatherData, ForecastData } from '../types';

// Mock logger
vi.mock('../logger-pino.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    logError: vi.fn(),
    logPerformance: vi.fn(),
  }
}));

describe('WeatherCache', () => {
  let cache: WeatherCache;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    cache = new WeatherCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    cache.clear();
  });

  describe('Constructor and initialization', () => {
    it('should create cache instance with default settings', () => {
      expect(cache).toBeDefined();
      expect(cache).toBeInstanceOf(WeatherCache);
    });

    it('should initialize with default max size', () => {
      const defaultCache = new WeatherCache();
      expect(defaultCache['config'].maxSize).toBe(500);
    });

    it('should initialize with default TTLs', () => {
      const defaultCache = new WeatherCache();
      expect(defaultCache['config'].weatherTTL).toBe(600000); // 10 minutes
      expect(defaultCache['config'].forecastTTL).toBe(1800000); // 30 minutes
      expect(defaultCache['config'].geocodingTTL).toBe(86400000); // 24 hours
    });

    it('should accept custom configuration', () => {
      const customCache = new WeatherCache({
        maxSize: 50,
        weatherTTL: 60000,
        forecastTTL: 120000,
        geocodingTTL: 1800000
      });
      expect(customCache['config'].maxSize).toBe(50);
      expect(customCache['config'].weatherTTL).toBe(60000);
      expect(customCache['config'].forecastTTL).toBe(120000);
      expect(customCache['config'].geocodingTTL).toBe(1800000);
    });
  });

  describe('Weather data caching', () => {
    const mockWeatherData: WeatherData = {
      location: 'London',
      temperature: 15.2,
      description: 'Partly cloudy',
      humidity: 72,
      windSpeed: 8.5,
      feelsLike: 14.8,
      pressure: 1013.25,
      timestamp: '2025-01-08T12:00:00Z'
    };

    it('should cache weather data', () => {
      cache.setWeather('london', mockWeatherData);
      const result = cache.getWeather('london');
      expect(result).toEqual(mockWeatherData);
    });

    it('should normalize city names to lowercase', () => {
      cache.setWeather('LONDON', mockWeatherData);
      const result = cache.getWeather('london');
      expect(result).toEqual(mockWeatherData);
    });

    it('should return undefined for non-cached weather', () => {
      const result = cache.getWeather('paris');
      expect(result).toBeUndefined();
    });

    it('should return undefined for expired weather cache', () => {
      cache.setWeather('london', mockWeatherData);
      
      // Advance time beyond TTL (10 minutes by default)
      vi.advanceTimersByTime(11 * 60 * 1000); // 11 minutes
      
      const result = cache.getWeather('london');
      expect(result).toBeUndefined();
    });

    it('should update existing weather cache', () => {
      cache.setWeather('london', mockWeatherData);
      
      const updatedData = { ...mockWeatherData, temperature: 18.5 };
      cache.setWeather('london', updatedData);
      
      const result = cache.getWeather('london');
      expect(result?.temperature).toBe(18.5);
    });

    it('should track cache hits', () => {
      cache.setWeather('london', mockWeatherData);
      cache.getWeather('london');
      cache.getWeather('london');
      
      const stats = cache.getStats();
      expect(stats.weatherHits).toBe(2);
    });

    it('should track cache misses', () => {
      cache.getWeather('paris');
      cache.getWeather('tokyo');
      
      const stats = cache.getStats();
      expect(stats.weatherMisses).toBe(2);
    });
  });

  describe('Forecast data caching', () => {
    const mockForecastData: ForecastData = {
      location: 'London',
      forecasts: [
        {
          date: 'Mon Jan 08 2025',
          temperature: 15.2,
          temperatureMin: 12.1,
          temperatureMax: 18.3,
          description: 'Partly cloudy',
          humidity: 72,
          windSpeed: 8.5,
          precipitation: 0.1
        }
      ]
    };

    it('should cache forecast data', () => {
      cache.setForecast('london', 5, mockForecastData);
      const result = cache.getForecast('london', 5);
      expect(result).toEqual(mockForecastData);
    });

    it('should cache forecasts with different day counts separately', () => {
      const forecast3Days = { ...mockForecastData, forecasts: mockForecastData.forecasts.slice(0, 3) };
      const forecast7Days = { ...mockForecastData, forecasts: [...mockForecastData.forecasts, ...mockForecastData.forecasts] };
      
      cache.setForecast('london', 3, forecast3Days);
      cache.setForecast('london', 7, forecast7Days);
      
      const result3 = cache.getForecast('london', 3);
      const result7 = cache.getForecast('london', 7);
      
      expect(result3?.forecasts.length).toBe(1);
      expect(result7?.forecasts.length).toBe(2);
    });

    it('should return undefined for non-cached forecast', () => {
      const result = cache.getForecast('paris', 5);
      expect(result).toBeUndefined();
    });

    it('should return undefined for expired forecast cache', () => {
      cache.setForecast('london', 5, mockForecastData);
      
      // Advance time beyond TTL (30 minutes by default)
      vi.advanceTimersByTime(31 * 60 * 1000); // 31 minutes
      
      const result = cache.getForecast('london', 5);
      expect(result).toBeUndefined();
    });

    it('should track forecast cache hits and misses', () => {
      cache.setForecast('london', 5, mockForecastData);
      cache.getForecast('london', 5);
      cache.getForecast('paris', 5);
      
      const stats = cache.getStats();
      expect(stats.forecastHits).toBe(1);
      expect(stats.forecastMisses).toBe(1);
    });
  });

  describe('Geocoding data caching', () => {
    it('should cache geocoding data', () => {
      cache.setGeocoding('london', 51.5074, -0.1278);
      const result = cache.getGeocoding('london');
      
      expect(result).toEqual({
        latitude: 51.5074,
        longitude: -0.1278
      });
    });

    it('should normalize city names for geocoding', () => {
      cache.setGeocoding('NEW YORK', 40.7128, -74.0060);
      const result = cache.getGeocoding('new york');
      
      expect(result).toEqual({
        latitude: 40.7128,
        longitude: -74.0060
      });
    });

    it('should return undefined for non-cached geocoding', () => {
      const result = cache.getGeocoding('tokyo');
      expect(result).toBeUndefined();
    });

    it('should return undefined for expired geocoding cache', () => {
      cache.setGeocoding('london', 51.5074, -0.1278);
      
      // Advance time beyond TTL (24 hours by default)
      vi.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 hours
      
      const result = cache.getGeocoding('london');
      expect(result).toBeUndefined();
    });

    it('should track geocoding cache hits and misses', () => {
      cache.setGeocoding('london', 51.5074, -0.1278);
      cache.getGeocoding('london');
      cache.getGeocoding('paris');
      
      const stats = cache.getStats();
      expect(stats.geocodingHits).toBe(1);
      expect(stats.geocodingMisses).toBe(1);
    });
  });

  describe('Cache size management', () => {
    it('should respect max cache size', () => {
      const smallCache = new WeatherCache({ maxSize: 3 });
      
      // Add 4 items (exceeds max size of 3)
      smallCache.setWeather('city1', {} as WeatherData);
      smallCache.setWeather('city2', {} as WeatherData);
      smallCache.setWeather('city3', {} as WeatherData);
      smallCache.setWeather('city4', {} as WeatherData);
      
      // First item should be evicted
      expect(smallCache.getWeather('city1')).toBeUndefined();
      expect(smallCache.getWeather('city4')).toBeDefined();
    });

    it('should use LRU eviction strategy', () => {
      const smallCache = new WeatherCache({ maxSize: 3 });
      
      smallCache.setWeather('city1', {} as WeatherData);
      smallCache.setWeather('city2', {} as WeatherData);
      smallCache.setWeather('city3', {} as WeatherData);
      
      // Access city1 to make it recently used
      smallCache.getWeather('city1');
      
      // Add new item
      smallCache.setWeather('city4', {} as WeatherData);
      
      // city2 should be evicted (least recently used)
      expect(smallCache.getWeather('city1')).toBeDefined();
      expect(smallCache.getWeather('city2')).toBeUndefined();
      expect(smallCache.getWeather('city3')).toBeDefined();
      expect(smallCache.getWeather('city4')).toBeDefined();
    });

    it('should count each cache type separately for size limit', () => {
      const smallCache = new WeatherCache({ maxSize: 2 });
      
      smallCache.setWeather('london', {} as WeatherData);
      smallCache.setForecast('london', 5, {} as ForecastData);
      smallCache.setGeocoding('london', 51.5, 0.0);
      smallCache.setWeather('paris', {} as WeatherData);
      
      // Should have 2 weather, 1 forecast, 1 geocoding
      expect(smallCache.getWeather('london')).toBeDefined();
      expect(smallCache.getWeather('paris')).toBeDefined();
      expect(smallCache.getForecast('london', 5)).toBeDefined();
      expect(smallCache.getGeocoding('london')).toBeDefined();
    });
  });

  describe('Cache clearing', () => {
    it('should clear all caches', () => {
      cache.setWeather('london', {} as WeatherData);
      cache.setForecast('london', 5, {} as ForecastData);
      cache.setGeocoding('london', 51.5, 0.0);
      
      cache.clear();
      
      expect(cache.getWeather('london')).toBeUndefined();
      expect(cache.getForecast('london', 5)).toBeUndefined();
      expect(cache.getGeocoding('london')).toBeUndefined();
    });

    it('should reset statistics on clear', () => {
      cache.setWeather('london', {} as WeatherData);
      cache.getWeather('london');
      cache.getWeather('paris');
      
      cache.clear();
      
      const stats = cache.getStats();
      expect(stats.weatherHits).toBe(0);
      expect(stats.weatherMisses).toBe(0);
      expect(stats.size).toBe(0);
    });

    it('should clear specific cache types', () => {
      cache.setWeather('london', {} as WeatherData);
      cache.setForecast('london', 5, {} as ForecastData);
      cache.setGeocoding('london', 51.5, 0.0);
      
      cache.clearWeather();
      
      expect(cache.getWeather('london')).toBeUndefined();
      expect(cache.getForecast('london', 5)).toBeDefined();
      expect(cache.getGeocoding('london')).toBeDefined();
    });

    it('should clear forecast cache', () => {
      cache.setForecast('london', 5, {} as ForecastData);
      cache.setForecast('paris', 3, {} as ForecastData);
      
      cache.clearForecasts();
      
      expect(cache.getForecast('london', 5)).toBeUndefined();
      expect(cache.getForecast('paris', 3)).toBeUndefined();
    });

    it('should clear geocoding cache', () => {
      cache.setGeocoding('london', 51.5, 0.0);
      cache.setGeocoding('paris', 48.8, 2.3);
      
      cache.clearGeocoding();
      
      expect(cache.getGeocoding('london')).toBeUndefined();
      expect(cache.getGeocoding('paris')).toBeUndefined();
    });
  });

  describe('Cache statistics', () => {
    it('should provide comprehensive statistics', () => {
      cache.setWeather('london', {} as WeatherData);
      cache.setForecast('paris', 5, {} as ForecastData);
      cache.setGeocoding('tokyo', 35.6, 139.7);
      
      cache.getWeather('london'); // hit
      cache.getWeather('berlin'); // miss
      cache.getForecast('paris', 5); // hit
      cache.getForecast('rome', 3); // miss
      cache.getGeocoding('tokyo'); // hit
      cache.getGeocoding('sydney'); // miss
      
      const stats = cache.getStats();
      
      expect(stats).toEqual({
        size: 3,
        weatherHits: 1,
        weatherMisses: 1,
        forecastHits: 1,
        forecastMisses: 1,
        geocodingHits: 1,
        geocodingMisses: 1,
        hitRate: 0.5,
        weatherCount: 1,
        forecastCount: 1,
        geocodingCount: 1
      });
    });

    it('should calculate correct hit rate', () => {
      cache.setWeather('london', {} as WeatherData);
      
      // 3 hits, 1 miss
      cache.getWeather('london');
      cache.getWeather('london');
      cache.getWeather('london');
      cache.getWeather('paris');
      
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0.75);
    });

    it('should handle zero hit rate', () => {
      cache.getWeather('london');
      cache.getWeather('paris');
      
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it('should count cache entries correctly', () => {
      cache.setWeather('london', {} as WeatherData);
      cache.setWeather('paris', {} as WeatherData);
      cache.setForecast('london', 5, {} as ForecastData);
      cache.setForecast('london', 7, {} as ForecastData);
      cache.setGeocoding('tokyo', 35.6, 139.7);
      
      const stats = cache.getStats();
      expect(stats.weatherCount).toBe(2);
      expect(stats.forecastCount).toBe(2);
      expect(stats.geocodingCount).toBe(1);
      expect(stats.size).toBe(5);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string city names', () => {
      cache.setWeather('', {} as WeatherData);
      const result = cache.getWeather('');
      expect(result).toBeDefined();
    });

    it('should handle special characters in city names', () => {
      const cityName = 'São Paulo';
      cache.setWeather(cityName, {} as WeatherData);
      const result = cache.getWeather(cityName);
      expect(result).toBeDefined();
    });

    it('should handle numeric forecast days', () => {
      cache.setForecast('london', 0, {} as ForecastData);
      cache.setForecast('london', -1, {} as ForecastData);
      cache.setForecast('london', 100, {} as ForecastData);
      
      expect(cache.getForecast('london', 0)).toBeDefined();
      expect(cache.getForecast('london', -1)).toBeDefined();
      expect(cache.getForecast('london', 100)).toBeDefined();
    });

    it('should handle coordinate edge values', () => {
      cache.setGeocoding('north-pole', 90, 0);
      cache.setGeocoding('south-pole', -90, 0);
      cache.setGeocoding('date-line', 0, 180);
      cache.setGeocoding('date-line-west', 0, -180);
      
      expect(cache.getGeocoding('north-pole')).toEqual({ latitude: 90, longitude: 0 });
      expect(cache.getGeocoding('south-pole')).toEqual({ latitude: -90, longitude: 0 });
      expect(cache.getGeocoding('date-line')).toEqual({ latitude: 0, longitude: 180 });
      expect(cache.getGeocoding('date-line-west')).toEqual({ latitude: 0, longitude: -180 });
    });
  });

  describe('Performance monitoring', () => {
    it('should clean up expired entries periodically', () => {
      vi.useFakeTimers();
      const cleanupSpy = vi.spyOn(cache as any, 'cleanup');
      
      // Create new cache to trigger cleanup interval
      const newCache = new WeatherCache();
      
      // Advance time to trigger cleanup
      vi.advanceTimersByTime(60000); // 1 minute
      
      expect(cleanupSpy).toHaveBeenCalled();
      
      vi.useRealTimers();
    });

    it('should handle concurrent operations', () => {
      const cities = ['london', 'paris', 'tokyo', 'new-york', 'sydney'];
      
      // Simultaneous writes
      cities.forEach(city => {
        cache.setWeather(city, { location: city } as WeatherData);
        cache.setForecast(city, 5, { location: city } as ForecastData);
        cache.setGeocoding(city, Math.random() * 180 - 90, Math.random() * 360 - 180);
      });
      
      // Simultaneous reads
      cities.forEach(city => {
        expect(cache.getWeather(city)).toBeDefined();
        expect(cache.getForecast(city, 5)).toBeDefined();
        expect(cache.getGeocoding(city)).toBeDefined();
      });
      
      const stats = cache.getStats();
      expect(stats.size).toBe(15); // 5 cities * 3 cache types
    });
  });

  describe('cacheUtils', () => {
    it('should invalidate cache for a specific city', () => {
      const { cacheUtils } = require('./weather-cache.js');
      const { logger } = require('../logger-pino.js');
      
      // Set data for multiple cities
      cache.setWeather('london', {} as WeatherData);
      cache.setWeather('paris', {} as WeatherData);
      cache.setForecast('london', 3, {} as ForecastData);
      cache.setForecast('london', 5, {} as ForecastData);
      cache.setForecast('paris', 5, {} as ForecastData);
      cache.setGeocoding('london', 51.5, 0.0);
      cache.setGeocoding('paris', 48.8, 2.3);
      
      // Invalidate London only
      cacheUtils.invalidateCity('london');
      
      // London data should be gone
      expect(cache.getWeather('london')).toBeUndefined();
      expect(cache.getForecast('london', 3)).toBeUndefined();
      expect(cache.getForecast('london', 5)).toBeUndefined();
      expect(cache.getGeocoding('london')).toBeUndefined();
      
      // Paris data should remain
      expect(cache.getWeather('paris')).toBeDefined();
      expect(cache.getForecast('paris', 5)).toBeDefined();
      expect(cache.getGeocoding('paris')).toBeDefined();
      
      expect(logger.info).toHaveBeenCalledWith('Cache invalidated for city', { city: 'london' });
    });

    it('should handle case-insensitive city invalidation', () => {
      const { cacheUtils } = require('./weather-cache.js');
      
      cache.setWeather('LONDON', {} as WeatherData);
      cache.setForecast('London', 5, {} as ForecastData);
      cache.setGeocoding('london', 51.5, 0.0);
      
      cacheUtils.invalidateCity('LoNdOn');
      
      expect(cache.getWeather('london')).toBeUndefined();
      expect(cache.getForecast('london', 5)).toBeUndefined();
      expect(cache.getGeocoding('london')).toBeUndefined();
    });

    it('should warm up cache with common cities', async () => {
      const { cacheUtils } = require('./weather-cache.js');
      const { logger } = require('../logger-pino.js');
      
      const mockFetchWeather = vi.fn().mockImplementation(async (city: string) => ({
        location: city,
        temperature: 20,
        description: 'Clear',
        humidity: 60,
        windSpeed: 10,
        feelsLike: 19,
        pressure: 1013,
        timestamp: new Date().toISOString()
      }));
      
      const cities = ['london', 'paris', 'tokyo'];
      
      await cacheUtils.warmUp(cities, mockFetchWeather);
      
      expect(mockFetchWeather).toHaveBeenCalledTimes(3);
      expect(cache.getWeather('london')).toBeDefined();
      expect(cache.getWeather('paris')).toBeDefined();
      expect(cache.getWeather('tokyo')).toBeDefined();
      
      expect(logger.info).toHaveBeenCalledWith('Warming up cache', { cities: 3 });
      expect(logger.info).toHaveBeenCalledWith('Cache warm-up complete');
    });

    it('should skip warming up already cached cities', async () => {
      const { cacheUtils } = require('./weather-cache.js');
      
      const mockFetchWeather = vi.fn().mockImplementation(async (city: string) => ({
        location: city,
        temperature: 20,
        description: 'Clear',
        humidity: 60,
        windSpeed: 10,
        feelsLike: 19,
        pressure: 1013,
        timestamp: new Date().toISOString()
      }));
      
      // Pre-cache london
      cache.setWeather('london', {} as WeatherData);
      
      const cities = ['london', 'paris'];
      
      await cacheUtils.warmUp(cities, mockFetchWeather);
      
      // Should only fetch paris
      expect(mockFetchWeather).toHaveBeenCalledTimes(1);
      expect(mockFetchWeather).toHaveBeenCalledWith('paris');
    });

    it('should handle errors during cache warm-up', async () => {
      const { cacheUtils } = require('./weather-cache.js');
      const { logger } = require('../logger-pino.js');
      
      const mockFetchWeather = vi.fn()
        .mockResolvedValueOnce({ location: 'london' } as WeatherData)
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({ location: 'tokyo' } as WeatherData);
      
      const cities = ['london', 'paris', 'tokyo'];
      
      await cacheUtils.warmUp(cities, mockFetchWeather);
      
      // Should still complete warm-up for successful cities
      expect(cache.getWeather('london')).toBeDefined();
      expect(cache.getWeather('paris')).toBeUndefined();
      expect(cache.getWeather('tokyo')).toBeDefined();
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to warm up cache for city',
        expect.objectContaining({ city: 'paris' })
      );
    });

    it('should handle empty cities array for warm-up', async () => {
      const { cacheUtils } = require('./weather-cache.js');
      const mockFetchWeather = vi.fn();
      
      await cacheUtils.warmUp([], mockFetchWeather);
      
      expect(mockFetchWeather).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should throw CacheError on get failures', () => {
      // Mock LRUCache to throw error
      const originalGet = cache['weatherCache'].get;
      cache['weatherCache'].get = vi.fn().mockImplementation(() => {
        throw new Error('Cache error');
      });
      
      expect(() => cache.getWeather('london')).toThrow('Failed to get weather from cache');
      
      cache['weatherCache'].get = originalGet;
    });

    it('should throw CacheError on set failures', () => {
      // Mock LRUCache to throw error
      const originalSet = cache['weatherCache'].set;
      cache['weatherCache'].set = vi.fn().mockImplementation(() => {
        throw new Error('Cache error');
      });
      
      expect(() => cache.setWeather('london', {} as WeatherData)).toThrow('Failed to set weather in cache');
      
      cache['weatherCache'].set = originalSet;
    });

    it('should handle has method errors', () => {
      const originalHas = cache['weatherCache'].has;
      cache['weatherCache'].has = vi.fn().mockImplementation(() => {
        throw new Error('Cache error');
      });
      
      const result = cache.hasWeather('london');
      expect(result).toBe(false);
      
      const { logger } = require('../logger-pino.js');
      expect(logger.error).toHaveBeenCalledWith(
        'Error checking weather cache',
        expect.objectContaining({ city: 'london' })
      );
      
      cache['weatherCache'].has = originalHas;
    });

    it('should handle clear errors gracefully', () => {
      const originalClear = cache['weatherCache'].clear;
      cache['weatherCache'].clear = vi.fn().mockImplementation(() => {
        throw new Error('Clear error');
      });
      
      expect(() => cache.clearWeather()).not.toThrow();
      
      const { logger } = require('../logger-pino.js');
      expect(logger.error).toHaveBeenCalledWith(
        'Error clearing weather cache',
        expect.any(Object)
      );
      
      cache['weatherCache'].clear = originalClear;
    });
  });
});