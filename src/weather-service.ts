import { WeatherData, ForecastData, GeocodingResult, WeatherAPIResponse, GeocodingAPIResponse } from './types';
import { poolManager } from './undici-resilience/index';
import { logger } from './logger-pino';
import { weatherCache } from './cache/weather-cache';
import { GeocodingError, WeatherAPIError } from './errors/weather-errors';
import { VERSION, NAME } from './utils/version';
import { Bulkhead, bulkheadManager } from './undici-resilience/resilience/bulkhead';
import { RateLimiter, rateLimiterManager } from './undici-resilience/resilience/rate-limiter';
import { RetryStrategy, RetryStrategies } from './undici-resilience/resilience/retry-strategy';

/**
 * Enhanced weather service with advanced resilience patterns
 * Features bulkhead isolation, rate limiting, and intelligent retry strategies
 */
export class WeatherService {
  private weatherBulkhead!: Bulkhead;
  private geocodingBulkhead!: Bulkhead;
  private weatherRateLimiter!: RateLimiter;
  private geocodingRateLimiter!: RateLimiter;
  private retryStrategy!: RetryStrategy;

  constructor() {
    this.setupResiliencePatterns();
  }

  /**
   * Initialize all resilience patterns
   */
  private setupResiliencePatterns(): void {
    // Weather API Bulkhead - Isolate weather requests
    this.weatherBulkhead = bulkheadManager.getBulkhead('weather-api', {
      maxConcurrent: 8,           // Max concurrent weather requests
      maxQueueSize: 50,           // Queue up to 50 weather requests
      queueTimeout: 10000         // 10 second timeout for queued requests
    });

    // Geocoding API Bulkhead - Isolate geocoding requests  
    this.geocodingBulkhead = bulkheadManager.getBulkhead('geocoding-api', {
      maxConcurrent: 5,           // Max concurrent geocoding requests
      maxQueueSize: 30,           // Queue up to 30 geocoding requests  
      queueTimeout: 8000          // 8 second timeout for queued requests
    });

    // Weather API Rate Limiter - 60 requests per minute
    this.weatherRateLimiter = rateLimiterManager.getRateLimiter('weather-api', {
      requests: 60,               // 60 requests per window
      windowMs: 60000,            // 1 minute window
      burst: 10,                  // Allow burst of 10 additional requests
      sliding: true               // Use sliding window
    });

    // Geocoding API Rate Limiter - 30 requests per minute  
    this.geocodingRateLimiter = rateLimiterManager.getRateLimiter('geocoding-api', {
      requests: 30,               // 30 requests per window
      windowMs: 60000,            // 1 minute window
      burst: 5,                   // Allow burst of 5 additional requests
      sliding: true               // Use sliding window
    });

    // Advanced Retry Strategy - Network-optimized with exponential backoff
    this.retryStrategy = new RetryStrategy({
      maxRetries: 4,              // Max 4 retry attempts
      baseDelay: 500,             // Start with 500ms delay
      maxDelay: 8000,             // Cap at 8 seconds
      jitterFactor: 0.15          // 15% jitter to prevent thundering herd
    });

    logger.info('Advanced resilience patterns initialized', {
      patterns: {
        weatherBulkhead: this.weatherBulkhead.getName(),
        geocodingBulkhead: this.geocodingBulkhead.getName(),
        weatherRateLimiter: this.weatherRateLimiter.getName(),
        geocodingRateLimiter: this.geocodingRateLimiter.getName(),
        retryStrategy: 'network-optimized'
      }
    });
  }

