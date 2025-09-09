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

    // Create mock instance
    mockWeatherService = new MockWeatherService() as any;

    // Mock the constructor and methods
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
});
