import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WeatherService } from './weather-service.js';
import { logger } from './logger-pino.js';
import { createValidationMiddleware } from './middleware/validation.js';
import { VERSION, NAME } from './utils/version.js';
import { z } from 'zod';

/**
 * Weather MCP Server
 * Implements the Model Context Protocol for weather information using latest SDK patterns
 * Supports current weather, forecasts, and agentic RAG queries
 */
export class WeatherMCPServer {
  private mcpServer: McpServer;
  private weatherService: WeatherService;
  private validateRequest: ReturnType<typeof createValidationMiddleware>;

  constructor() {
    this.weatherService = new WeatherService();
    this.validateRequest = createValidationMiddleware('stdio'); // Default to stdio

    // Initialize MCP server with modern SDK
    this.mcpServer = new McpServer({
      name: NAME,
      version: VERSION
    });

    this.setupTools();
    this.setupErrorHandling();

    logger.info('Weather MCP Server initialized with modern SDK', {
      name: NAME,
      version: VERSION,
      protocolVersion: '2025-06-18'
    });
  }


  /**
   * Format weather data for display
   */
  private formatWeatherText(weather: any): string {
    return `Weather in ${weather.location}:\n` +
           `• Temperature: ${weather.temperature}°C\n` +
           `• Condition: ${weather.description}\n` +
           `• Humidity: ${weather.humidity}%\n` +
           `• Wind Speed: ${weather.windSpeed} m/s\n` +
           `• Feels Like: ${weather.feelsLike}°C\n` +
           `• Pressure: ${weather.pressure} hPa` +
           (weather.timestamp ? `\n• Last Updated: ${new Date(weather.timestamp).toLocaleString()}` : '');
  }

  /**
   * Format forecast data for display
   */
  private formatForecastText(forecast: any, days: number): string {
    const forecastText = forecast.forecasts
      .map((f: any) =>
        `${f.date}: ${f.temperature}°C (${f.temperatureMin}°C - ${f.temperatureMax}°C), ${f.description}, Humidity: ${f.humidity}%` +
        (f.windSpeed ? `, Wind: ${f.windSpeed} m/s` : '') +
        (f.precipitation ? `, Precipitation: ${f.precipitation} mm` : '')
      )
      .join('\n');

    return `${days}-day weather forecast for ${forecast.location}:\n\n${forecastText}`;
  }

  /**
   * Format weather context for AI queries
   */
  private formatWeatherContext(weather: any, query: string): string {
    return `Weather context for "${query}":\n\n` +
           `Location: ${weather.location}\n` +
           `Current Temperature: ${weather.temperature}°C\n` +
           `Conditions: ${weather.description}\n` +
           `Humidity: ${weather.humidity}%\n` +
           `Wind Speed: ${weather.windSpeed} m/s\n\n` +
           `This information can be used for travel planning, activity suggestions, or general weather awareness.`;
  }

  /**
   * Extract city from natural language query
   */
  private extractCityFromQuery(query: string): string {
    const cityMatch = query.match(/(?:weather\s+(?:like\s+)?in\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)|in\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)|for\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)|weather\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?))/i);

    if (!cityMatch) {
      throw new Error('No city found in query. Please include a city name in your query.');
    }

    return (cityMatch[1] || cityMatch[2] || cityMatch[3] || cityMatch[4]).trim();
  }

  /**
   * Set up tools using modern MCP SDK patterns
   */
  private setupTools(): void {
    // Register get_current_weather tool
    this.mcpServer.registerTool(
      'get_current_weather',
      {
        title: 'Current Weather',
        description: 'Get current weather for a city using Open-Meteo API',
        inputSchema: {
          city: z.string().min(1).describe('City name (e.g., "London", "New York", "Tokyo")')
        }
      },
      async ({ city }) => {
        const startTime = Date.now();
        logger.logToolCall('get_current_weather', { city });

        try {
          const weather = await this.weatherService.getCurrentWeather(city.trim());
          
          logger.logPerformance('tool_get_current_weather', startTime, {
            success: true,
            city: city.trim()
          });

          return {
            content: [{
              type: 'text',
              text: this.formatWeatherText(weather)
            }]
          };
        } catch (error) {
          logger.logError(error as Error, {
            tool: 'get_current_weather',
            city,
            duration: Date.now() - startTime
          });
          throw error;
        }
      }
    );

    // Register get_weather_forecast tool
    this.mcpServer.registerTool(
      'get_weather_forecast',
      {
        title: 'Weather Forecast',
        description: 'Get weather forecast for a city (1-7 days)',
        inputSchema: {
          city: z.string().min(1).describe('City name'),
          days: z.number().min(1).max(7).default(5).describe('Number of days for forecast (1-7)')
        }
      },
      async ({ city, days = 5 }) => {
        const startTime = Date.now();
        logger.logToolCall('get_weather_forecast', { city, days });

        try {
          const forecast = await this.weatherService.getForecast(city.trim(), days);
          
          logger.logPerformance('tool_get_weather_forecast', startTime, {
            success: true,
            city: city.trim(),
            days
          });

          return {
            content: [{
              type: 'text',
              text: this.formatForecastText(forecast, days)
            }]
          };
        } catch (error) {
          logger.logError(error as Error, {
            tool: 'get_weather_forecast',
            city,
            days,
            duration: Date.now() - startTime
          });
          throw error;
        }
      }
    );

    // Register retrieve_weather_context tool
    this.mcpServer.registerTool(
      'retrieve_weather_context',
      {
        title: 'Weather Context Retriever',
        description: 'Retrieve weather context for AI agent queries',
        inputSchema: {
          query: z.string().min(1).describe('Query containing city reference (e.g., "weather in London for travel")')
        }
      },
      async ({ query }) => {
        const startTime = Date.now();
        logger.logToolCall('retrieve_weather_context', { query });

        try {
          const city = this.extractCityFromQuery(query.trim());
          const weather = await this.weatherService.getCurrentWeather(city);
          
          logger.logPerformance('tool_retrieve_weather_context', startTime, {
            success: true,
            query: query.trim(),
            extractedCity: city
          });

          return {
            content: [{
              type: 'text',
              text: this.formatWeatherContext(weather, query.trim())
            }]
          };
        } catch (error) {
          logger.logError(error as Error, {
            tool: 'retrieve_weather_context',
            query,
            duration: Date.now() - startTime
          });
          throw error;
        }
      }
    );

    logger.info('Weather tools registered successfully', { toolCount: 3 });
  }

  /**
   * Set up error handling
   */
  private setupErrorHandling(): void {
    // Skip setting up process event handlers in test environment
    // to avoid MaxListenersExceededWarning
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    // Handle uncaught exceptions in tool handlers
    process.on('uncaughtException', (error) => {
      logger.logError(error, { type: 'uncaughtException' });
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.logError(reason as Error, {
        type: 'unhandledRejection',
        promise: promise.toString()
      });
    });
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    logger.info('Starting graceful shutdown');

    try {
      // Close any open connections or resources
      // (Add cleanup logic here if needed)

      logger.info('Graceful shutdown completed');
    } catch (error) {
      logger.logError(error as Error, { operation: 'gracefulShutdown' });
    }
  }

  /**
   * Get the underlying MCP server instance
   */
  public getServer(): McpServer {
    return this.mcpServer;
  }

  /**
   * Get server statistics
   */
  public getStats() {
    return {
      serverName: NAME,
      version: VERSION,
      protocolVersion: '2025-06-18',
      toolsCount: 3,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }
}
