# MCP Weather Server - Cline Integration Guide

This guide provides complete instructions for integrating and using the MCP Weather Server with Cline (Claude in VS Code).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Configuration](#configuration)
3. [Installation & Setup](#installation--setup)
4. [Testing from Cline Chat](#testing-from-cline-chat)
5. [Available Tools](#available-tools)
6. [Usage Examples](#usage-examples)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Configuration](#advanced-configuration)

## Prerequisites

- **VS Code** with Cline extension installed
- **Node.js 22.x** or later
- **MCP Weather Server** built and ready
- **Internet connection** for weather API access

## Configuration

### Step 1: Locate Cline MCP Settings

The Cline MCP settings file is located at:
```
~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

### Step 2: Add Weather Server Configuration

Add the following configuration to your `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "weather": {
      "autoApprove": [
        "get_current_weather",
        "get_weather_forecast",
        "retrieve_weather_context"
      ],
      "disabled": false,
      "timeout": 30,
      "type": "stdio",
      "command": "node",
      "args": [
        "/PATH/TO/YOUR/mcp-weather-server/dist/server.js"
      ],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Replace `/PATH/TO/YOUR/` with your actual path to the MCP Weather Server.**

### Step 3: Choose Transport Method

The MCP Weather Server supports two transport methods:

#### Option A: Stdio Transport (Recommended for Development)
- **Pros**: Direct process communication, no network setup
- **Cons**: Server restarts when Cline restarts
- **Use case**: Local development and testing

#### Option B: HTTP Transport (Recommended for Production)
- **Pros**: Persistent server, remote-capable, concurrent access
- **Cons**: Requires server to be running separately
- **Use case**: Production use, remote servers, multiple clients

### Step 4: HTTP Transport Configuration

For **HTTP transport** (requires Cline with StreamableHTTP MCP support), use this configuration:

```json
{
  "mcpServers": {
    "weather": {
      "autoApprove": [
        "get_current_weather",
        "get_weather_forecast",
        "retrieve_weather_context"
      ],
      "disabled": false,
      "timeout": 30,
      "type": "streamableHttp",
      "url": "http://localhost:8080/mcp",
      "headers": {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2025-06-18",
        "Accept": "application/json, text/event-stream"
      }
    }
  }
}
```

#### Alternative: Remote Server Configuration
```json
{
  "mcpServers": {
    "remote-weather": {
      "autoApprove": [
        "get_current_weather",
        "get_weather_forecast",
        "retrieve_weather_context"
      ],
      "disabled": false,
      "timeout": 30,
      "type": "streamableHttp",
      "url": "https://your-remote-server.com:8080/mcp",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "Bearer your-api-token"
      }
    }
  }
}
```

#### HTTP Transport Setup:

1. **Start the HTTP server** (keep it running):
   ```bash
   cd /path/to/mcp-weather-server
   npm run http
   ```

2. **Run in background** (optional):
   ```bash
   npm run http &
   ```

3. **Verify server is running**:
   ```bash
   curl http://localhost:8080/health
   ```

#### HTTP Transport Advantages:
- ✅ **Persistent**: Server runs independently of Cline
- ✅ **Remote-capable**: Can run on different machines
- ✅ **Concurrent**: Multiple clients can connect simultaneously
- ✅ **Production-ready**: Better for long-running deployments
- ✅ **Monitoring**: Built-in health checks and metrics

### Step 5: Verify Server Build

Ensure the MCP Weather Server is built:

```bash
cd /path/to/mcp-weather-server
npm run build
```

## Installation & Setup

### Build the Server

```bash
# Navigate to your MCP Weather Server directory
cd /path/to/mcp-weather-server

# Install dependencies
npm install

# Build the project
npm run build
```

### Update Configuration Path

In your `cline_mcp_settings.json`, update the `args` path:

```json
"args": [
  "/Users/yourusername/path/to/mcp-weather-server/dist/server.js"
]
```

### Restart Cline

1. Close VS Code completely
2. Reopen VS Code
3. Open a new Cline chat window
4. The weather server should automatically connect

### Verify Connection

After restart, test that Cline can access the weather MCP server:

**Check available servers:**
```
What MCP servers do you have access to?
```

**Expected response:** Should list "weather" as an available MCP server

**Test weather functionality:**
```
What's the weather like in London?
```

**Expected response:** Should return current weather data for London

## Testing from Cline Chat

### Basic Weather Queries

#### Current Weather
```
What's the weather like in London?
```
```
Get current weather for New York
```
```
How's the weather in Tokyo right now?
```

#### Weather Forecasts
```
What's the 5-day forecast for Paris?
```
```
Show me the weather forecast for Sydney for the next 3 days
```
```
What's the weather like in Chicago next week?
```

#### AI Context Queries
```
I'm planning a trip to Barcelona next month, what's the weather like?
```
```
Should I bring an umbrella to Seattle today?
```
```
Is it good weather for hiking in the Rockies this weekend?
```

### Expected Responses

#### Current Weather Response:
```
🌤️ Weather in London:
• Temperature: 15.2°C
• Condition: Partly cloudy
• Humidity: 72%
• Wind Speed: 8.5 m/s
• Feels Like: 14.8°C
• Pressure: 1013.25 hPa
```

#### Forecast Response:
```
📅 5-day weather forecast for Paris:

2025-01-08: 12°C (8°C - 15°C), Light rain, Humidity: 75%
2025-01-09: 14°C (10°C - 18°C), Partly cloudy, Humidity: 65%
2025-01-10: 16°C (12°C - 20°C), Sunny, Humidity: 60%
2025-01-11: 13°C (9°C - 16°C), Overcast, Humidity: 70%
2025-01-12: 11°C (7°C - 14°C), Light rain, Humidity: 80%
```

## Available Tools

The MCP Weather Server provides three main tools accessible through Cline:

### 1. `get_current_weather`
**Purpose**: Get real-time weather conditions for any city
**Parameters**: City name (string)
**Example**: "London", "New York", "Tokyo"

### 2. `get_weather_forecast`
**Purpose**: Get weather forecast for 1-7 days
**Parameters**:
- City name (string)
- Days (number, 1-7, default: 5)
**Example**: "Paris" with 3 days

### 3. `retrieve_weather_context`
**Purpose**: AI-powered weather context for natural language queries
**Parameters**: Natural language query containing city reference
**Example**: "weather in Sydney for weekend travel"

## Usage Examples

### Travel Planning
```
I'm going to Rome next week, what should I pack for the weather?
```
*Cline will automatically extract "Rome" and provide weather context*

### Business Planning
```
What's the weather forecast for our outdoor event in Chicago this weekend?
```
*Cline provides detailed forecast for decision making*

### Daily Planning
```
Do I need a jacket for my walk in Central Park today?
```
*Cline checks current New York weather*

### Multi-City Comparison
```
Compare the weather in London, Paris, and Berlin
```
*Cline can handle multiple cities in one query*

## Troubleshooting

### Common Issues

#### 1. Server Not Connecting
**Symptoms**: Weather queries return generic responses
**Solutions**:
- Verify the server path in `cline_mcp_settings.json`
- Ensure `dist/server.js` exists
- Check that Node.js 22.x+ is installed
- Restart VS Code completely

#### 2. No Weather Data
**Symptoms**: Tools execute but return no data
**Solutions**:
- Check internet connection
- Verify city names are spelled correctly
- Try major cities first (London, New York, Tokyo)
- Check server logs for API errors

#### 3. Timeout Errors
**Symptoms**: Requests timeout after 30 seconds
**Solutions**:
- Increase timeout in settings: `"timeout": 60`
- Check server logs for performance issues
- Verify Open-Meteo API is accessible

#### 4. Auto-Approval Not Working
**Symptoms**: Manual approval required for tools
**Solutions**:
- Verify `autoApprove` array includes all three tools
- Check tool names match exactly
- Restart Cline after configuration changes

### Debug Steps

#### Check Server Logs
```bash
# Test server directly
npm run stdio

# Send test request
echo '{"jsonrpc":"2.0","id":"1","method":"tools/list"}' | npm run stdio
```

#### Verify Configuration
```bash
# Check if server file exists
ls -la /path/to/mcp-weather-server/dist/server.js

# Test server startup
node /path/to/mcp-weather-server/dist/server.js
```

#### Cline Debug Mode
- Open VS Code Developer Console (Help → Toggle Developer Tools)
- Look for MCP-related errors in console
- Check Cline extension logs

## Advanced Configuration

### Environment Variables

Add environment variables to the `env` section:

```json
"env": {
  "MCP_TRANSPORT": "stdio",
  "LOG_LEVEL": "debug",
  "API_TIMEOUT": "10000",
  "OPEN_METEO_BASE_URL": "https://api.open-meteo.com/v1"
}
```

### Custom Timeouts

```json
{
  "weather": {
    "timeout": 60,
    "env": {
      "API_TIMEOUT": "30000"
    }
  }
}
```

### Selective Auto-Approval

Only auto-approve specific tools:

```json
"autoApprove": [
  "get_current_weather",
  "retrieve_weather_context"
]
```

### Multiple MCP Servers

Run alongside other MCP servers:

```json
{
  "mcpServers": {
    "weather": { /* weather config */ },
    "github": { /* github config */ },
    "filesystem": { /* filesystem config */ }
  }
}
```

## Performance Optimization

### Server Configuration
```json
"env": {
  "LOG_LEVEL": "warn",  // Reduce log verbosity
  "API_TIMEOUT": "5000" // Faster API timeouts
}
```

### Cline Settings
```json
{
  "timeout": 20,  // Shorter timeout for faster responses
  "autoApprove": ["get_current_weather"] // Quick current weather
}
```

## Integration Examples

### With Development Workflow
```
What's the weather like in San Francisco? I need to plan my outdoor coding session.
```

### With Project Planning
```
Should I expect good weather for our team hike in the Blue Ridge Mountains next Saturday?
```

### With Travel Planning
```
I'm considering a trip to Vancouver in March. What's the typical weather like?
```

## Support

- **Issues**: [GitHub Issues](https://github.com/kumaran-is/mcp-weather-server/issues)
- **Documentation**: [TESTING.md](TESTING.md) for detailed testing
- **Configuration**: Check Cline MCP settings format
- **Logs**: Enable debug logging for troubleshooting

---

**The MCP Weather Server integrates seamlessly with Cline, providing instant access to real-time weather data through natural language queries. Ask Cline about the weather anywhere in the world!** 🌤️
