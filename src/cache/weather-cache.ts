/**
 * LRU Cache implementation for weather data
 * Reduces API calls and improves response times
 */

import { LRUCache } from 'lru-cache';
import { WeatherData, ForecastData } from '../types';
import { logger } from '../logger-pino';
import { CacheError } from '../errors/weather-errors';

export interface CacheConfig {
  /** Maximum number of items in cache */
  maxSize: number;
  /** TTL for weather data in milliseconds */
  weatherTTL: number;
  /** TTL for forecast data in milliseconds */
  forecastTTL: number;
  /** TTL for geocoding data in milliseconds */
  geocodingTTL: number;
  /** Update age on get */
  updateAgeOnGet: boolean;
  /** Update age on has */
  updateAgeOnHas: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRatio: number;
  size: number;
  maxSize: number;
}

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 500,
  weatherTTL: 10 * 60 * 1000, // 10 minutes
  forecastTTL: 30 * 60 * 1000, // 30 minutes
  geocodingTTL: 24 * 60 * 60 * 1000, // 24 hours
  updateAgeOnGet: true,
  updateAgeOnHas: false,
};

/**
 * Weather data cache manager
 */
export class WeatherCache {
  private weatherCache: LRUCache<string, WeatherData>;
  private forecastCache: LRUCache<string, ForecastData>;
  private geocodingCache: LRUCache<string, { latitude: number; longitude: number }>;
  private config: CacheConfig;

  // Statistics
  private stats = {
    weather: { hits: 0, misses: 0, sets: 0, deletes: 0 },
    forecast: { hits: 0, misses: 0, sets: 0, deletes: 0 },
    geocoding: { hits: 0, misses: 0, sets: 0, deletes: 0 },
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };

    // Initialize weather cache
    this.weatherCache = new LRUCache<string, WeatherData>({
      max: this.config.maxSize,
      ttl: this.config.weatherTTL,
      updateAgeOnGet: this.config.updateAgeOnGet,
      updateAgeOnHas: this.config.updateAgeOnHas,
      dispose: (value, key) => {
        logger.debug('Evicting weather cache entry', { key });
      },
    });

    // Initialize forecast cache
    this.forecastCache = new LRUCache<string, ForecastData>({
      max: this.config.maxSize,
      ttl: this.config.forecastTTL,
      updateAgeOnGet: this.config.updateAgeOnGet,
      updateAgeOnHas: this.config.updateAgeOnHas,
      dispose: (value, key) => {
        logger.debug('Evicting forecast cache entry', { key });
      },
    });

    // Initialize geocoding cache
    this.geocodingCache = new LRUCache<string, { latitude: number; longitude: number }>({
      max: this.config.maxSize * 2, // More entries for geocoding
      ttl: this.config.geocodingTTL,
      updateAgeOnGet: this.config.updateAgeOnGet,
      updateAgeOnHas: this.config.updateAgeOnHas,
      dispose: (value, key) => {
        logger.debug('Evicting geocoding cache entry', { key });
      },
    });

