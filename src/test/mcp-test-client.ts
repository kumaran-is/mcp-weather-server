#!/usr/bin/env node

/**
 * MCP Server Test Client
 * Tests both stdio and HTTP transports with all available tools
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn } from 'child_process';
import { logger } from '../logger.js';

interface TestResult {
  transport: string;
  test: string;
  passed: boolean;
  duration: number;
  response?: any;
  error?: string;
}

export class MCPTestClient {
  private results: TestResult[] = [];

  /**
   * Run all tests for both transports
   */
  async runAllTests(): Promise<void> {
    logger.info('========================================');
    logger.info('    MCP SERVER COMPREHENSIVE TESTING    ');
    logger.info('========================================\n');

    // Test HTTP transport
    await this.testHTTPTransport();

    // Test stdio transport
    await this.testStdioTransport();

    // Generate report
    this.generateReport();
  }

  /**
   * Test HTTP transport
   */
  async testHTTPTransport(): Promise<void> {
    logger.info('📡 Testing HTTP Transport...\n');

    try {
      // Create HTTP client
      const transport = new StreamableHTTPClientTransport({
        url: 'http://localhost:8080/mcp',
        headers: {
          'User-Agent': 'MCP-Test-Client/1.0.0'
        }
      });

      const client = new Client({
        name: 'mcp-test-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await client.connect(transport);

      // Run all tests
      await this.runToolTests(client, 'HTTP');

      await client.close();
      logger.info('✅ HTTP Transport tests completed\n');

    } catch (error) {
      logger.error('HTTP Transport test failed', { error: (error as Error).message });
      this.results.push({
        transport: 'HTTP',
        test: 'Connection',
        passed: false,
        duration: 0,
        error: (error as Error).message
      });
    }
  }

  /**
   * Test stdio transport
   */
  async testStdioTransport(): Promise<void> {
    logger.info('🔌 Testing Stdio Transport...\n');

    try {
      // Spawn server process
      const serverProcess = spawn('tsx', ['src/server.ts'], {
        env: {
          ...process.env,
          MCP_TRANSPORT: 'stdio'
        }
      });

      // Create stdio client
      const transport = new StdioClientTransport({
        command: 'tsx',
        args: ['src/server.ts'],
        env: {
          ...process.env,
          MCP_TRANSPORT: 'stdio'
        }
      });

      const client = new Client({
        name: 'mcp-test-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await client.connect(transport);

      // Run all tests
      await this.runToolTests(client, 'Stdio');

      await client.close();
      serverProcess.kill();
      
      logger.info('✅ Stdio Transport tests completed\n');

    } catch (error) {
      logger.error('Stdio Transport test failed', { error: (error as Error).message });
      this.results.push({
        transport: 'Stdio',
        test: 'Connection',
        passed: false,
        duration: 0,
        error: (error as Error).message
      });
    }
  }

  /**
   * Run all tool tests
   */
  async runToolTests(client: Client, transport: string): Promise<void> {
    // Test 1: List tools
    await this.testListTools(client, transport);

    // Test 2: Get current weather
    await this.testGetCurrentWeather(client, transport);

    // Test 3: Get weather forecast
    await this.testGetWeatherForecast(client, transport);

    // Test 4: Retrieve weather context
    await this.testRetrieveWeatherContext(client, transport);

    // Test 5: Invalid parameters
    await this.testInvalidParameters(client, transport);

    // Test 6: Error handling
    await this.testErrorHandling(client, transport);
  }

  /**
   * Test listing tools
   */
  async testListTools(client: Client, transport: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const tools = await client.listTools();
      const duration = Date.now() - startTime;

      const expectedTools = ['get_current_weather', 'get_weather_forecast', 'retrieve_weather_context'];
      const hasAllTools = expectedTools.every(tool => 
        tools.tools.some(t => t.name === tool)
      );

      this.results.push({
        transport,
        test: 'List Tools',
        passed: hasAllTools && tools.tools.length === 3,
        duration,
        response: tools
      });

      logger.info(`✓ List Tools (${duration}ms):`, {
        toolCount: tools.tools.length,
        tools: tools.tools.map(t => t.name)
      });

    } catch (error) {
      this.results.push({
        transport,
        test: 'List Tools',
        passed: false,
        duration: Date.now() - startTime,
        error: (error as Error).message
      });
      logger.error('✗ List Tools failed:', error);
    }
  }

  /**
   * Test get current weather
   */
  async testGetCurrentWeather(client: Client, transport: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await client.callTool({
        name: 'get_current_weather',
        arguments: {
          city: 'London'
        }
      });
      const duration = Date.now() - startTime;

      const hasContent = result.content && result.content.length > 0;
      const hasWeatherInfo = result.content?.[0]?.text?.includes('Temperature');

      this.results.push({
        transport,
        test: 'Get Current Weather',
        passed: hasContent && hasWeatherInfo,
        duration,
        response: result
      });

      logger.info(`✓ Get Current Weather (${duration}ms):`, {
        city: 'London',
        hasContent,
        responseLength: result.content?.[0]?.text?.length
      });

    } catch (error) {
      this.results.push({
        transport,
        test: 'Get Current Weather',
        passed: false,
        duration: Date.now() - startTime,
        error: (error as Error).message
      });
      logger.error('✗ Get Current Weather failed:', error);
    }
  }

  /**
   * Test get weather forecast
   */
  async testGetWeatherForecast(client: Client, transport: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await client.callTool({
        name: 'get_weather_forecast',
        arguments: {
          city: 'New York',
          days: 3
        }
      });
      const duration = Date.now() - startTime;

      const hasContent = result.content && result.content.length > 0;
      const hasForecast = result.content?.[0]?.text?.includes('forecast');

      this.results.push({
        transport,
        test: 'Get Weather Forecast',
        passed: hasContent && hasForecast,
        duration,
        response: result
      });

      logger.info(`✓ Get Weather Forecast (${duration}ms):`, {
        city: 'New York',
        days: 3,
        hasContent,
        responseLength: result.content?.[0]?.text?.length
      });

    } catch (error) {
      this.results.push({
        transport,
        test: 'Get Weather Forecast',
        passed: false,
        duration: Date.now() - startTime,
        error: (error as Error).message
      });
      logger.error('✗ Get Weather Forecast failed:', error);
    }
  }

  /**
   * Test retrieve weather context
   */
  async testRetrieveWeatherContext(client: Client, transport: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await client.callTool({
        name: 'retrieve_weather_context',
        arguments: {
          query: 'What is the weather like in Tokyo for travel planning?'
        }
      });
      const duration = Date.now() - startTime;

      const hasContent = result.content && result.content.length > 0;
      const hasContext = result.content?.[0]?.text?.includes('Tokyo');

      this.results.push({
        transport,
        test: 'Retrieve Weather Context',
        passed: hasContent && hasContext,
        duration,
        response: result
      });

      logger.info(`✓ Retrieve Weather Context (${duration}ms):`, {
        query: 'Tokyo travel',
        hasContent,
        responseLength: result.content?.[0]?.text?.length
      });

    } catch (error) {
      this.results.push({
        transport,
        test: 'Retrieve Weather Context',
        passed: false,
        duration: Date.now() - startTime,
        error: (error as Error).message
      });
      logger.error('✗ Retrieve Weather Context failed:', error);
    }
  }

  /**
   * Test invalid parameters
   */
  async testInvalidParameters(client: Client, transport: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test with empty city
      await client.callTool({
        name: 'get_current_weather',
        arguments: {
          city: ''
        }
      });

      // Should not reach here
      this.results.push({
        transport,
        test: 'Invalid Parameters',
        passed: false,
        duration: Date.now() - startTime,
        error: 'Should have thrown error for empty city'
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      const isValidError = errorMessage.includes('Invalid city') || 
                          errorMessage.includes('must be a non-empty string');

      this.results.push({
        transport,
        test: 'Invalid Parameters',
        passed: isValidError,
        duration,
        response: { error: errorMessage }
      });

      logger.info(`✓ Invalid Parameters handling (${duration}ms):`, {
        expectedError: true,
        errorReceived: isValidError
      });
    }
  }

  /**
   * Test error handling
   */
  async testErrorHandling(client: Client, transport: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Test with invalid tool name
      await client.callTool({
        name: 'invalid_tool_name',
        arguments: {}
      });

      // Should not reach here
      this.results.push({
        transport,
        test: 'Error Handling',
        passed: false,
        duration: Date.now() - startTime,
        error: 'Should have thrown error for invalid tool'
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      const isValidError = errorMessage.includes('Unknown tool') || 
                          errorMessage.includes('not found');

      this.results.push({
        transport,
        test: 'Error Handling',
        passed: isValidError,
        duration,
        response: { error: errorMessage }
      });

      logger.info(`✓ Error Handling (${duration}ms):`, {
        expectedError: true,
        errorReceived: isValidError
      });
    }
  }

  /**
   * Generate test report
   */
  generateReport(): void {
    logger.info('\n========================================');
    logger.info('           TEST RESULTS SUMMARY          ');
    logger.info('========================================\n');

    // Group by transport
    const httpResults = this.results.filter(r => r.transport === 'HTTP');
    const stdioResults = this.results.filter(r => r.transport === 'Stdio');

    // HTTP Summary
    logger.info('📡 HTTP Transport:');
    this.logTransportSummary(httpResults);

    // Stdio Summary
    logger.info('\n🔌 Stdio Transport:');
    this.logTransportSummary(stdioResults);

    // Overall Summary
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const successRate = (passedTests / totalTests * 100).toFixed(1);

    logger.info('\n========================================');
    logger.info('           OVERALL RESULTS              ');
    logger.info('========================================');
    logger.info(`Total Tests: ${totalTests}`);
    logger.info(`✅ Passed: ${passedTests}`);
    logger.info(`❌ Failed: ${failedTests}`);
    logger.info(`Success Rate: ${successRate}%`);
    
    const avgLatency = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
    logger.info(`Average Latency: ${avgLatency.toFixed(0)}ms`);

    if (failedTests > 0) {
      logger.info('\n⚠️  Failed Tests:');
      this.results.filter(r => !r.passed).forEach(r => {
        logger.error(`  - ${r.transport}/${r.test}: ${r.error}`);
      });
    }

    logger.info('\n========================================\n');
  }

  /**
   * Log transport summary
   */
  private logTransportSummary(results: TestResult[]): void {
    results.forEach(r => {
      const icon = r.passed ? '✅' : '❌';
      const latency = `${r.duration}ms`;
      logger.info(`  ${icon} ${r.test}: ${latency}`);
    });

    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    logger.info(`  Summary: ${passed}/${total} passed`);
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new MCPTestClient();
  tester.runAllTests().catch(error => {
    logger.fatal('Test client failed', { error: (error as Error).message });
    process.exit(1);
  });
}