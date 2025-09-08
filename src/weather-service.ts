import fetch from 'node-fetch';
import { WeatherData, ForecastData, GeocodingResult, WeatherAPIResponse, GeocodingAPIResponse } from './types.js';
import { getAPIConfig } from './config/config.js';
import { logger } from './logger.js';

/**
 * Weather service that integrates with Open-Meteo API
 * Provides current weather and forecast functionality
 */
export class WeatherService {
  private apiConfig = getAPIConfig();

  /**
   * Get current weather for a city
   */
  async getCurrentWeather(city: string): Promise<WeatherData> {
    const startTime = Date.now();

    try {
      // Input validation
      if (!city || typeof city !== 'string' || city.trim() === '') {
        logger.error({ city }, 'Invalid city parameter for current weather');
        throw new Error('Invalid city parameter: city must be a non-empty string');
      }

      const trimmedCity = city.trim();

      // Geocode the city to get coordinates
      logger.debug({ city: trimmedCity }, 'Geocoding city for current weather');
      const geoResult = await this.geocodeCity(trimmedCity);

      // Fetch current weather data
      logger.logAPIRequest(
        `${this.apiConfig.openMeteoBaseUrl}/forecast`,
        'GET',
        { latitude: geoResult.latitude, longitude: geoResult.longitude }
      );

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.apiConfig.timeout);

      const response = await fetch(
        `${this.apiConfig.openMeteoBaseUrl}/forecast?latitude=${geoResult.latitude}&longitude=${geoResult.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`,
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'MCP-Weather-Server/1.0.0'
          }
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.logAPIResponse(
          `${this.apiConfig.openMeteoBaseUrl}/forecast`,
          response.status,
          Date.now() - startTime,
          `HTTP ${response.status}`
        );
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as WeatherAPIResponse;

      logger.logAPIResponse(
        `${this.apiConfig.openMeteoBaseUrl}/forecast`,
        response.status,
        Date.now() - startTime
      );

      if (!data.current) {
        throw new Error('No current weather data available');
      }

      const weatherData: WeatherData = {
        location: geoResult.name,
        temperature: Math.round(data.current.temperature_2m * 10) / 10, // Round to 1 decimal
        description: this.mapWeatherCode(data.current.weather_code),
        humidity: data.current.relative_humidity_2m,
        windSpeed: Math.round(data.current.wind_speed_10m * 10) / 10,
        feelsLike: Math.round(data.current.temperature_2m * 10) / 10, // Simplified calculation
        pressure: 1013.25, // Default pressure (Open-Meteo doesn't provide current pressure)
        timestamp: data.current.time
      };

      logger.logPerformance('getCurrentWeather', startTime, {
        city: trimmedCity,
        location: geoResult.name,
        temperature: weatherData.temperature
      });

      return weatherData;

    } catch (error) {
      logger.logError(error as Error, { city, operation: 'getCurrentWeather' });
      throw error;
    }
  }

  /**
   * Get weather forecast for a city
   */
  async getForecast(city: string, days: number = 5): Promise<ForecastData> {
    const startTime = Date.now();

    try {
      // Input validation
      if (!city || typeof city !== 'string' || city.trim() === '') {
        logger.error({ city }, 'Invalid city parameter for forecast');
        throw new Error('Invalid city parameter: city must be a non-empty string');
      }

      if (days < 1 || days > 7) {
        logger.error({ days }, 'Invalid days parameter for forecast');
        throw new Error('Days must be between 1 and 7');
      }

      const trimmedCity = city.trim();

      // Geocode the city to get coordinates
      logger.debug({ city: trimmedCity, days }, 'Geocoding city for forecast');
      const geoResult = await this.geocodeCity(trimmedCity);

      // Fetch forecast data
      const forecastUrl = `${this.apiConfig.openMeteoBaseUrl}/forecast?latitude=${geoResult.latitude}&longitude=${geoResult.longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code,relative_humidity_2m_mean,precipitation_sum,wind_speed_10m_max&forecast_days=${days}`;

      logger.logAPIRequest(forecastUrl, 'GET', {
        latitude: geoResult.latitude,
        longitude: geoResult.longitude,
        days
      });

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.apiConfig.timeout);

      const response = await fetch(forecastUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'MCP-Weather-Server/1.0.0'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.logAPIResponse(
          forecastUrl,
          response.status,
          Date.now() - startTime,
          `HTTP ${response.status}`
        );
        throw new Error(`Forecast API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as WeatherAPIResponse;

      logger.logAPIResponse(forecastUrl, response.status, Date.now() - startTime);

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

      logger.logPerformance('getForecast', startTime, {
        city: trimmedCity,
        location: geoResult.name,
        days,
        forecastCount: forecasts.length
      });

      return forecastData;

    } catch (error) {
      logger.logError(error as Error, { city, days, operation: 'getForecast' });
      throw error;
    }
  }

  /**
   * Geocode a city name to get coordinates
   */
  private async geocodeCity(city: string): Promise<GeocodingResult> {
    const geoStartTime = Date.now();

    try {
      const geoUrl = `${this.apiConfig.geocodingApiUrl}/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

      logger.logAPIRequest(geoUrl, 'GET', { city });

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.apiConfig.timeout);

      const response = await fetch(geoUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'MCP-Weather-Server/1.0.0'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.logAPIResponse(
          geoUrl,
          response.status,
          Date.now() - geoStartTime,
          `HTTP ${response.status}`
        );
        throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as GeocodingAPIResponse;

      logger.logAPIResponse(geoUrl, response.status, Date.now() - geoStartTime);

      if (!data.results || data.results.length === 0) {
        throw new Error(`City not found: ${city}`);
      }

      const result = data.results[0];
      const geoResult: GeocodingResult = {
        name: result.name,
        latitude: result.latitude,
        longitude: result.longitude,
        country: result.country,
        region: result.admin1
      };

      logger.debug({
        city,
        result: geoResult.name,
        coordinates: `${geoResult.latitude}, ${geoResult.longitude}`
      }, 'Geocoding successful');

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

  /**
   * Retry mechanism for API calls
   */
  private async retryAPIRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = this.apiConfig.retries,
    delay: number = this.apiConfig.retryDelay
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          break;
        }

        logger.warn({
          attempt,
          maxRetries,
          delay,
          error: lastError.message
        }, `API request failed, retrying in ${delay}ms`);

        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }

    throw lastError!;
  }
}