    logger.info('Weather cache initialized', { config: this.config });
  }

  /**
   * Generate cache key for weather data
   */
  private getWeatherKey(city: string): string {
    return `weather:${city.toLowerCase().trim()}`;
  }

  /**
   * Generate cache key for forecast data
   */
  private getForecastKey(city: string, days: number): string {
    return `forecast:${city.toLowerCase().trim()}:${days}`;
  }

  /**
   * Generate cache key for geocoding data
   */
  private getGeocodingKey(city: string): string {
    return `geo:${city.toLowerCase().trim()}`;
  }

  /**
   * Get current weather from cache
   */
  getWeather(city: string): WeatherData | undefined {
    try {
      const key = this.getWeatherKey(city);
      const data = this.weatherCache.get(key);

      if (data) {
        this.stats.weather.hits++;
        logger.debug('Weather cache hit', { city, key });
      } else {
        this.stats.weather.misses++;
        logger.debug('Weather cache miss', { city, key });
      }

      return data;
    } catch (error) {
      logger.error('Error getting weather from cache', { city, error });
      throw new CacheError('Failed to get weather from cache', 'get');
    }
  }

  /**
   * Set current weather in cache
   */
  setWeather(city: string, data: WeatherData): void {
    try {
      const key = this.getWeatherKey(city);
      this.weatherCache.set(key, data);
      this.stats.weather.sets++;
      logger.debug('Weather cached', { city, key });
    } catch (error) {
      logger.error('Error setting weather in cache', { city, error });
      throw new CacheError('Failed to set weather in cache', 'set');
    }
  }

  /**
   * Get forecast from cache
   */
  getForecast(city: string, days: number): ForecastData | undefined {
    try {
      const key = this.getForecastKey(city, days);
      const data = this.forecastCache.get(key);

      if (data) {
        this.stats.forecast.hits++;
        logger.debug('Forecast cache hit', { city, days, key });
      } else {
        this.stats.forecast.misses++;
        logger.debug('Forecast cache miss', { city, days, key });
      }

      return data;
    } catch (error) {
      logger.error('Error getting forecast from cache', { city, days, error });
      throw new CacheError('Failed to get forecast from cache', 'get');
    }
  }

  /**
   * Set forecast in cache
   */
  setForecast(city: string, days: number, data: ForecastData): void {
    try {
      const key = this.getForecastKey(city, days);
      this.forecastCache.set(key, data);
      this.stats.forecast.sets++;
      logger.debug('Forecast cached', { city, days, key });
    } catch (error) {
      logger.error('Error setting forecast in cache', { city, days, error });
      throw new CacheError('Failed to set forecast in cache', 'set');
    }
  }

  /**
   * Get geocoding data from cache
   */
  getGeocoding(city: string): { latitude: number; longitude: number } | undefined {
    try {
      const key = this.getGeocodingKey(city);
      const data = this.geocodingCache.get(key);

      if (data) {
        this.stats.geocoding.hits++;
        logger.debug('Geocoding cache hit', { city, key });
      } else {
        this.stats.geocoding.misses++;
        logger.debug('Geocoding cache miss', { city, key });
      }

      return data;
    } catch (error) {
      logger.error('Error getting geocoding from cache', { city, error });
      throw new CacheError('Failed to get geocoding from cache', 'get');
    }
  }

  /**
   * Set geocoding data in cache
   */
  setGeocoding(city: string, latitude: number, longitude: number): void {
    try {
      const key = this.getGeocodingKey(city);
      this.geocodingCache.set(key, { latitude, longitude });
      this.stats.geocoding.sets++;
      logger.debug('Geocoding cached', { city, key, latitude, longitude });
    } catch (error) {
      logger.error('Error setting geocoding in cache', { city, error });
      throw new CacheError('Failed to set geocoding in cache', 'set');
    }
  }

  /**
   * Clear all caches
   */
  clear(): void {
    try {
      this.weatherCache.clear();
      this.forecastCache.clear();
      this.geocodingCache.clear();
      logger.info('All caches cleared');
    } catch (error) {
      logger.error('Error clearing caches', { error });
      throw new CacheError('Failed to clear caches', 'clear');
    }
  }

  /**
   * Clear expired entries
   */
  purgeStale(): void {
    const weatherPurged = this.weatherCache.purgeStale();
    const forecastPurged = this.forecastCache.purgeStale();
    const geocodingPurged = this.geocodingCache.purgeStale();

    logger.info('Purged stale cache entries', {
      weather: weatherPurged,
      forecast: forecastPurged,
      geocoding: geocodingPurged,
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): Record<string, CacheStats> {
    const calculateHitRatio = (hits: number, misses: number) => {
      const total = hits + misses;
      return total > 0 ? hits / total : 0;
    };

    return {
      weather: {
        ...this.stats.weather,
        hitRatio: calculateHitRatio(this.stats.weather.hits, this.stats.weather.misses),
        size: this.weatherCache.size,
        maxSize: this.config.maxSize,
      },
      forecast: {
        ...this.stats.forecast,
        hitRatio: calculateHitRatio(this.stats.forecast.hits, this.stats.forecast.misses),
        size: this.forecastCache.size,
        maxSize: this.config.maxSize,
      },
      geocoding: {
        ...this.stats.geocoding,
        hitRatio: calculateHitRatio(this.stats.geocoding.hits, this.stats.geocoding.misses),
        size: this.geocodingCache.size,
        maxSize: this.config.maxSize * 2,
      },
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      weather: { hits: 0, misses: 0, sets: 0, deletes: 0 },
      forecast: { hits: 0, misses: 0, sets: 0, deletes: 0 },
      geocoding: { hits: 0, misses: 0, sets: 0, deletes: 0 },
    };
    logger.info('Cache statistics reset');
  }

  /**
   * Get cache info for monitoring
   */
  getInfo() {
    return {
      config: this.config,
      stats: this.getStats(),
      sizes: {
        weather: this.weatherCache.size,
        forecast: this.forecastCache.size,
        geocoding: this.geocodingCache.size,
      },
    };
  }
}

// Create singleton instance
export const weatherCache = new WeatherCache();

// Export cache utilities
export const cacheUtils = {
  /**
   * Invalidate cache for a specific city
   */
  invalidateCity(city: string): void {
    const weatherKey = `weather:${city.toLowerCase().trim()}`;
    const forecastKeyPattern = `forecast:${city.toLowerCase().trim()}`;
    const geoKey = `geo:${city.toLowerCase().trim()}`;

    // Note: LRUCache doesn't support pattern deletion, so we need to check all keys
    weatherCache['weatherCache'].delete(weatherKey);

    // Delete all forecast entries for this city
    for (const key of weatherCache['forecastCache'].keys()) {
      if (key.startsWith(forecastKeyPattern)) {
        weatherCache['forecastCache'].delete(key);
      }
    }

    weatherCache['geocodingCache'].delete(geoKey);

    logger.info('Cache invalidated for city', { city });
  },

  /**
   * Warm up cache with common cities
   */
  // eslint-disable-next-line no-unused-vars
  async warmUp(cities: string[], fetchWeather: (city: string) => Promise<WeatherData>): Promise<void> {
    logger.info('Warming up cache', { cities: cities.length });

    const promises = cities.map(async (city) => {
      try {
        const cached = weatherCache.getWeather(city);
        if (!cached) {
          const data = await fetchWeather(city);
          weatherCache.setWeather(city, data);
        }
      } catch (error) {
        logger.warn('Failed to warm up cache for city', { city, error });
      }
    });

    await Promise.all(promises);
    logger.info('Cache warm-up complete');
  },
};

