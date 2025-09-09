#!/usr/bin/env tsx

/**
 * MCP Weather Server Client Example
 * Demonstrates how to interact with the MCP Weather Server over HTTP transport
 * This example shows the complete MCP lifecycle and tool usage
 */

import { request } from 'undici';
import { v4 as uuidv4 } from 'uuid';

/**
 * Example client for testing MCP Weather Server
 */
class MCPWeatherClient {
  private baseUrl: string;
  private sessionId: string;

  constructor(baseUrl: string = 'http://localhost:8080/mcp') {
    this.baseUrl = baseUrl;
    this.sessionId = uuidv4();
  }

  /**
   * Parse SSE response and extract JSON data
   */
  private parseSSEResponse(responseText: string): any {
    const lines = responseText.trim().split('\n');
    let jsonData = '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        jsonData = line.substring(6);
        break;
      }
    }
    return JSON.parse(jsonData);
  }

  /**
   * Initialize the MCP connection
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing MCP connection...');

    const initRequest = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: { sampling: {} },
        clientInfo: {
          name: 'mcp-weather-client-example',
          version: '1.0.0'
        }
      }
    };

    try {
      const { statusCode, headers, body } = await request(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': '2025-06-18',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify(initRequest)
      });

      if (statusCode !== 200 && statusCode !== 202) {
        throw new Error(`HTTP ${statusCode}`);
      }

      const responseText = await body.text();
      console.log('Raw response:', responseText);

      const initResult = this.parseSSEResponse(responseText);
      console.log('✅ Initialize response:', JSON.stringify(initResult, null, 2));

      // Extract session ID from response headers
      const responseSessionId = headers['mcp-session-id'];
      if (responseSessionId) {
        this.sessionId = Array.isArray(responseSessionId) ? responseSessionId[0] : responseSessionId;
        console.log(`📋 Using session ID: ${this.sessionId}`);
      }

    } catch (error) {
      console.error('❌ Initialize failed:', error);
      throw error;
    }
  }

  /**
   * Send initialized notification
   */
  async sendInitialized(): Promise<void> {
    console.log('📤 Sending initialized notification...');

    const notification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    };

    try {
      const { statusCode } = await request(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': '2025-06-18',
          'Mcp-Session-Id': this.sessionId,
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify(notification)
      });

      if (statusCode !== 200 && statusCode !== 202) {
        throw new Error(`HTTP ${statusCode}`);
      }

      console.log('✅ Initialized notification sent');

    } catch (error) {
      console.error('❌ Initialized notification failed:', error);
      throw error;
    }
  }

  /**
   * List available tools
   */
  async listTools(): Promise<void> {
    console.log('🔧 Listing available tools...');

    const requestBody = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'tools/list'
    };

    try {
      const { statusCode, body } = await request(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': '2025-06-18',
          'Mcp-Session-Id': this.sessionId,
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify(requestBody)
      });

      if (statusCode !== 200) {
        throw new Error(`HTTP ${statusCode}`);
      }

      const responseText = await body.text();
      const result = this.parseSSEResponse(responseText);
      console.log('✅ Tools list:', JSON.stringify(result, null, 2));

    } catch (error) {
      console.error('❌ Tools list failed:', error);
      throw error;
    }
  }

  /**
   * Get current weather for a city
   */
  async getCurrentWeather(city: string): Promise<void> {
    console.log(`🌤️  Getting current weather for ${city}...`);

    const requestBody = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'tools/call',
      params: {
        name: 'get_current_weather',
        arguments: { city }
      }
    };

    try {
      const { statusCode, body } = await request(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': '2025-06-18',
          'Mcp-Session-Id': this.sessionId,
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify(requestBody)
      });

      if (statusCode !== 200) {
        throw new Error(`HTTP ${statusCode}`);
      }

      const responseText = await body.text();
      const result = this.parseSSEResponse(responseText);
      console.log(`✅ Current weather for ${city}:`, JSON.stringify(result, null, 2));

    } catch (error) {
      console.error(`❌ Current weather for ${city} failed:`, error);
      throw error;
    }
  }

  /**
   * Get weather forecast for a city
   */
  async getWeatherForecast(city: string, days: number = 5): Promise<void> {
    console.log(`📅 Getting ${days}-day forecast for ${city}...`);

    const requestBody = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'tools/call',
      params: {
        name: 'get_weather_forecast',
        arguments: { city, days }
      }
    };

    try {
      const { statusCode, body } = await request(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': '2025-06-18',
          'Mcp-Session-Id': this.sessionId,
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify(requestBody)
      });

      if (statusCode !== 200) {
        throw new Error(`HTTP ${statusCode}`);
      }

      const responseText = await body.text();
      const result = this.parseSSEResponse(responseText);
      console.log(`✅ Forecast for ${city}:`, JSON.stringify(result, null, 2));

    } catch (error) {
      console.error(`❌ Forecast for ${city} failed:`, error);
      throw error;
    }
  }

  /**
   * Test retrieve_weather_context tool
   */
  async retrieveWeatherContext(query: string): Promise<void> {
    console.log(`🤖 Getting weather context for query: "${query}"`);

    const requestBody = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'tools/call',
      params: {
        name: 'retrieve_weather_context',
        arguments: { query }
      }
    };

    try {
      const { statusCode, body } = await request(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': '2025-06-18',
          'Mcp-Session-Id': this.sessionId,
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify(requestBody)
      });

      if (statusCode !== 200) {
        throw new Error(`HTTP ${statusCode}`);
      }

      const responseText = await body.text();
      const result = this.parseSSEResponse(responseText);
      console.log(`✅ Weather context for "${query}":`, JSON.stringify(result, null, 2));

    } catch (error) {
      console.error(`❌ Weather context for "${query}" failed:`, error);
      throw error;
    }
  }

  /**
   * Test error handling with invalid input
   */
  async testErrorHandling(): Promise<void> {
    console.log('🧪 Testing error handling...');

    const requestBody = {
      jsonrpc: '2.0',
      id: uuidv4(),
      method: 'tools/call',
      params: {
        name: 'get_current_weather',
        arguments: { city: '' } // Invalid empty city
      }
    };

    try {
      const { statusCode, body } = await request(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'MCP-Protocol-Version': '2025-06-18',
          'Mcp-Session-Id': this.sessionId,
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify(requestBody)
      });

      const responseText = await body.text();
      const result = this.parseSSEResponse(responseText);
      console.log('✅ Error handling test:', JSON.stringify(result, null, 2));

    } catch (error) {
      console.error('❌ Error handling test failed:', error);
      throw error;
    }
  }

  /**
   * Run complete test suite
   */
  async runTests(): Promise<void> {
    console.log('🧪 Running MCP Weather Server test suite...\n');

    try {
      await this.initialize();
      await this.sendInitialized();
      await this.listTools();

      console.log('\n🌤️  Testing weather tools...\n');

      await this.getCurrentWeather('London');
      await this.getCurrentWeather('New York');
      await this.getWeatherForecast('Tokyo', 3);
      await this.retrieveWeatherContext('weather in Paris for travel');
      await this.testErrorHandling();

      console.log('\n🎉 All tests completed successfully!');

    } catch (error) {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const client = new MCPWeatherClient();

  // Check command line arguments
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const command = args[0];

    switch (command) {
      case 'init':
        await client.initialize();
        break;
      case 'tools':
        await client.initialize();
        await client.sendInitialized();
        await client.listTools();
        break;
      case 'weather':
        const city = args[1] || 'London';
        await client.initialize();
        await client.sendInitialized();
        await client.getCurrentWeather(city);
        break;
      case 'forecast':
        const forecastCity = args[1] || 'London';
        const days = parseInt(args[2]) || 5;
        await client.initialize();
        await client.sendInitialized();
        await client.getWeatherForecast(forecastCity, days);
        break;
      default:
        console.log('Usage:');
        console.log('  npm run client          # Run full test suite');
        console.log('  npm run client init     # Initialize only');
        console.log('  npm run client tools    # List tools');
        console.log('  npm run client weather [city]  # Get current weather');
        console.log('  npm run client forecast [city] [days]  # Get forecast');
        break;
    }
  } else {
    await client.runTests();
  }
}

// Run the client if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Client execution failed:', error);
    process.exit(1);
  });
}

export { MCPWeatherClient };
