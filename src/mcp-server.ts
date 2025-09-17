import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { WeatherService } from './weather-service';
import { logger } from './logger-pino';
import { createValidationMiddleware } from './middleware/validation';
import { VERSION, NAME } from './utils/version';
import { z } from 'zod';
import { securityManager } from './security/sanitizer';
import { securityMonitor } from './security/security-monitor';
import { auditLogger } from './audit/audit-logger';

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
          city: z.string().describe('City name (e.g., "London", "New York", "Tokyo")')
        }
      },
      async ({ city }) => {
        const startTime = Date.now();
        const toolName = 'get_current_weather';
        
        // Security: Sanitize and validate input
        const sanitizedInput = securityManager.sanitizeInput({ city });
        const cleanCity = securityManager.sanitizeCityName(sanitizedInput.city);
        
        if (!cleanCity) {
          // Audit: Log failed validation
          auditLogger.logDataAccess('read', 'weather_data', 'failure', undefined, {
            method: toolName,
            statusCode: 400,
            duration: Date.now() - startTime,
            error: 'Invalid city name',
            metadata: { originalInput: city, sanitizedInput }
          });
          
          // Security: Log potential attack pattern
          if (securityManager.containsAttackPatterns(city)) {
            auditLogger.logSecurity('malicious_input_detected', 'weather_tools', 'success', 'high', undefined, {
              metadata: { tool: toolName, input: city, reason: 'attack_patterns_detected' }
            });
          }
          
          throw new Error('Invalid city name provided');
        }

        logger.logToolCall(toolName, { city: cleanCity });

        try {
          // Audit: Log data access attempt
          auditLogger.logDataAccess('read', 'weather_data', 'success', undefined, {
            method: toolName,
            payload: { city: cleanCity },
            metadata: { requestType: 'current_weather' }
          });

          const weather = await this.weatherService.getCurrentWeather(cleanCity);
          
          // Audit: Log successful API usage
          auditLogger.logApiUsage('POST', `/tools/${toolName}`, 200, Date.now() - startTime, undefined, {
            payload: { city: cleanCity },
            metadata: { responseSize: JSON.stringify(weather).length }
          });
          
          logger.logPerformance(`tool_${toolName}`, startTime, {
            success: true,
            city: cleanCity
          });

          return {
            content: [{
              type: 'text',
              text: this.formatWeatherText(weather)
            }]
          };
        } catch (error) {
          // Audit: Log error
          auditLogger.logDataAccess('read', 'weather_data', 'error', undefined, {
            method: toolName,
            statusCode: 500,
            duration: Date.now() - startTime,
            error: (error as Error).message,
            payload: { city: cleanCity }
          });
          
          logger.logError(error as Error, {
            tool: toolName,
            city: cleanCity,
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
          city: z.string().describe("City name"),
          days: z.number().default(5).describe("Number of days for forecast (1-7)")
        }
      },
      async ({ city, days = 5 }) => {
        const startTime = Date.now();
        const toolName = 'get_weather_forecast';
        
        // Security: Sanitize and validate inputs
        const sanitizedInput = securityManager.sanitizeInput({ city, days });
        const cleanCity = securityManager.sanitizeCityName(sanitizedInput.city);
        
        if (!cleanCity) {
          // Audit: Log failed validation
          auditLogger.logDataAccess('read', 'weather_forecast', 'failure', undefined, {
            method: toolName,
            statusCode: 400,
            duration: Date.now() - startTime,
            error: 'Invalid city name',
            metadata: { originalInput: city, sanitizedInput, days }
          });
          
          // Security: Log potential attack pattern
          if (securityManager.containsAttackPatterns(city)) {
            auditLogger.logSecurity('malicious_input_detected', 'weather_tools', 'success', 'high', undefined, {
              metadata: { tool: toolName, input: city, reason: 'attack_patterns_detected' }
            });
          }
          
          throw new Error('Invalid city name provided');
        }

        // Validate days parameter
        const cleanDays = Math.max(1, Math.min(7, Math.floor(sanitizedInput.days || 5)));

        logger.logToolCall(toolName, { city: cleanCity, days: cleanDays });

        try {
          // Audit: Log data access attempt
          auditLogger.logDataAccess('read', 'weather_forecast', 'success', undefined, {
            method: toolName,
            payload: { city: cleanCity, days: cleanDays },
            metadata: { requestType: 'forecast' }
          });

          const forecast = await this.weatherService.getForecast(cleanCity, cleanDays);
          
          // Audit: Log successful API usage
          auditLogger.logApiUsage('POST', `/tools/${toolName}`, 200, Date.now() - startTime, undefined, {
            payload: { city: cleanCity, days: cleanDays },
            metadata: { responseSize: JSON.stringify(forecast).length }
          });
          
          logger.logPerformance(`tool_${toolName}`, startTime, {
            success: true,
            city: cleanCity,
            days: cleanDays
          });

          return {
            content: [{
              type: 'text',
              text: this.formatForecastText(forecast, cleanDays)
            }]
          };
        } catch (error) {
          // Audit: Log error
          auditLogger.logDataAccess('read', 'weather_forecast', 'error', undefined, {
            method: toolName,
            statusCode: 500,
            duration: Date.now() - startTime,
            error: (error as Error).message,
            payload: { city: cleanCity, days: cleanDays }
          });
          
          logger.logError(error as Error, {
            tool: toolName,
            city: cleanCity,
            days: cleanDays,
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
          query: z.string().describe('Query containing city reference (e.g., "weather in London for travel")')
        }
      },
      async ({ query }) => {
        const startTime = Date.now();
        const toolName = 'retrieve_weather_context';
        
        // Security: Sanitize and validate input
        const sanitizedInput = securityManager.sanitizeInput({ query });
        const cleanQuery = securityManager.sanitizeString(sanitizedInput.query);
        
        if (!cleanQuery || cleanQuery.length < 3) {
          // Audit: Log failed validation
          auditLogger.logDataAccess('read', 'weather_context', 'failure', undefined, {
            method: toolName,
            statusCode: 400,
            duration: Date.now() - startTime,
            error: 'Invalid query',
            metadata: { originalInput: query, sanitizedInput }
          });
          
          throw new Error('Invalid or too short query provided');
        }

        // Security: Check for attack patterns in query
        if (securityManager.containsAttackPatterns(cleanQuery)) {
          auditLogger.logSecurity('malicious_input_detected', 'weather_tools', 'success', 'high', undefined, {
            metadata: { tool: toolName, input: query, reason: 'attack_patterns_detected' }
          });
          throw new Error('Query contains suspicious patterns');
        }

        logger.logToolCall(toolName, { query: cleanQuery });

        try {
          // Extract city using sanitized query
          const city = this.extractCityFromQuery(cleanQuery);
          const cleanCity = securityManager.sanitizeCityName(city);
          
          if (!cleanCity) {
            // Audit: Log city extraction failure
            auditLogger.logDataAccess('read', 'weather_context', 'failure', undefined, {
              method: toolName,
              statusCode: 400,
              duration: Date.now() - startTime,
              error: 'No valid city found in query',
              metadata: { query: cleanQuery, extractedCity: city }
            });
            throw new Error('No valid city found in query');
          }

          // Audit: Log data access attempt
          auditLogger.logDataAccess('read', 'weather_context', 'success', undefined, {
            method: toolName,
            payload: { query: cleanQuery, city: cleanCity },
            metadata: { requestType: 'context_retrieval' }
          });

          const weather = await this.weatherService.getCurrentWeather(cleanCity);
          
          // Audit: Log successful API usage
          auditLogger.logApiUsage('POST', `/tools/${toolName}`, 200, Date.now() - startTime, undefined, {
            payload: { query: cleanQuery, city: cleanCity },
            metadata: { responseSize: JSON.stringify(weather).length }
          });
          
          logger.logPerformance(`tool_${toolName}`, startTime, {
            success: true,
            query: cleanQuery,
            extractedCity: cleanCity
          });

          return {
            content: [{
              type: 'text',
              text: this.formatWeatherContext(weather, cleanQuery)
            }]
          };
        } catch (error) {
          // Audit: Log error
          auditLogger.logDataAccess('read', 'weather_context', 'error', undefined, {
            method: toolName,
            statusCode: 500,
            duration: Date.now() - startTime,
            error: (error as Error).message,
            payload: { query: cleanQuery }
          });
          
          logger.logError(error as Error, {
            tool: toolName,
            query: cleanQuery,
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