  /**
   * Get resilience statistics for monitoring
   */
  getResilienceStats() {
    return {
      bulkheads: {
        weather: this.weatherBulkhead.getStats(),
        geocoding: this.geocodingBulkhead.getStats()
      },
      rateLimiters: {
        weather: this.weatherRateLimiter.getStats(),
        geocoding: this.geocodingRateLimiter.getStats()
      },
      retryConfig: this.retryStrategy.getConfig()
    };
  }
  /**
   * Get current weather for a city
   */
  async getCurrentWeather(city: string): Promise<WeatherData> {
    const startTime = Date.now();

    // Input validation (outside try-catch to preserve validation errors)
    if (!city || typeof city !== 'string' || city.trim() === '') {
      logger.error('Invalid city parameter for current weather', { city });
      throw new Error('Invalid city parameter: city must be a non-empty string');
    }

    try {

      const trimmedCity = city.trim();

      // Check cache first
      const cached = weatherCache.getWeather(trimmedCity);
      if (cached) {
        logger.info('Returning cached weather data', { city: trimmedCity });
        logger.logPerformance('getCurrentWeather-cached', startTime, { city: trimmedCity });
        return cached;
      }

      // Geocode the city to get coordinates with full resilience stack
      logger.debug('Geocoding city for current weather', { city: trimmedCity });
      const geoResult = await this.geocodeCityWithResilience(trimmedCity);

      // Fetch current weather data with full resilience stack
      const apiResponse = await this.fetchWeatherDataWithResilience(
        geoResult.latitude,
        geoResult.longitude,
        'current',
        `getCurrentWeather-${trimmedCity}`
      );

      if (!apiResponse.current) {
        throw new Error('No current weather data available');
      }

      const weatherResult: WeatherData = {
        location: geoResult.name,
        temperature: Math.round(apiResponse.current.temperature_2m * 10) / 10, // Round to 1 decimal
        description: this.mapWeatherCode(apiResponse.current.weather_code),
        humidity: apiResponse.current.relative_humidity_2m,
        windSpeed: Math.round(apiResponse.current.wind_speed_10m * 10) / 10,
        feelsLike: Math.round(apiResponse.current.temperature_2m * 10) / 10, // Simplified calculation
        pressure: 1013.25, // Default pressure (Open-Meteo doesn't provide current pressure)
        timestamp: apiResponse.current.time
      };

      // Cache the result
      weatherCache.setWeather(trimmedCity, weatherResult);

      logger.logPerformance('getCurrentWeather', startTime, {
        city: trimmedCity,
        location: geoResult.name,
        temperature: weatherResult.temperature
      });

      return weatherResult;

    } catch (error) {
      logger.logError(error as Error, { city, operation: 'getCurrentWeather' });
      if (error instanceof Error && error.message.includes('City not found')) {
        throw new GeocodingError(error.message, city);
      }
      throw new WeatherAPIError('Failed to get current weather', 'current', error as Error);
    }
  }

  /**
   * Get weather forecast for a city
   */
  async getForecast(city: string, days: number = 5): Promise<ForecastData> {
    const startTime = Date.now();

    // Input validation (outside try-catch to preserve validation errors)
    if (!city || typeof city !== 'string' || city.trim() === '') {
      logger.error('Invalid city parameter for forecast', { city });
      throw new Error('Invalid city parameter: city must be a non-empty string');
    }

    if (days < 1 || days > 7) {
      logger.error('Invalid days parameter for forecast', { days });
      throw new Error('Days must be between 1 and 7');
    }

    try {

      const trimmedCity = city.trim();

      // Check cache first
      const cached = weatherCache.getForecast(trimmedCity, days);
      if (cached) {
        logger.info('Returning cached forecast data', { city: trimmedCity, days });
        logger.logPerformance('getForecast-cached', startTime, { city: trimmedCity, days });
        return cached;
      }

      // Geocode the city to get coordinates with full resilience stack
      logger.debug('Geocoding city for forecast', { city: trimmedCity, days });
      const geoResult = await this.geocodeCityWithResilience(trimmedCity);

      // Fetch forecast data with full resilience stack
      const forecastResponse = await this.fetchWeatherDataWithResilience(
        geoResult.latitude,
        geoResult.longitude,
        'forecast',
        `getForecast-${trimmedCity}`,
        days
      );

      const data = forecastResponse;

      if (!data.daily) {
        throw new Error('No forecast data available');
      }

      const forecasts = data.daily!.time.slice(0, days).map((time: string, i: number) => ({
        date: new Date(time).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        }),
        temperature: Math.round(data.daily!.temperature_2m_max[i] * 10) / 10,
        temperatureMin: Math.round(data.daily!.temperature_2m_min[i] * 10) / 10,
        description: this.mapWeatherCode(data.daily!.weather_code[i]),
        humidity: Math.round(data.daily!.relative_humidity_2m_mean[i]),
        windSpeed: data.daily!.wind_speed_10m_max ? Math.round(data.daily!.wind_speed_10m_max[i] * 10) / 10 : undefined,
        precipitation: data.daily!.precipitation_sum ? Math.round(data.daily!.precipitation_sum[i] * 10) / 10 : undefined
      }));

      const forecastData: ForecastData = {
        location: geoResult.name,
        forecasts
      };

      // Cache the result
      weatherCache.setForecast(trimmedCity, days, forecastData);

      logger.logPerformance('getForecast', startTime, {
        city: trimmedCity,
        location: geoResult.name,
        days,
        forecastCount: forecasts.length
      });

