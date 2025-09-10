import { WeatherMCPServer } from './mcp-server';
import { WeatherService } from './weather-service';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the WeatherService
vi.mock('./weather-service');
const MockWeatherService = WeatherService as any;

describe('WeatherMCPServer', () => {
  let server: WeatherMCPServer;
  let mockWeatherService: any;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock instance with methods
    mockWeatherService = {
      getCurrentWeather: vi.fn(),
      getForecast: vi.fn()
    };

    // Mock the constructor to return our mock instance
    MockWeatherService.mockImplementation(() => mockWeatherService);

    // Create server instance
    server = new WeatherMCPServer();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initialization', () => {
    it('should create server instance', () => {
      expect(server).toBeDefined();
      expect(server.getServer()).toBeDefined();
    });

    it('should initialize weather service', () => {
      // The WeatherService constructor is called during server initialization
      expect(MockWeatherService).toHaveBeenCalled();
    });
  });

  describe('Tool Handling', () => {
    const mockWeatherData = {
      location: 'London',
      temperature: 15.2,
      description: 'Partly cloudy',
      humidity: 72,
      windSpeed: 8.5,
      feelsLike: 14.8,
      pressure: 1013.25,
      timestamp: '2025-01-08T12:00'
    };

    const mockForecastData = {
      location: 'London',
      forecasts: [
        {
          date: 'Wed Jan 08 2025',
          temperature: 15.2,
          temperatureMin: 12.1,
          description: 'Partly cloudy',
          humidity: 72,
          windSpeed: 8.5,
          precipitation: 0.0
        }
      ]
    };

    beforeEach(() => {
      mockWeatherService.getCurrentWeather.mockResolvedValue(mockWeatherData);
      mockWeatherService.getForecast.mockResolvedValue(mockForecastData);
    });

    describe('getCurrentWeather tool', () => {
      it('should handle valid city parameter', async () => {
        const result = await server['handleGetCurrentWeather']({ city: 'London' });

        expect(mockWeatherService.getCurrentWeather).toHaveBeenCalledWith('London');
        expect(result.content).toBeDefined();
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('London');
        expect(result.content[0].text).toContain('15.2°C');
      });

      it('should throw error for invalid city parameter', async () => {
        await expect(server['handleGetCurrentWeather']({ city: '' })).rejects.toThrow(
          'Invalid city parameter: city must be a non-empty string'
        );
      });

      it('should throw error for missing city parameter', async () => {
        await expect(server['handleGetCurrentWeather']({})).rejects.toThrow(
          'Invalid city parameter: city must be a non-empty string'
        );
      });
    });

    describe('getWeatherForecast tool', () => {
      it('should handle valid parameters', async () => {
        const result = await server['handleGetWeatherForecast']({ city: 'London', days: 3 });

        expect(mockWeatherService.getForecast).toHaveBeenCalledWith('London', 3);
        expect(result.content).toBeDefined();
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('London');
        expect(result.content[0].text).toContain('3-day weather forecast');
      });

      it('should use default days parameter', async () => {
        const result = await server['handleGetWeatherForecast']({ city: 'London' });

        expect(mockWeatherService.getForecast).toHaveBeenCalledWith('London', 5);
      });

      it('should throw error for invalid days parameter', async () => {
        await expect(server['handleGetWeatherForecast']({ city: 'London', days: 8 })).rejects.toThrow(
          'Days must be between 1 and 7'
        );
      });
    });

    describe('retrieveWeatherContext tool', () => {
      it('should extract city from query and get weather', async () => {
        const result = await server['handleRetrieveWeatherContext']({
          query: 'What is the weather like in London today?'
        });

        expect(mockWeatherService.getCurrentWeather).toHaveBeenCalledWith('London');
        expect(result.content).toBeDefined();
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('London');
        expect(result.content[0].text).toContain('15.2°C');
      });

      it('should handle different query formats', async () => {
        const queries = [
          'weather in Paris',
          'Weather for Tokyo tomorrow',
          'how is the weather in New York',
          'tell me about Berlin weather'
        ];

        for (const query of queries) {
          mockWeatherService.getCurrentWeather.mockClear();

          await server['handleRetrieveWeatherContext']({ query });

          expect(mockWeatherService.getCurrentWeather).toHaveBeenCalled();
        }
      });

      it('should throw error when no city found in query', async () => {
        await expect(server['handleRetrieveWeatherContext']({
          query: 'What is the temperature today?'
        })).rejects.toThrow('No city found in query');
      });

      it('should throw error for invalid query parameter', async () => {
        await expect(server['handleRetrieveWeatherContext']({ query: '' })).rejects.toThrow(
          'Invalid query parameter: query must be a non-empty string'
        );
      });
    });
  });

  describe('Server Statistics', () => {
    it('should return server statistics', () => {
      const stats = server.getStats();

      expect(stats).toEqual({
        serverName: 'weather-mcp-server',
        version: '1.0.0',
        protocolVersion: '2025-06-18',
        toolsCount: 3,
        uptime: expect.any(Number),
        memoryUsage: expect.any(Object)
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle weather service errors', async () => {
      mockWeatherService.getCurrentWeather.mockRejectedValue(new Error('API Error'));

      await expect(server['handleGetCurrentWeather']({ city: 'London' })).rejects.toThrow(
        'API Error'
      );
    });

    it('should handle forecast service errors', async () => {
      mockWeatherService.getForecast.mockRejectedValue(new Error('Forecast API Error'));

      await expect(server['handleGetWeatherForecast']({ city: 'London' })).rejects.toThrow(
        'Forecast API Error'
      );
    });
  });

  describe('Lifecycle Management', () => {
    it('should handle graceful shutdown', async () => {
      // Mock process.on to avoid actual process listeners
      const mockProcessOn = vi.spyOn(process, 'on').mockImplementation(() => process);

      // Create new server to test setup
      const newServer = new WeatherMCPServer();

      // Should not throw during shutdown
      await expect(newServer['gracefulShutdown']()).resolves.not.toThrow();

      mockProcessOn.mockRestore();
    });
  });

  describe('MCP Protocol Message Processing', () => {
    beforeEach(() => {
      // Set up mock data for MCP message processing tests
      mockWeatherService.getCurrentWeather.mockResolvedValue({
        location: 'London',
        temperature: 15.2,
        description: 'Partly cloudy',
        humidity: 72,
        windSpeed: 8.5,
        feelsLike: 14.8,
        pressure: 1013.25,
        timestamp: '2025-01-08T12:00'
      });
      mockWeatherService.getForecast.mockResolvedValue({
        location: 'London',
        forecasts: [
          {
            date: 'Wed Jan 08 2025',
            temperature: 15.2,
            temperatureMin: 12.1,
            temperatureMax: 18.3,
            description: 'Partly cloudy',
            humidity: 72,
            windSpeed: 8.5,
            precipitation: 0.0
          }
        ]
      });
    });

    describe('processMessage method', () => {
      it('should handle initialize request', async () => {
        const message = {
          jsonrpc: '2.0',
          id: '123',
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: { sampling: {} },
            clientInfo: { name: 'test-client', version: '1.0.0' }
          }
        };

        const result = await server['processMessage'](message);

        expect(result).toBeDefined();
        expect(result.jsonrpc).toBe('2.0');
        expect(result.id).toBe('123');
        expect(result.result).toBeDefined();
        expect(result.result.protocolVersion).toBe('2025-06-18');
      });

      it('should handle initialized notification', async () => {
        const message = {
          jsonrpc: '2.0',
          method: 'notifications/initialized'
        };

        const result = await server['processMessage'](message);

        expect(result).toBeNull();
      });

      it('should handle shutdown request', async () => {
        const message = {
          jsonrpc: '2.0',
          id: '456',
          method: 'shutdown'
        };

        const result = await server['processMessage'](message);

        expect(result).toEqual({
          jsonrpc: '2.0',
          id: '456',
          result: {}
        });
      });

      it('should handle tools/list request', async () => {
        const message = {
          jsonrpc: '2.0',
          id: '789',
          method: 'tools/list'
        };

        const result = await server['processMessage'](message);

        expect(result).toBeDefined();
        expect(result.jsonrpc).toBe('2.0');
        expect(result.id).toBe('789');
        expect(result.result).toBeDefined();
        expect(result.result.tools).toBeDefined();
        expect(Array.isArray(result.result.tools)).toBe(true);
        expect(result.result.tools.length).toBe(3);
      });

      it('should handle tools/call request', async () => {
        const message = {
          jsonrpc: '2.0',
          id: '999',
          method: 'tools/call',
          params: {
            name: 'get_current_weather',
            arguments: { city: 'London' }
          }
        };

        const result = await server['processMessage'](message);

        expect(result).toEqual({
          jsonrpc: '2.0',
          id: '999',
          result: {
            content: [{
              type: 'text',
              text: expect.stringContaining('London')
            }]
          }
        });
      });

      it('should handle unknown method', async () => {
        const message = {
          jsonrpc: '2.0',
          id: 'unknown-123',
          method: 'unknown/method'
        };

        const result = await server['processMessage'](message);

        expect(result).toEqual({
          jsonrpc: '2.0',
          id: 'unknown-123',
          error: {
            code: -32601,
            message: 'Method \'unknown/method\' not found'
          }
        });
      });

      it('should handle invalid JSON-RPC format', async () => {
        const message = {
          id: 'invalid-123',
          method: 'tools/list'
          // Missing jsonrpc field
        };

        const result = await server['processMessage'](message);

        expect(result).toEqual({
          jsonrpc: '2.0',
          id: 'invalid-123',
          error: {
            code: -32603,
            message: 'Internal error',
            data: {
              details: 'Invalid JSON-RPC version'
            }
          }
        });
      });
    });

    describe('handleInitialize method', () => {
      it('should accept supported protocol version', async () => {
        const message = {
          jsonrpc: '2.0',
          id: 'init-123',
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: { sampling: {} },
            clientInfo: { name: 'test-client', version: '1.0.0' }
          }
        };

        const result = await server['handleInitialize'](message);

        expect(result).toBeDefined();
        expect(result.result.protocolVersion).toBe('2025-06-18');
        expect(result.result.capabilities).toBeDefined();
        expect(result.result.serverInfo).toBeDefined();
      });

      it('should accept legacy protocol version', async () => {
        const message = {
          jsonrpc: '2.0',
          id: 'init-456',
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: { sampling: {} },
            clientInfo: { name: 'test-client', version: '1.0.0' }
          }
        };

        const result = await server['handleInitialize'](message);

        expect(result).toBeDefined();
        expect(result.result.protocolVersion).toBe('2025-03-26'); // Should echo back the client version
      });

      it('should reject unsupported protocol version', async () => {
        const message = {
          jsonrpc: '2.0',
          id: 'init-789',
          method: 'initialize',
          params: {
            protocolVersion: '2024-01-01',
            capabilities: { sampling: {} },
            clientInfo: { name: 'test-client', version: '1.0.0' }
          }
        };

        const result = await server['handleInitialize'](message);

        expect(result).toEqual({
          jsonrpc: '2.0',
          id: 'init-789',
          error: {
            code: -32602,
            message: 'Unsupported protocol version',
            data: {
              supported: ['2025-06-18', '2025-03-26'],
              requested: '2024-01-01'
            }
          }
        });
      });

      it('should handle missing params', async () => {
        const message = {
          jsonrpc: '2.0',
          id: 'init-missing',
          method: 'initialize'
          // Missing params
        };

        const result = await server['handleInitialize'](message);

        expect(result).toEqual({
          jsonrpc: '2.0',
          id: 'init-missing',
          error: {
            code: -32602,
            message: 'Unsupported protocol version',
            data: {
              supported: ['2025-06-18', '2025-03-26'],
              requested: undefined
            }
          }
        });
      });
    });

    describe('handleInitialized method', () => {
      it('should handle initialized notification', async () => {
        const message = {
          jsonrpc: '2.0',
          method: 'notifications/initialized'
        };

        const result = await server['handleInitialized'](message);

        expect(result).toBeNull();
      });
    });

    describe('handleShutdown method', () => {
      it('should handle shutdown request', async () => {
        const message = {
          jsonrpc: '2.0',
          id: 'shutdown-123',
          method: 'shutdown'
        };

        const result = await server['handleShutdown'](message);

        expect(result).toEqual({
          jsonrpc: '2.0',
          id: 'shutdown-123',
          result: {}
        });
      });
    });

    describe('handleToolsList method', () => {
      it('should return all available tools', async () => {
        const message = {
          jsonrpc: '2.0',
          id: 'tools-list-123',
          method: 'tools/list'
        };

        const result = await server['handleToolsList'](message);

        expect(result).toEqual({
          jsonrpc: '2.0',
          id: 'tools-list-123',
          result: {
            tools: [
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
            ]
          }
        });
      });
    });

    describe('handleToolsCall method', () => {
      it('should handle get_current_weather tool call', async () => {
        const message = {
          jsonrpc: '2.0',
          id: 'tool-call-123',
          method: 'tools/call',
          params: {
            name: 'get_current_weather',
            arguments: { city: 'London' }
          }
        };

        const result = await server['handleToolsCall'](message);

        expect(result).toEqual({
          jsonrpc: '2.0',
          id: 'tool-call-123',
          result: {
            content: [{
              type: 'text',
              text: expect.stringContaining('London')
            }]
          }
        });
      });

      it('should handle get_weather_forecast tool call', async () => {
        const message = {
          jsonrpc: '2.0',
          id: 'tool-call-456',
          method: 'tools/call',
          params: {
            name: 'get_weather_forecast',
            arguments: { city: 'Tokyo', days: 3 }
          }
        };

        const result = await server['handleToolsCall'](message);

        expect(result).toEqual({
          jsonrpc: '2.0',
          id: 'tool-call-456',
          result: {
            content: [{
              type: 'text',
              text: expect.stringContaining('Tokyo')
            }]
          }
        });
      });

      it('should handle retrieve_weather_context tool call', async () => {
        const message = {
          jsonrpc: '2.0',
          id: 'tool-call-789',
          method: 'tools/call',
          params: {
            name: 'retrieve_weather_context',
            arguments: { query: 'weather in Paris' }
          }
        };

        const result = await server['handleToolsCall'](message);

        expect(result).toEqual({
          jsonrpc: '2.0',
          id: 'tool-call-789',
          result: {
            content: [{
              type: 'text',
              text: expect.stringContaining('Paris')
            }]
          }
        });
      });

      it('should handle unknown tool', async () => {
        const message = {
          jsonrpc: '2.0',
          id: 'tool-call-unknown',
          method: 'tools/call',
          params: {
            name: 'unknown_tool',
            arguments: {}
          }
        };

        const result = await server['handleToolsCall'](message);

        expect(result).toEqual({
          jsonrpc: '2.0',
          id: 'tool-call-unknown',
          error: {
            code: -32601,
            message: 'Unknown tool: unknown_tool'
          }
        });
      });

      it('should handle tool execution errors', async () => {
        // Mock weather service to throw error
        mockWeatherService.getCurrentWeather.mockRejectedValue(new Error('API Error'));

        const message = {
          jsonrpc: '2.0',
          id: 'tool-call-error',
          method: 'tools/call',
          params: {
            name: 'get_current_weather',
            arguments: { city: 'London' }
          }
        };

        const result = await server['handleToolsCall'](message);

        expect(result).toEqual({
          jsonrpc: '2.0',
          id: 'tool-call-error',
          error: {
            code: -32603,
            message: 'Tool execution failed: API Error'
          }
        });
      });

      it('should handle missing tool params', async () => {
        const message = {
          jsonrpc: '2.0',
          id: 'tool-call-missing-params',
          method: 'tools/call'
          // Missing params
        };

        const result = await server['handleToolsCall'](message);

        expect(result).toEqual({
          jsonrpc: '2.0',
          id: 'tool-call-missing-params',
          error: {
            code: -32601,
            message: 'Unknown tool: undefined'
          }
        });
      });
    });
  });

  describe('Error Handling in processMessage', () => {
    it('should handle errors in message processing', async () => {
      // Mock weather service to throw error
      mockWeatherService.getCurrentWeather.mockRejectedValue(new Error('Service unavailable'));

      const message = {
        jsonrpc: '2.0',
        id: 'error-test-123',
        method: 'tools/call',
        params: {
          name: 'get_current_weather',
          arguments: { city: 'London' }
        }
      };

      const result = await server['processMessage'](message);

      expect(result).toEqual({
        jsonrpc: '2.0',
        id: 'error-test-123',
        error: {
          code: -32603,
          message: 'Tool execution failed: Service unavailable'
        }
      });
    });

    it('should handle errors with startTime', async () => {
      // Mock weather service to throw error
      mockWeatherService.getCurrentWeather.mockRejectedValue(new Error('Network timeout'));

      const message = {
        jsonrpc: '2.0',
        id: 'error-timing-123',
        method: 'tools/call',
        params: {
          name: 'get_current_weather',
          arguments: { city: 'London' }
        }
      };

      const result = await server['processMessage'](message);

      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32603);
    });
  });

  describe('Server Statistics', () => {
    it('should return correct server statistics', () => {
      const stats = server.getStats();

      expect(stats).toEqual({
        serverName: 'weather-mcp-server',
        version: '1.0.0',
        protocolVersion: '2025-06-18',
        toolsCount: 3,
        uptime: expect.any(Number),
        memoryUsage: expect.any(Object)
      });

      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.memoryUsage).toBeDefined();
    });
  });
});
