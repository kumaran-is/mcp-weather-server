# MCP Weather Server Testing Guide

This guide provides comprehensive instructions for testing the MCP Weather Server using both **stdio** and **HTTP** transports.

## Table of Contents

1. [Testing with HTTP Transport](#1-testing-with-http-transport)
2. [Testing with Stdio Transport](#2-testing-with-stdio-transport)
3. [Testing with Vitest Unit Tests](#3-testing-with-vitest-unit-tests)
4. [Environment Variables for Testing](#4-environment-variables-for-testing)
5. [Advanced Testing Scenarios](#5-advanced-testing-scenarios)
6. [Debugging and Monitoring](#6-debugging-and-monitoring)
7. [Quick Test Commands](#7-quick-test-commands)

## 1. Testing with HTTP Transport

### Quick Postman Import (Recommended)

**One-Click Setup:**
1. Start the server: `npm run http`
2. Open Postman → Import → Raw Text
3. Copy and paste the entire contents of `MCP-Weather-Server.postman_collection.json`
4. All 12 requests are pre-configured with proper headers, variables, and test scripts!

### Manual Setup

**Start HTTP Server (Recommended)**
```bash
npm run http
```

**Start with Environment Variable**
```bash
MCP_TRANSPORT=http npm run dev
```

You should see:
```
[INFO] Starting MCP Weather Server
[INFO] Using HTTP transport
[INFO] HTTP server started on port 8080
```

### Test with the Built-in Client

```bash
# Terminal 2: Run full test suite
npm run client

# Or run specific tests:
npm run client init      # Initialize connection
npm run client tools     # List available tools
npm run client weather   # Get weather for London
npm run client weather "New York"  # Get weather for specific city
npm run client forecast "Tokyo" 3  # Get 3-day forecast
```

### Manual HTTP Testing with curl

#### Initialize MCP Connection

```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "init-123",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {"sampling": {}},
      "clientInfo": {"name": "curl-test", "version": "1.0.0"}
    }
  }'
```

#### Send Initialized Notification

```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "notifications/initialized"
  }'
```

#### List Available Tools

```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "tools-123",
    "method": "tools/list"
  }'
```

#### Get Current Weather

```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "weather-123",
    "method": "tools/call",
    "params": {
      "name": "get_current_weather",
      "arguments": {"city": "London"}
    }
  }'
```

#### Get Weather Forecast

```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": "forecast-123",
    "method": "tools/call",
    "params": {
      "name": "get_weather_forecast",
      "arguments": {"city": "Paris", "days": 3}
    }
  }'
```

## 2. Testing with Stdio Transport

### Start the Stdio Server

**Start Stdio Server (Recommended)**
```bash
npm run stdio
```

**Start with Environment Variable**
```bash
MCP_TRANSPORT=stdio npm run dev
```

### Test with Manual JSON Input

**Send Initialize Request**
```bash
echo '{
  "jsonrpc": "2.0",
  "id": "init-123",
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {"sampling": {}},
    "clientInfo": {"name": "stdio-test", "version": "1.0.0"}
  }
}' | npm run stdio
```

### Interactive Stdio Testing

Create a test script (`test-stdio.js`):

```javascript
const { spawn } = require('child_process');
const server = spawn('npm', ['run', 'stdio'], { stdio: ['pipe', 'pipe', 'inherit'] });

// Send initialize request
const initRequest = {
  jsonrpc: '2.0',
  id: 'init-123',
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: { sampling: {} },
    clientInfo: { name: 'stdio-test', version: '1.0.0' }
  }
};

server.stdin.write(JSON.stringify(initRequest) + '\n');

// Listen for responses
server.stdout.on('data', (data) => {
  console.log('Server response:', data.toString());
});

// Send more requests after initialization
setTimeout(() => {
  const toolsRequest = {
    jsonrpc: '2.0',
    id: 'tools-123',
    method: 'tools/list'
  };
  server.stdin.write(JSON.stringify(toolsRequest) + '\n');
}, 1000);
```

## 3. Testing with Vitest Unit Tests

### Run Unit Tests

**Run All Tests**
```bash
npm test
```

**Run Tests with Coverage**
```bash
npm run test:coverage
```

**Run Specific Test File**
```bash
npm test -- mcp-server.test.ts
```

**Run Tests in Watch Mode**
```bash
npm run test:watch
```

### Test Files Available

- `src/__tests__/mcp-server.test.ts` - MCP server functionality
- `src/__tests__/weather-service.test.ts` - Weather API integration

## 4. Environment Variables for Testing

### HTTP Transport Configuration

**Set Custom Port**
```bash
MCP_HTTP_PORT=3000 npm run http
```

**Configure Allowed Origins**
```bash
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:8080" npm run http
```

**Set Session Timeout**
```bash
SESSION_TIMEOUT=1800000 npm run http
```

### API Configuration

**Use Custom Open-Meteo API URL**
```bash
OPEN_METEO_BASE_URL="https://api.open-meteo.com/v1" npm run http
```

**Set API Timeouts**
```bash
API_TIMEOUT=10000 npm run http
```

### Logging Configuration

**Set Log Level**
```bash
LOG_LEVEL=debug npm run http
```

**Enable Pretty Logging**
```bash
LOG_PRETTY=true npm run http
```

## 5. Advanced Testing Scenarios

### Load Testing with Multiple Clients

**Start Server**
```bash
npm run http
```

**Run Multiple Clients (in separate terminals)**
```bash
for i in {1..3}; do
  npm run client &
done
```

### Error Testing

**Test Invalid City**
```bash
npm run client weather ""
```

**Test Invalid Protocol Version**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2024-01-01" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize"}'
```

**Test CORS**
```bash
curl -H "Origin: http://evil.com" http://localhost:8080
```

### Session Management Testing

**Test Session Persistence**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Mcp-Session-Id: test-session-123" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'
```

**Test Session Cleanup**
```bash
curl -X DELETE http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Mcp-Session-Id: test-session-123" \
  -H "Accept: application/json, text/event-stream"
```

## 6. Debugging and Monitoring

### Server Logs

**Enable Debug Logging**
```bash
LOG_LEVEL=debug npm run http
```

**Check Server Stats**
```bash
curl http://localhost:8080/stats
```

### Client Debugging

**Add Debugging to Client**
```javascript
// Add debugging to client-example.ts
console.log('Request:', JSON.stringify(request, null, 2));
console.log('Response:', JSON.stringify(response, null, 2));
```

## 7. Quick Test Commands

**Full HTTP Test Suite**
```bash
npm run http & sleep 2 && npm run client
```

**Quick Stdio Test**
```bash
echo '{"jsonrpc":"2.0","id":"1","method":"tools/list"}' | npm run stdio
```

**Health Check**
```bash
curl -f http://localhost:8080/health || echo "Server not responding"
```

## Available Tools

The MCP Weather Server provides three main tools:

1. **get_current_weather** - Get current weather for a city
2. **get_weather_forecast** - Get weather forecast (1-7 days)
3. **retrieve_weather_context** - Get weather context for AI queries

## Transport Comparison

| Feature | Stdio Transport | HTTP Transport |
|---------|----------------|----------------|
| Connection Type | Local process | Remote HTTP |
| Clients | Single | Multiple concurrent |
| Real-time | Synchronous | Server-Sent Events |
| Security | Process isolation | CORS + Origin validation |
| Use Case | Local AI assistants | Web applications |

## Troubleshooting

### Common Issues

1. **Port already in use**: Change `MCP_HTTP_PORT` environment variable
2. **CORS errors**: Add your origin to `ALLOWED_ORIGINS`
3. **Connection refused**: Ensure server is running
4. **Invalid responses**: Check MCP protocol version and JSON-RPC format

### Debug Mode

**Enable Maximum Logging**
```bash
LOG_LEVEL=trace MCP_TRANSPORT=http npm run dev
```

This comprehensive testing setup allows you to verify both transport mechanisms work correctly and handle various scenarios including error conditions, session management, and concurrent clients.