      return forecastData;

    } catch (error) {
      logger.logError(error as Error, { city, days, operation: 'getForecast' });
      if (error instanceof Error && error.message.includes('City not found')) {
        throw new GeocodingError(error.message, city);
      }
      throw new WeatherAPIError('Failed to get forecast', 'forecast', error as Error);
    }
  }

  /**
   * Geocode city with full resilience stack (rate limiting + bulkhead + retry)
   */
  private async geocodeCityWithResilience(city: string): Promise<GeocodingResult> {
    // Check cache first
    const cached = weatherCache.getGeocoding(city);
    if (cached) {
      logger.debug('Using cached geocoding data', { city });
      return {
        name: city,
        latitude: cached.latitude,
        longitude: cached.longitude,
        country: '',
        region: ''
      };
    }

    // Apply full resilience stack: Rate Limiter → Bulkhead → Retry → Pool Manager
    return await this.geocodingRateLimiter.execute(async () => {
      return await this.geocodingBulkhead.execute(async () => {
        return await this.retryStrategy.execute(async () => {
          logger.debug('Making geocoding API call with resilience patterns', { city });
          
          const geocodingResponse = await poolManager.request<GeocodingAPIResponse>(
            'geocoding',
            {
              path: `/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
              method: 'GET',
              headers: {
                'User-Agent': `${NAME}/${VERSION}`
              }
            },
            `geocodeCity-resilient-${city}`
          );

          if (!geocodingResponse.results || geocodingResponse.results.length === 0) {
            throw new GeocodingError(`City not found: ${city}`, city);
          }

          const result = geocodingResponse.results[0];
          const geoResult: GeocodingResult = {
            name: result.name,
            latitude: result.latitude,
            longitude: result.longitude,
            country: result.country,
            region: result.admin1
          };

          // Cache the geocoding result
          weatherCache.setGeocoding(city, geoResult.latitude, geoResult.longitude);

          logger.debug('Geocoding successful with resilience', {
            city,
            result: geoResult.name,
            coordinates: `${geoResult.latitude}, ${geoResult.longitude}`
          });

          return geoResult;
        }, `geocoding-${city}`);
      });
    });
  }

  /**
   * Fetch weather data with full resilience stack (rate limiting + bulkhead + retry)
   */
  private async fetchWeatherDataWithResilience(
    latitude: number,
    longitude: number,
    type: 'current' | 'forecast',
    context: string,
    days?: number
  ): Promise<WeatherAPIResponse> {
    // Apply full resilience stack: Rate Limiter → Bulkhead → Retry → Pool Manager
    return await this.weatherRateLimiter.execute(async () => {
      return await this.weatherBulkhead.execute(async () => {
        return await this.retryStrategy.execute(async () => {
          logger.debug('Making weather API call with resilience patterns', { 
            latitude, 
            longitude, 
            type, 
            context 
          });

          let path: string;
          if (type === 'current') {
            path = `/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`;
          } else {
            path = `/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code,relative_humidity_2m_mean,precipitation_sum,wind_speed_10m_max&forecast_days=${days || 5}`;
          }

          const weatherResponse = await poolManager.request<WeatherAPIResponse>(
            'weather',
            {
              path,
              method: 'GET',
              headers: {
                'User-Agent': `${NAME}/${VERSION}`
              }
            },
            `${context}-resilient`
          );

          logger.debug('Weather API call successful with resilience', {
            type,
            context,
            hasData: type === 'current' ? !!weatherResponse.current : !!weatherResponse.daily
          });

          return weatherResponse;
        }, `weather-${type}-${context}`);
      });
    });
  }

  /**
   * Legacy geocode method (kept for compatibility with getForecast)
   */
  private async geocodeCity(city: string): Promise<GeocodingResult> {
    try {
      // Check cache first
      const cached = weatherCache.getGeocoding(city);
      if (cached) {
        logger.debug('Using cached geocoding data', { city });
        return {
          name: city,
          latitude: cached.latitude,
          longitude: cached.longitude,
          country: '',
          region: ''
        };
      }

      // Fetch geocoding data using optimized pool
      const geocodingResponse = await poolManager.request<GeocodingAPIResponse>(
        'geocoding',
        {
          path: `/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
          method: 'GET',
          headers: {
            'User-Agent': `${NAME}/${VERSION}`
          }
        },
        `geocodeCity-${city}`
      );

      if (!geocodingResponse.results || geocodingResponse.results.length === 0) {
        throw new GeocodingError(`City not found: ${city}`, city);
      }

      const result = geocodingResponse.results[0];
      const geoResult: GeocodingResult = {
        name: result.name,
        latitude: result.latitude,
        longitude: result.longitude,
        country: result.country,
        region: result.admin1
      };

      // Cache the geocoding result
      weatherCache.setGeocoding(city, geoResult.latitude, geoResult.longitude);

      logger.debug('Geocoding successful', {
        city,
        result: geoResult.name,
        coordinates: `${geoResult.latitude}, ${geoResult.longitude}`
      });

      return geoResult;

    } catch (error) {
      logger.logError(error as Error, { city, operation: 'geocodeCity' });
      throw error;
    }
  }

  /**
   * Map Open-Meteo weather codes to human-readable descriptions
   */
  private mapWeatherCode(code: number): string {
    const weatherCodes: { [key: number]: string } = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      56: 'Light freezing drizzle',
      57: 'Dense freezing drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      66: 'Light freezing rain',
      67: 'Heavy freezing rain',
      71: 'Slight snow fall',
      73: 'Moderate snow fall',
      75: 'Heavy snow fall',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail'
    };

    return weatherCodes[code] || 'Unknown weather condition';
  }

}
