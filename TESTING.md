# MCP Weather Server Testing Guide

This guide provides comprehensive instructions for testing the MCP Weather Server using both **stdio** and **HTTP** transports.

## Table of Contents

1. [Testing with HTTP Transport](#1-testing-with-http-transport)
2. [Testing with Stdio Transport](#2-testing-with-stdio-transport)
3. [Testing with Jest Unit Tests](#3-testing-with-jest-unit-tests)
4. [Environment Variables for Testing](#4-environment-variables-for-testing)
5. [Advanced Testing Scenarios](#5-advanced-testing-scenarios)
6. [Debugging and Monitoring](#6-debugging-and-monitoring)
7. [Quick Test Commands](#7-quick-test-commands)

## 1. Testing with HTTP Transport

### Start the HTTP Server

```bash
# Terminal 1: Start HTTP server
npm run http
# or
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
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
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
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "notifications/initialized"
  }'
```

#### List Available Tools

```bash
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": "tools-123",
    "method": "tools/list"
  }'
```

#### Get Current Weather

```bash
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
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
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
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

```bash
# Terminal 1: Start stdio server
npm run stdio
# or
MCP_TRANSPORT=stdio npm run dev
```

### Test with Manual JSON Input

```bash
# Terminal 2: Send MCP messages via stdin
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

## 3. Testing with Jest Unit Tests

### Run Unit Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- mcp-server.test.ts

# Run in watch mode
npm run test:watch
```

### Test Files Available

- `src/__tests__/mcp-server.test.ts` - MCP server functionality
- `src/__tests__/weather-service.test.ts` - Weather API integration

## 4. Environment Variables for Testing

### HTTP Transport Configuration

```bash
# Set custom port
MCP_HTTP_PORT=3000 npm run http

# Configure allowed origins
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:8080" npm run http

# Set session timeout
SESSION_TIMEOUT=1800000 npm run http  # 30 minutes
```

### API Configuration

```bash
# Use custom Open-Meteo API URL
OPEN_METEO_BASE_URL="https://api.open-meteo.com/v1" npm run http

# Set API timeouts
API_TIMEOUT=10000 npm run http  # 10 seconds
```

### Logging Configuration

```bash
# Set log level
LOG_LEVEL=debug npm run http

# Enable pretty logging
LOG_PRETTY=true npm run http
```

## 5. Advanced Testing Scenarios

### Load Testing with Multiple Clients

```bash
# Terminal 1: Start server
npm run http

# Terminal 2-4: Run multiple clients
for i in {1..3}; do
  npm run client &
done
```

### Error Testing

```bash
# Test invalid city
npm run client weather ""

# Test invalid protocol version
curl -X POST http://localhost:8080 \
  -H "MCP-Protocol-Version: 2024-01-01" \
  -d '{"jsonrpc":"2.0","method":"initialize"}'

# Test CORS
curl -H "Origin: http://evil.com" http://localhost:8080
```

### Session Management Testing

```bash
# Test session persistence
curl -X POST http://localhost:8080 \
  -H "Mcp-Session-Id: test-session-123" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'

# Test session cleanup
curl -X DELETE http://localhost:8080 \
  -H "Mcp-Session-Id: test-session-123"
```

## 6. Debugging and Monitoring

### Server Logs

```bash
# Enable debug logging
LOG_LEVEL=debug npm run http

# Check server stats (if implemented)
curl http://localhost:8080/stats
```

### Client Debugging

```javascript
// Add debugging to client-example.ts
console.log('Request:', JSON.stringify(request, null, 2));
console.log('Response:', JSON.stringify(response, null, 2));
```

## 7. Quick Test Commands

```bash
# Full HTTP test suite
npm run http & sleep 2 && npm run client

# Quick stdio test
echo '{"jsonrpc":"2.0","id":"1","method":"tools/list"}' | npm run stdio

# Health check
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

```bash
# Enable maximum logging
LOG_LEVEL=trace MCP_TRANSPORT=http npm run dev
```

This comprehensive testing setup allows you to verify both transport mechanisms work correctly and handle various scenarios including error conditions, session management, and concurrent clients.
