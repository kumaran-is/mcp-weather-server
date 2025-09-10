# MCP Weather Server Testing Guide

This guide provides comprehensive instructions for testing the MCP Weather Server using both **stdio** and **HTTP** transports.

## Table of Contents

1. [Testing with HTTP Transport](#1-testing-with-http-transport)
2. [Testing with SSE Transport](#2-testing-with-sse-transport)
3. [Testing with Stdio Transport](#3-testing-with-stdio-transport)
4. [Testing with Vitest Unit Tests](#4-testing-with-vitest-unit-tests)
5. [Environment Variables for Testing](#5-environment-variables-for-testing)
6. [Advanced Testing Scenarios](#6-advanced-testing-scenarios)
7. [Debugging and Monitoring](#7-debugging-and-monitoring)
8. [Quick Test Commands](#8-quick-test-commands)

## 1. Testing with HTTP Transport

### Quick Postman Import (Recommended)

**One-Click Setup:**
1. Start the server: `npm run http`
2. Open Postman → Import → File
3. Select `docs/mcp_weather.postman_collection.json`
4. All requests are pre-configured with proper headers, variables, and test scripts!

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

### Test with curl or Postman

For testing the HTTP transport, you can use:
1. **Postman** - Import the collection from `docs/mcp_weather.postman_collection.json`
2. **curl** - Use the commands below
3. **Custom client** - Create your own using the examples below

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

## 2. Testing with SSE Transport

### Overview

The Simple SSE (Server-Sent Events) transport is designed specifically for remote Cline connections. It provides a lightweight, bidirectional communication channel that's compatible with Cline's remote server support.

### Start SSE Server

```bash
# Using npm script
npm run sse

# Or with environment variable
MCP_TRANSPORT=sse npm run dev

# With custom port
MCP_SSE_PORT=3001 npm run sse
```

You should see:
```
[INFO] Starting MCP Weather Server
[INFO] Using SSE transport
[INFO] Simple SSE server started on port 8081
[INFO] SSE endpoint: http://localhost:8081/sse
```

### Test with curl

#### Health Check

```bash
curl http://localhost:8081/health
```

Expected response:
```json
{
  "status": "healthy",
  "transport": "sse",
  "endpoint": "http://localhost:8081/sse"
}
```

#### Connect to SSE Stream

```bash
# Connect and listen for events
curl -N -H "Accept: text/event-stream" http://localhost:8081/sse
```

You should see:
```
event: connected
data: {"clientId":"uuid-here","message":"Connected to MCP SSE server"}

event: heartbeat
data: {"timestamp":"2025-09-09T10:00:00.000Z"}
```

#### Send Commands via POST

In another terminal, send commands to the same endpoint:

```bash
# Initialize connection
curl -X POST http://localhost:8081/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "init-123",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {"sampling": {}},
      "clientInfo": {"name": "sse-test", "version": "1.0.0"}
    }
  }'

# List tools
curl -X POST http://localhost:8081/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "tools-123",
    "method": "tools/list"
  }'

# Get current weather
curl -X POST http://localhost:8081/sse \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "weather-123",
    "method": "tools/call",
    "params": {
      "name": "get_current_weather",
      "arguments": {
        "city": "London"
      }
    }
  }'
```

### Test with MCP Inspector

1. **Start SSE server:**
   ```bash
   npm run sse
   ```

2. **Open MCP Inspector:**
   ```bash
   npx @modelcontextprotocol/inspector
   ```

3. **Configure connection:**
   - Transport Type: `SSE`
   - URL: `http://localhost:8081/sse`
   - Click "Connect"

4. **Test tools:**
   - Use the Inspector UI to test all weather tools
   - Monitor the SSE stream for responses
   - Check connection stability

### Test with Cline (Remote)

1. **Start SSE server on your machine:**
   ```bash
   npm run sse
   ```

2. **Get your IP address:**
   ```bash
   # On macOS/Linux
   ifconfig | grep "inet "
   
   # On Windows
   ipconfig
   ```

3. **Configure Cline:**
   - Copy `docs/agent_mcp_setting/cline_mcp_settings_sse.json`
   - Update URL with your IP: `http://192.168.1.100:8081/sse`
   - Add to Cline MCP settings

4. **Test in Cline:**
   - Ask: "What's the weather in London?"
   - Verify Cline connects and receives weather data

### SSE Transport Features

| Feature | Description |
|---------|-------------|
| **Bidirectional** | POST for commands, SSE for responses |
| **Client Tracking** | Automatic client ID assignment |
| **Heartbeat** | Keeps connection alive (30s interval) |
| **CORS Support** | Allows remote connections |
| **Simple Protocol** | Compatible with Cline's SSE type |
| **Auto-reconnect** | Clients can reconnect with same ID |

### Common Issues and Solutions

#### Port Already in Use

```bash
# Check what's using port 8081
lsof -i :8081

# Kill the process
kill -9 $(lsof -t -i:8081)

# Or use different port
MCP_SSE_PORT=3001 npm run sse
```

#### CORS Issues

The SSE transport automatically sets CORS headers for all origins. If you need to restrict:

```bash
# Set allowed origins in .env
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000
```

#### Connection Drops

SSE connections may drop after inactivity. The server sends heartbeats every 30 seconds to prevent this. Clients should implement auto-reconnect logic.

## 3. Testing with Stdio Transport

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

## 4. Testing with Vitest Unit Tests

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
npm test -- mcp-server.spec.ts
```

**Run Tests in Watch Mode**
```bash
npm run test:watch
```

### Test Files Available

- `src/mcp-server.spec.ts` - MCP server functionality tests
- `src/weather-service.spec.ts` - Weather API integration tests
- `src/server.spec.ts` - Server initialization tests
- `src/transports/http-transport.spec.ts` - HTTP transport tests
- `src/logger.spec.ts` - Logging functionality tests

## 5. Environment Variables for Testing

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

## 6. Advanced Testing Scenarios

### Load Testing with Multiple Clients

**Start Server**
```bash
npm run http
```

**Run Safe Load Test (Capacity-Aware)**
```bash
npm run test:load
```

This will:
- Check system capacity before testing
- Automatically adjust load to safe limits
- Monitor system resources during tests
- Stop if system becomes overloaded
- Generate detailed performance metrics

### Error Testing

**Test Invalid City**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"get_current_weather","arguments":{"city":""}}}'
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

## 7. Debugging and Monitoring

### Server Logs

**Enable Debug Logging**
```bash
LOG_LEVEL=debug npm run http
```

**Check Server Health**
```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-09-10T00:00:00.000Z",
  "version": "1.0.0",
  "transport": "http",
  "activeSessions": 0
}
```

### Client Debugging

**Add Debugging to Client**
```javascript
// Add debugging to client-example.ts
console.log('Request:', JSON.stringify(request, null, 2));
console.log('Response:', JSON.stringify(response, null, 2));
```

## 8. Quick Test Commands

**Start HTTP Server and Test**
```bash
# Start server
npm run http

# In another terminal, test with curl
curl http://localhost:8080/health
```

**Quick Stdio Test**
```bash
echo '{"jsonrpc":"2.0","id":"1","method":"tools/list"}' | npm run stdio
```

**Health Check**
```bash
curl -f http://localhost:8080/health || echo "Server not responding"
```

**Chaos Engineering Tests** (Safe load testing)
```bash
npm run test:chaos
```

**Resilience Pattern Validation**
```bash
npm run test:resilience
```

**Performance Load Testing**
```bash
npm run test:load
```

**Run MCP Protocol Tests**
```bash
# Test HTTP transport
npx tsx src/test/test-mcp-http.ts

# Test stdio transport
npx tsx src/test/test-mcp-stdio.ts
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
4. **Invalid responses**: Check MCP protocol version (2025-06-18) and JSON-RPC format
5. **Session errors**: Server returns SSE format, ensure Accept header includes `text/event-stream`
6. **TypeScript errors**: Ensure Node.js 22+ and tsx are installed

### Debug Mode

**Enable Maximum Logging**
```bash
LOG_LEVEL=trace MCP_TRANSPORT=http npm run dev
```

## Test Results Documentation

For comprehensive test validation results, see:
- **[MCP-TEST-RESULTS.md](MCP-TEST-RESULTS.md)** - Complete protocol validation results
- **[PHASE-4-IMPLEMENTATION.md](PHASE-4-IMPLEMENTATION.md)** - Chaos engineering test results

## Advanced Testing Features

### Resilience Pattern Testing
The server includes advanced resilience patterns that are validated:
- **Circuit Breaker**: Opens after failures, prevents cascades
- **Retry Strategy**: Exponential backoff with jitter
- **Rate Limiting**: Request throttling
- **Bulkhead**: Pool isolation
- **Backpressure**: Memory-bounded streaming

### System Capacity Monitoring
All load tests include:
- Real-time CPU and memory monitoring
- Automatic load reduction when system under pressure
- Safe thresholds (< 70% CPU, < 80% memory)
- Emergency stop on critical conditions

This comprehensive testing setup ensures both transport mechanisms work correctly, resilience patterns function as designed, and the system maintains stability under various load conditions.
