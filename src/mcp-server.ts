import { Server } from '@modelcontextprotocol/sdk/server';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WeatherService } from './weather-service.js';
import { logger } from './logger-pino.js';
import { MCPTool } from './types.js';
import { createValidationMiddleware } from './middleware/validation.js';
import { VERSION, NAME } from './utils/version.js';

/**
 * Weather MCP Server
 * Implements the Model Context Protocol for weather information
 * Supports current weather, forecasts, and agentic RAG queries
 */
export class WeatherMCPServer {
  private server: Server;
  private weatherService: WeatherService;
  private validateRequest: ReturnType<typeof createValidationMiddleware>;

  constructor() {
    this.weatherService = new WeatherService();
    this.validateRequest = createValidationMiddleware('stdio'); // Default to stdio

    // Initialize MCP server with configuration
    this.server = new Server(
      {
        name: NAME,
        version: VERSION
      },
      {
        capabilities: {
          tools: { listChanged: true },
          logging: {}
        }
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();

    logger.info('Weather MCP Server initialized', {
      name: 'weather-mcp-server',
      version: '1.0.0',
      protocolVersion: '2025-06-18'
    });
  }

  /**
   * Process MCP messages directly
   * This method handles all MCP protocol messages
   */
  async processMessage(message: any): Promise<any> {
    const startTime = Date.now();

    try {
      // Validate the incoming request
      await this.validateRequest(message);
      
      logger.debug('Processing MCP message', { method: message.method, id: message.id });

      switch (message.method) {
        case 'initialize':
          return await this.handleInitialize(message);

        case 'notifications/initialized':
          return await this.handleInitialized(message);

        case 'shutdown':
          return await this.handleShutdown(message);

        case 'tools/list':
          return await this.handleToolsList(message);

        case 'tools/call':
          return await this.handleToolsCall(message);

        default:
          logger.logMCPError(-32601, `Method '${message.method}' not found`);
          return {
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32601,
              message: `Method '${message.method}' not found`
            }
          };
      }
    } catch (error) {
      logger.logError(error as Error, {
        method: message.method,
        id: message.id,
        duration: Date.now() - startTime
      });

      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: { details: (error as Error).message }
        }
      };
    }
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(message: any): Promise<any> {
    const { protocolVersion, capabilities, clientInfo } = message.params || {};

    logger.logMCPLifecycle('initialize', {
      clientInfo,
      protocolVersion,
      capabilities
    });

    // Validate protocol version - accept both current and older versions for compatibility
    const supportedVersions = ['2025-06-18', '2025-03-26'];
    if (!supportedVersions.includes(protocolVersion)) {
      logger.logMCPError(-32602, 'Unsupported protocol version', {
        requested: protocolVersion,
        supported: supportedVersions
      });

      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32602,
          message: 'Unsupported protocol version',
          data: {
            supported: supportedVersions,
            requested: protocolVersion
          }
        }
      };
    }

    // Return server capabilities and information
    // Echo back the client's protocol version for compatibility
    const response = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: protocolVersion,
        capabilities: {
          tools: { listChanged: true },
          logging: {}
        },
        serverInfo: {
          name: NAME,
          title: 'Weather MCP Server',
          version: VERSION,
          description: 'MCP server providing weather information using Open-Meteo API'
        }
      }
    };

    logger.logMCPLifecycle('initialize_response', {
      protocolVersion: response.result.protocolVersion,
      capabilities: response.result.capabilities
    });

    return response;
  }

  /**
   * Handle initialized notification
   */
  private async handleInitialized(_message: any): Promise<any> {
    logger.logMCPLifecycle('initialized_notification');
    // Notifications don't require a response
    return null;
  }

  /**
   * Handle shutdown request
   */
  private async handleShutdown(message: any): Promise<any> {
    logger.logMCPLifecycle('shutdown');
    await this.gracefulShutdown();

    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {}
    };
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(message: any): Promise<any> {
    logger.debug('Listing available tools');

    const tools: MCPTool[] = [
      {
        name: 'get_current_weather',
        description: 'Get current weather for a city using Open-Meteo API',
        inputSchema: {
          type: 'object',
          properties: {
            city: {
              type: 'string',
              description: 'City name (e.g., "London", "New York", "Tokyo")'
            }
          },
          required: ['city']
        }
      },
      {
        name: 'get_weather_forecast',
        description: 'Get weather forecast for a city (1-7 days)',
        inputSchema: {
          type: 'object',
          properties: {
            city: {
              type: 'string',
              description: 'City name'
            },
            days: {
              type: 'number',
              description: 'Number of days for forecast (1-7)',
              minimum: 1,
              maximum: 7,
              default: 5
            }
          },
          required: ['city']
        }
      },
      {
        name: 'retrieve_weather_context',
        description: 'Retrieve weather context for AI agent queries',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query containing city reference (e.g., "weather in London for travel")'
            }
          },
          required: ['query']
        }
      }
    ];

    logger.debug('Tools listed successfully', { toolCount: tools.length });

    return {
      jsonrpc: '2.0',
      id: message.id,
      result: { tools }
    };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolsCall(message: any): Promise<any> {
    const { name, arguments: args } = message.params || {};
    const startTime = Date.now();

    logger.logToolCall(name, args);

    try {
      let result: any;

      switch (name) {
        case 'get_current_weather':
          result = await this.handleGetCurrentWeather(args);
          break;

        case 'get_weather_forecast':
          result = await this.handleGetWeatherForecast(args);
          break;

        case 'retrieve_weather_context':
          result = await this.handleRetrieveWeatherContext(args);
          break;

        default:
          logger.logMCPError(-32601, `Unknown tool: ${name}`);
          return {
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32601,
              message: `Unknown tool: ${name}`
            }
          };
      }

      logger.logPerformance(`tool_${name}`, startTime, {
        success: true,
        args
      });

      return {
        jsonrpc: '2.0',
        id: message.id,
        result
      };

    } catch (error) {
      logger.logError(error as Error, {
        tool: name,
        args,
        duration: Date.now() - startTime
      });

      // Return appropriate MCP error response
      const err = error as Error;
      let errorCode = -32603; // Internal error
      let errorMessage = `Tool execution failed: ${err.message}`;

      if (err.message.includes('Invalid city parameter') ||
          err.message.includes('City not found') ||
          err.message.includes('Days must be between')) {
        errorCode = -32602; // Invalid params
      }

      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: errorCode,
          message: errorMessage
        }
      };
    }
  }

  /**
   * Handle get_current_weather tool
   */
  private async handleGetCurrentWeather(args: any) {
    if (!args || typeof args.city !== 'string' || args.city.trim() === '') {
      throw new Error('Invalid city parameter: city must be a non-empty string');
    }

    const weather = await this.weatherService.getCurrentWeather(args.city.trim());

    return {
      content: [{
        type: 'text',
        text: `Weather in ${weather.location}:\n` +
              `• Temperature: ${weather.temperature}°C\n` +
              `• Condition: ${weather.description}\n` +
              `• Humidity: ${weather.humidity}%\n` +
              `• Wind Speed: ${weather.windSpeed} m/s\n` +
              `• Feels Like: ${weather.feelsLike}°C\n` +
              `• Pressure: ${weather.pressure} hPa` +
              (weather.timestamp ? `\n• Last Updated: ${new Date(weather.timestamp).toLocaleString()}` : '')
      }]
    };
  }

  /**
   * Handle get_weather_forecast tool
   */
  private async handleGetWeatherForecast(args: any) {
    if (!args || typeof args.city !== 'string' || args.city.trim() === '') {
      throw new Error('Invalid city parameter: city must be a non-empty string');
    }

    const days = args.days || 5;
    if (days < 1 || days > 7) {
      throw new Error('Days must be between 1 and 7');
    }

    const forecast = await this.weatherService.getForecast(args.city.trim(), days);

    const forecastText = forecast.forecasts
      .map(f =>
        `${f.date}: ${f.temperature}°C (${f.temperatureMin}°C - ${f.temperatureMax}°C), ${f.description}, Humidity: ${f.humidity}%` +
        (f.windSpeed ? `, Wind: ${f.windSpeed} m/s` : '') +
        (f.precipitation ? `, Precipitation: ${f.precipitation} mm` : '')
      )
      .join('\n');

    return {
      content: [{
        type: 'text',
        text: `${days}-day weather forecast for ${forecast.location}:\n\n${forecastText}`
      }]
    };
  }

  /**
   * Handle retrieve_weather_context tool (for AI agents)
   */
  private async handleRetrieveWeatherContext(args: any) {
    if (!args || typeof args.query !== 'string' || args.query.trim() === '') {
      throw new Error('Invalid query parameter: query must be a non-empty string');
    }

    const query = args.query.trim();

    // Extract city from query using simple pattern matching
    const cityMatch = query.match(/(?:weather\s+(?:like\s+)?in\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)|in\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)|for\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)|weather\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?))/i);

    if (!cityMatch) {
      throw new Error('No city found in query. Please include a city name in your query.');
    }

    const city = (cityMatch[1] || cityMatch[2] || cityMatch[3] || cityMatch[4]).trim();
    const weather = await this.weatherService.getCurrentWeather(city);

    return {
      content: [{
        type: 'text',
        text: `Weather context for "${query}":\n\n` +
              `Location: ${weather.location}\n` +
              `Current Temperature: ${weather.temperature}°C\n` +
              `Conditions: ${weather.description}\n` +
              `Humidity: ${weather.humidity}%\n` +
              `Wind Speed: ${weather.windSpeed} m/s\n\n` +
              `This information can be used for travel planning, activity suggestions, or general weather awareness.`
      }]
    };
  }

  /**
   * Set up tool handlers with MCP SDK
   */
  private setupToolHandlers(): void {
    // Register tools/list handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Listing available tools');

      const tools: MCPTool[] = [
        {
          name: 'get_current_weather',
          description: 'Get current weather for a city using Open-Meteo API',
          inputSchema: {
            type: 'object',
            properties: {
              city: {
                type: 'string',
                description: 'City name (e.g., "London", "New York", "Tokyo")'
              }
            },
            required: ['city']
          }
        },
        {
          name: 'get_weather_forecast',
          description: 'Get weather forecast for a city (1-7 days)',
          inputSchema: {
            type: 'object',
            properties: {
              city: {
                type: 'string',
                description: 'City name'
              },
              days: {
                type: 'number',
                description: 'Number of days for forecast (1-7)',
                minimum: 1,
                maximum: 7,
                default: 5
              }
            },
            required: ['city']
          }
        },
        {
          name: 'retrieve_weather_context',
          description: 'Retrieve weather context for AI agent queries',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Query containing city reference (e.g., "weather in London for travel")'
              }
            },
            required: ['query']
          }
        }
      ];

      logger.debug('Tools listed successfully', { toolCount: tools.length });

      return { tools };
    });

    // Register tools/call handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const startTime = Date.now();

      logger.logToolCall(name, args);

      try {
        let result: any;

        switch (name) {
          case 'get_current_weather':
            result = await this.handleGetCurrentWeather(args);
            break;

          case 'get_weather_forecast':
            result = await this.handleGetWeatherForecast(args);
            break;

          case 'retrieve_weather_context':
            result = await this.handleRetrieveWeatherContext(args);
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        logger.logPerformance(`tool_${name}`, startTime, {
          success: true,
          args
        });

        return result;

      } catch (error) {
        logger.logError(error as Error, {
          tool: name,
          args,
          duration: Date.now() - startTime
        });

        throw error;
      }
    });
  }

  /**
   * Set up error handling
   */
  private setupErrorHandling(): void {
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
  public getServer(): Server {
    return this.server;
  }

  /**
   * Get server statistics
   */
  public getStats() {
    return {
      serverName: 'weather-mcp-server',
      version: '1.0.0',
      protocolVersion: '2025-06-18',
      toolsCount: 3,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }
}
