import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WeatherCache } from './weather-cache.js';

describe('WeatherCache', () => {
  let cache: WeatherCache;
  const originalDateNow = Date.now;

  beforeEach(() => {
    cache = new WeatherCache(300000); // 5 minutes TTL
    vi.clearAllMocks();
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('Constructor', () => {
    it('should create cache with default TTL', () => {
      const defaultCache = new WeatherCache();
      expect(defaultCache).toBeInstanceOf(WeatherCache);
    });

    it('should create cache with custom TTL', () => {
      const customCache = new WeatherCache(600000); // 10 minutes
      expect(customCache).toBeInstanceOf(WeatherCache);
    });
  });

  describe('set and get operations', () => {
    it('should store and retrieve data', () => {
      const weatherData = {
        location: 'London',
        temperature: 15.2,
        description: 'Partly cloudy',
        humidity: 72,
      };

      cache.set('london', weatherData);
      const retrieved = cache.get('london');

      expect(retrieved).toEqual(weatherData);
    });

    it('should return undefined for non-existent keys', () => {
      const result = cache.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should handle different data types', () => {
      const stringData = 'test string';
      const numberData = 42;
      const objectData = { test: true };
      const arrayData = [1, 2, 3];

      cache.set('string', stringData);
      cache.set('number', numberData);
      cache.set('object', objectData);
      cache.set('array', arrayData);

      expect(cache.get('string')).toBe(stringData);
      expect(cache.get('number')).toBe(numberData);
      expect(cache.get('object')).toEqual(objectData);
      expect(cache.get('array')).toEqual(arrayData);
    });

    it('should handle null and undefined values', () => {
      cache.set('null', null);
      cache.set('undefined', undefined);

      expect(cache.get('null')).toBeNull();
      expect(cache.get('undefined')).toBeUndefined();
    });
  });

  describe('TTL and expiration', () => {
    it('should return data within TTL', () => {
      const mockNow = 1000000;
      Date.now = vi.fn(() => mockNow);

      cache.set('key', 'value');

      // Still within TTL (5 minutes = 300000ms)
      Date.now = vi.fn(() => mockNow + 299000);
      expect(cache.get('key')).toBe('value');
    });

    it('should return undefined after TTL expires', () => {
      const mockNow = 1000000;
      Date.now = vi.fn(() => mockNow);

      cache.set('key', 'value');

      // Past TTL (5 minutes = 300000ms)
      Date.now = vi.fn(() => mockNow + 300001);
      expect(cache.get('key')).toBeUndefined();
    });

    it('should clean up expired entries on get', () => {
      const mockNow = 1000000;
      Date.now = vi.fn(() => mockNow);

      cache.set('key', 'value');

      // Advance time past TTL
      Date.now = vi.fn(() => mockNow + 300001);
      cache.get('key'); // This should trigger cleanup

      // Check that the entry was removed
      expect(cache.has('key')).toBe(false);
    });

    it('should handle multiple entries with different timestamps', () => {
      const mockNow = 1000000;
      Date.now = vi.fn(() => mockNow);

      cache.set('key1', 'value1');

      Date.now = vi.fn(() => mockNow + 100000);
      cache.set('key2', 'value2');

      Date.now = vi.fn(() => mockNow + 200000);
      cache.set('key3', 'value3');

      // At 150 seconds, key1 should still be valid, others too
      Date.now = vi.fn(() => mockNow + 150000);
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');

      // At 350 seconds, key1 should be expired, key2 and key3 still valid
      Date.now = vi.fn(() => mockNow + 350000);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
    });
  });

  describe('has method', () => {
    it('should return true for existing non-expired keys', () => {
      cache.set('key', 'value');
      expect(cache.has('key')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired keys', () => {
      const mockNow = 1000000;
      Date.now = vi.fn(() => mockNow);

      cache.set('key', 'value');

      Date.now = vi.fn(() => mockNow + 300001);
      expect(cache.has('key')).toBe(false);
    });

    it('should clean up expired entries', () => {
      const mockNow = 1000000;
      Date.now = vi.fn(() => mockNow);

      cache.set('key', 'value');

      Date.now = vi.fn(() => mockNow + 300001);
      cache.has('key'); // Should trigger cleanup

      // Entry should be removed from internal storage
      expect(cache.has('key')).toBe(false);
    });
  });

  describe('delete method', () => {
    it('should delete existing keys', () => {
      cache.set('key', 'value');
      expect(cache.has('key')).toBe(true);

      const deleted = cache.delete('key');
      expect(deleted).toBe(true);
      expect(cache.has('key')).toBe(false);
    });

    it('should return false for non-existent keys', () => {
      const deleted = cache.delete('nonexistent');
      expect(deleted).toBe(false);
    });

    it('should handle multiple deletes of same key', () => {
      cache.set('key', 'value');

      expect(cache.delete('key')).toBe(true);
      expect(cache.delete('key')).toBe(false);
    });
  });

  describe('clear method', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);

      cache.clear();

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(false);
    });

    it('should handle clearing empty cache', () => {
      cache.clear();
      expect(cache.has('anykey')).toBe(false);
    });
  });

  describe('size method', () => {
    it('should return correct size', () => {
      expect(cache.size()).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);

      cache.delete('key1');
      expect(cache.size()).toBe(1);

      cache.clear();
      expect(cache.size()).toBe(0);
    });

    it('should not count expired entries', () => {
      const mockNow = 1000000;
      Date.now = vi.fn(() => mockNow);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);

      // Expire one entry
      Date.now = vi.fn(() => mockNow + 300001);
      cache.get('key1'); // Trigger cleanup

      expect(cache.size()).toBe(1);
    });
  });

  describe('keys method', () => {
    it('should return all valid keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const keys = cache.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should not return expired keys', () => {
      const mockNow = 1000000;
      Date.now = vi.fn(() => mockNow);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      Date.now = vi.fn(() => mockNow + 300001);
      cache.get('key1'); // Trigger cleanup for expired entry

      const keys = cache.keys();
      expect(keys).not.toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should return empty array for empty cache', () => {
      const keys = cache.keys();
      expect(keys).toEqual([]);
    });
  });

  describe('cleanup method', () => {
    it('should remove expired entries', () => {
      const mockNow = 1000000;
      Date.now = vi.fn(() => mockNow);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      expect(cache.size()).toBe(3);

      // Advance time to expire all entries
      Date.now = vi.fn(() => mockNow + 300001);
      cache.cleanup();

      expect(cache.size()).toBe(0);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(false);
    });

    it('should keep non-expired entries', () => {
      const mockNow = 1000000;
      Date.now = vi.fn(() => mockNow);

      cache.set('key1', 'value1');

      Date.now = vi.fn(() => mockNow + 100000);
      cache.set('key2', 'value2');

      // Advance time to expire only key1
      Date.now = vi.fn(() => mockNow + 350000);
      cache.cleanup();

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.size()).toBe(1);
    });

    it('should handle cleanup of empty cache', () => {
      expect(() => cache.cleanup()).not.toThrow();
      expect(cache.size()).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very short TTL', () => {
      const shortTTLCache = new WeatherCache(1); // 1ms TTL
      const mockNow = 1000000;
      Date.now = vi.fn(() => mockNow);

      shortTTLCache.set('key', 'value');

      Date.now = vi.fn(() => mockNow + 2);
      expect(shortTTLCache.get('key')).toBeUndefined();
    });

    it('should handle very long TTL', () => {
      const longTTLCache = new WeatherCache(Number.MAX_SAFE_INTEGER);
      longTTLCache.set('key', 'value');

      expect(longTTLCache.get('key')).toBe('value');
    });

    it('should handle special key names', () => {
      const specialKeys = ['', '0', 'null', 'undefined', '__proto__', 'constructor'];

      specialKeys.forEach((key, index) => {
        cache.set(key, `value${index}`);
        expect(cache.get(key)).toBe(`value${index}`);
      });
    });

    it('should handle rapid set operations on same key', () => {
      cache.set('key', 'value1');
      cache.set('key', 'value2');
      cache.set('key', 'value3');

      expect(cache.get('key')).toBe('value3');
      expect(cache.size()).toBe(1);
    });
  });

  describe('weather-specific caching scenarios', () => {
    it('should cache weather data with proper structure', () => {
      const weatherData = {
        location: 'London, UK',
        temperature: 15.2,
        description: 'Partly cloudy',
        humidity: 72,
        windSpeed: 8.5,
        pressure: 1013.25,
        timestamp: new Date().toISOString(),
      };

      cache.set('london-uk', weatherData);
      const cached = cache.get('london-uk');

      expect(cached).toEqual(weatherData);
      expect(cached.temperature).toBe(15.2);
      expect(cached.location).toBe('London, UK');
    });

    it('should cache forecast data', () => {
      const forecastData = {
        location: 'Paris, France',
        forecasts: [
          { date: '2025-01-08', temperature: 12, description: 'Rain' },
          { date: '2025-01-09', temperature: 15, description: 'Sunny' },
          { date: '2025-01-10', temperature: 10, description: 'Cloudy' },
        ],
      };

      cache.set('paris-forecast', forecastData);
      const cached = cache.get('paris-forecast');

      expect(cached).toEqual(forecastData);
      expect(cached.forecasts).toHaveLength(3);
    });
  });
});
