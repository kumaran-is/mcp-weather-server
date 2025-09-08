# MCP Weather Server

A production-ready **Model Context Protocol (MCP)** server that provides weather information using the **Open-Meteo API**. Built with TypeScript, Node.js 22.x, and designed for both local AI assistants (like Cline) and remote HTTP clients.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-2025--06--18-orange)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## 🌟 Features

- **🌤️ Real-time Weather**: Current weather conditions with temperature, humidity, wind speed
- **📅 Weather Forecasts**: Up to 7-day forecasts with detailed conditions
- **🤖 AI Agent Support**: `retrieve_weather_context` tool for AI workflows
- **🔒 Security First**: Input validation, Origin checks, CORS support
- **📊 Observability**: Structured logging with Pino, performance metrics
- **🚀 Production Ready**: Docker containerization, health checks, graceful shutdown
- **🔄 Dual Transport**: Stdio for local AI assistants, HTTP for remote clients
- **⚡ High Performance**: Connection pooling, request caching, timeout handling
- **🧪 Well Tested**: 80%+ test coverage with Jest

## 🏗️ Architecture

```
mcp-weather-server/
├── src/
│   ├── config/           # Centralized configuration
│   ├── transports/       # HTTP & stdio transport implementations
│   ├── types.ts          # TypeScript type definitions
│   ├── logger.ts         # Structured logging with Pino
│   ├── weather-service.ts # Open-Meteo API integration
│   ├── mcp-server.ts     # MCP protocol implementation
│   └── server.ts         # Application entry point
├── docs/                 # Documentation
├── Dockerfile           # Containerization
└── docker-compose.yml   # Orchestration
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 22.x** or later
- **npm** or **yarn**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kumaran-is/mcp-weather-server.git
   cd mcp-weather-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

### Running the Server

#### Development Mode
```bash
# HTTP transport (recommended for development)
npm run http

# Stdio transport (for AI assistants)
npm run stdio

# Development with auto-restart
npm run dev
```

#### Production Mode
```bash
# Build and start
npm run build
npm start
```

#### Docker
```bash
# Build and run with Docker
docker build -t mcp-weather-server .
docker run -p 8080:8080 mcp-weather-server

# Or use Docker Compose
docker-compose up
```

## 🔧 Configuration

The server uses environment variables for configuration. Copy `.env` and modify as needed:

```env
# Server Configuration
NODE_ENV=development
MCP_TRANSPORT=http                    # 'stdio' or 'http'
MCP_HTTP_PORT=8080

# Open-Meteo API
OPEN_METEO_BASE_URL=https://api.open-meteo.com/v1
GEOCODING_API_URL=https://geocoding-api.open-meteo.com/v1

# Security
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# Logging
LOG_LEVEL=debug                       # 'fatal', 'error', 'warn', 'info', 'debug', 'trace'

# Performance
API_TIMEOUT=5000                      # milliseconds
HTTP_TIMEOUT=30000
```

## 📡 API Usage

### MCP Protocol

The server implements the **Model Context Protocol (2025-06-18)** with the following tools:

#### 1. `get_current_weather`
Get current weather for a city.

**Parameters:**
- `city` (string): City name (e.g., "London", "New York")

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": "123",
  "method": "tools/call",
  "params": {
    "name": "get_current_weather",
    "arguments": { "city": "London" }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": "123",
  "result": {
    "content": [{
      "type": "text",
      "text": "Weather in London:\n• Temperature: 15.2°C\n• Condition: Partly cloudy\n• Humidity: 72%\n• Wind Speed: 8.5 m/s\n• Feels Like: 14.8°C\n• Pressure: 1013.25 hPa"
    }]
  }
}
```

#### 2. `get_weather_forecast`
Get weather forecast for a city (1-7 days).

**Parameters:**
- `city` (string): City name
- `days` (number, optional): Number of days (1-7, default: 5)

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": "124",
  "method": "tools/call",
  "params": {
    "name": "get_weather_forecast",
    "arguments": { "city": "Tokyo", "days": 3 }
  }
}
```

#### 3. `retrieve_weather_context`
Retrieve weather context for AI agent queries.

**Parameters:**
- `query` (string): Natural language query containing city reference

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": "125",
  "method": "tools/call",
  "params": {
    "name": "retrieve_weather_context",
    "arguments": { "query": "weather in Paris for travel" }
  }
}
```

### HTTP Transport

When using HTTP transport, the server exposes endpoints:

- `POST /` - Send MCP messages
- `GET /` - Establish SSE stream for receiving messages
- `DELETE /` - Terminate session

**Headers:**
- `MCP-Protocol-Version: 2025-06-18`
- `Mcp-Session-Id: <uuid>`
- `Content-Type: application/json`

## 🧪 Testing

### Unit Tests
```bash
npm test
npm run test:coverage
```

### Integration Tests
```bash
# Test with HTTP transport
npm run http &
npm run client
```

### Manual Testing
```bash
# Test individual tools
npm run client weather "London"
npm run client forecast "Tokyo" 3

# Full test suite
npm run client
```

## 🔌 Integration Examples

### Cline (Local AI Assistant)
```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/path/to/dist/server.js"],
      "env": { "MCP_TRANSPORT": "stdio" }
    }
  }
}
```

### HTTP Client
```javascript
// Initialize connection
const response = await fetch('http://localhost:8080', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': '2025-06-18'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: '123',
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: { sampling: {} },
      clientInfo: { name: 'my-client', version: '1.0.0' }
    }
  })
});
```

## 📊 Monitoring & Observability

### Logging
The server uses structured logging with Pino:

```json
{
  "level": "info",
  "time": "2025-01-08T16:30:00.000Z",
  "msg": "Weather MCP Server initialized",
  "name": "weather-mcp-server",
  "version": "1.0.0",
  "protocolVersion": "2025-06-18"
}
```

### Health Checks
```bash
curl http://localhost:8080/health
```

### Metrics
- Request/response times
- API call success rates
- Active connections
- Error rates by endpoint

## 🐳 Docker Deployment

### Production Deployment
```bash
# Build image
docker build -t mcp-weather-server .

# Run container
docker run -d \
  --name mcp-weather-server \
  -p 8080:8080 \
  -e NODE_ENV=production \
  mcp-weather-server
```

### Docker Compose
```yaml
version: '3.8'
services:
  mcp-weather-server:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - MCP_TRANSPORT=http
    restart: unless-stopped
```

## 🔒 Security

- **Input Validation**: All inputs are validated and sanitized
- **Origin Checks**: CORS validation for HTTP requests
- **Rate Limiting**: Built-in request throttling
- **HTTPS**: SSL/TLS support in production
- **No API Keys**: Uses free Open-Meteo API (no credentials needed)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Setup
```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) - The protocol specification
- [Open-Meteo](https://open-meteo.com/) - Free weather API
- [Pino](https://getpino.io/) - Node.js logging library
- [Node.js](https://nodejs.org/) - JavaScript runtime

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/kumaran-is/mcp-weather-server/issues)
- **Discussions**: [GitHub Discussions](https://github.com/kumaran-is/mcp-weather-server/discussions)
- **Documentation**: See `docs/` directory

---

**Made with ❤️ for the AI assistant community**
