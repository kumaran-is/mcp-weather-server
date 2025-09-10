# MCP Settings for AI Agents (Cline)

This directory contains configuration files for integrating the MCP Weather Server with AI agents like Cline.

## 📁 Configuration Files

### 1. `cline_mcp_settings.json` - Stdio Transport (Recommended)
Use this configuration for local Cline integration with stdio transport.

**Key Features:**
- Uses stdio transport (stdin/stdout communication)
- Spawns server as child process
- Most efficient for local use
- Auto-approves all weather tools

**Installation:**
1. Copy this file to your Cline MCP settings directory
2. Update the `cwd` path to your MCP weather server location
3. Restart Cline to load the configuration

### 2. `cline_mcp_settings_http.json` - HTTP/SSE Transport
Use this configuration for HTTP-based integration with Server-Sent Events.

**Key Features:**
- Uses HTTP transport with SSE streaming
- Requires server running separately
- Supports remote connections
- Session-based communication

**Installation:**
1. Start the server: `MCP_TRANSPORT=http npm run http`
2. Copy this file to your Cline MCP settings directory
3. Update the URL if not using localhost:8080
4. Restart Cline to load the configuration

## 🔧 Configuration Options Explained

### Common Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `autoApprove` | Tools that don't require user confirmation | All weather tools |
| `alwaysAllow` | Tools that are always allowed without approval | `tools/list` |
| `disabled` | Whether the server is disabled | `false` |
| `timeout` | Request timeout in milliseconds | `30000` (30 seconds) |

### Stdio-Specific Settings

| Setting | Description | Example |
|---------|-------------|---------|
| `command` | Command to execute | `npx` |
| `args` | Command arguments | `["tsx", "src/server.ts"]` |
| `cwd` | Working directory | Full path to server directory |
| `env` | Environment variables | `{"MCP_TRANSPORT": "stdio"}` |

### HTTP-Specific Settings

| Setting | Description | Example |
|---------|-------------|---------|
| `url` | Server endpoint URL | `http://localhost:8080/mcp` |
| `type` | Transport type | `sse` |
| `transport` | Transport configuration | SSE settings |

## 🚀 Quick Start

### For Stdio Transport (Recommended)

1. **Install the server:**
   ```bash
   cd /path/to/mcp-weather-server
   npm install
   npm run build
   ```

2. **Configure Cline:**
   - Open Cline settings
   - Navigate to MCP Servers section
   - Add the contents of `cline_mcp_settings.json`
   - Update the `cwd` path to match your installation

3. **Test the integration:**
   - In Cline, type: "What's the weather in London?"
   - The weather tool should be auto-approved and executed

### For HTTP Transport

1. **Start the server:**
   ```bash
   cd /path/to/mcp-weather-server
   MCP_TRANSPORT=http npm run http
   ```

2. **Configure Cline:**
   - Open Cline settings
   - Navigate to MCP Servers section
   - Add the contents of `cline_mcp_settings_http.json`
   - Ensure the URL matches your server

3. **Test the integration:**
   - In Cline, type: "Get the weather forecast for Tokyo"
   - The tool should execute via HTTP

## 🛠️ Available Tools

All configurations auto-approve these tools:

1. **`get_current_weather`**
   - Get current weather for any city
   - Parameters: `city` (string)
   - Example: "What's the weather in Paris?"

2. **`get_weather_forecast`**
   - Get multi-day weather forecast
   - Parameters: `city` (string), `days` (1-7)
   - Example: "Show me a 5-day forecast for New York"

3. **`retrieve_weather_context`**
   - Extract weather context from natural language
   - Parameters: `query` (string)
   - Example: "How's the weather in Tokyo for outdoor activities?"

## ⚙️ Customization

### Adjust Auto-Approval
Remove tools from `autoApprove` array to require user confirmation:
```json
"autoApprove": [
  "get_current_weather"  // Only auto-approve current weather
]
```

### Change Log Level
Adjust verbosity in the `env` section:
```json
"env": {
  "LOG_LEVEL": "debug"  // Options: error, warn, info, debug
}
```

### Modify Timeout
Increase for slower connections:
```json
"timeout": 60000  // 60 seconds
```

## 🔍 Troubleshooting

### Stdio Transport Issues

1. **Server not starting:**
   - Check the `cwd` path is correct
   - Ensure Node.js 22+ is installed
   - Verify `npm install` was run

2. **Permission denied:**
   - Make sure the server files are executable
   - Check file permissions in the directory

3. **Tools not found:**
   - Verify server is initializing correctly
   - Check logs for errors during startup

### HTTP Transport Issues

1. **Connection refused:**
   - Ensure server is running (`npm run http`)
   - Check the port is not in use
   - Verify firewall settings

2. **Session errors:**
   - Server might have restarted
   - Try restarting Cline to get new session

3. **Timeout errors:**
   - Increase the `timeout` value
   - Check network connectivity

## 📊 Performance Considerations

- **Stdio**: Fastest, lowest latency (~10ms overhead)
- **HTTP**: Slightly slower (~50ms overhead), but supports remote connections
- Both transports handle 100+ requests per second

## 🔒 Security Notes

- Stdio transport is most secure (local only)
- HTTP transport should use HTTPS in production
- Consider adding API keys for production HTTP deployments
- Never expose HTTP endpoint publicly without authentication

## 📝 Example Usage in Cline

Once configured, you can use natural language:

```
User: "What's the weather like in London?"
Cline: [Uses get_current_weather tool automatically]
Response: "Weather in London: 15.2°C, Partly cloudy..."

User: "I need a 3-day forecast for my trip to Tokyo"
Cline: [Uses get_weather_forecast tool with days=3]
Response: "3-day forecast for Tokyo: ..."

User: "Is it good weather for hiking in Paris this weekend?"
Cline: [Uses retrieve_weather_context tool]
Response: "Weather context for Paris outdoor activities: ..."
```

## 🆘 Support

- **Documentation**: See main [README.md](../../README.md)
- **Issues**: Report at [GitHub Issues](https://github.com/kumaran-is/mcp-weather-server/issues)
- **MCP Spec**: [Model Context Protocol](https://modelcontextprotocol.io)

---

**Last Updated**: September 10, 2025
**Compatible with**: MCP Protocol 2025-06-18