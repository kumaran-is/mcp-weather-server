# MCP Weather Server

A production-ready **Model Context Protocol (MCP)** server that provides weather information using the **Open-Meteo API**. Built with TypeScript, Node.js 22.x, and designed for both local AI assistants (like Cline) and remote HTTP clients.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-2025--06--18-orange)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## 📋 Table of Contents

- [MCP Weather Server](#mcp-weather-server)
  - [📋 Table of Contents](#-table-of-contents)
  - [🌟 Features](#-features)
  - [🛠️ Technology Stack](#️-technology-stack)
  - [Directory Structure](#directory-structure)
  - [🏗️ Architecture](#️-architecture)
    - [System Flow](#system-flow)
      - [HTTP Transport Sequence Diagram](#http-transport-sequence-diagram)
      - [Stdio Transport Sequence Diagram](#stdio-transport-sequence-diagram)
    - [Component Interactions](#component-interactions)
  - [🚀 Quick Start](#-quick-start)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Running the Server](#running-the-server)
      - [Development Mode](#development-mode)
      - [Production Mode](#production-mode)
      - [Docker](#docker)
  - [🔧 Configuration](#-configuration)
  - [📡 API Usage](#-api-usage)
    - [MCP Protocol](#mcp-protocol)
      - [1. `get_current_weather`](#1-get_current_weather)
      - [2. `get_weather_forecast`](#2-get_weather_forecast)
      - [3. `retrieve_weather_context`](#3-retrieve_weather_context)
    - [HTTP Transport](#http-transport)
  - [🧪 Testing](#-testing)
    - [Quick Test Commands](#quick-test-commands)
      - [Unit Tests](#unit-tests)
      - [HTTP Transport Testing](#http-transport-testing)
      - [Stdio Transport Testing](#stdio-transport-testing)
      - [Postman Testing](#postman-testing)
  - [🔌 Integration Examples](#-integration-examples)
    - [Cline (Local AI Assistant)](#cline-local-ai-assistant)
  - [📊 Monitoring \& Observability](#-monitoring--observability)
    - [Logging](#logging)
    - [Health Checks](#health-checks)
    - [Metrics](#metrics)
  - [🔒 Security](#-security)
  - [📊 Session Management (HTTP Transport)](#-session-management-http-transport)
    - [Session Manager Components](#session-manager-components)
      - [1. **Session Identification**](#1-session-identification)
      - [2. **Client Connection Registry**](#2-client-connection-registry)
      - [3. **Message Queue System**](#3-message-queue-system)
      - [4. **Connection Lifecycle**](#4-connection-lifecycle)
    - [Message Queueing Behavior](#message-queueing-behavior)
    - [Session Recovery Flow](#session-recovery-flow)
    - [Production Considerations](#production-considerations)
  - [🤝 Contributing](#-contributing)
  - [📝 License](#-license)
  - [🙏 Acknowledgments](#-acknowledgments)
  - [📞 Support](#-support)

## 🌟 Features

- **🌤️ Real-time Weather**: Current weather conditions with temperature, humidity, wind speed
- **📅 Weather Forecasts**: Up to 7-day forecasts with detailed conditions
- **🤖 AI Agent Support**: `retrieve_weather_context` tool for natural language queries
- **🔄 Dual Transport**: Stdio for local AI assistants, HTTP/SSE for remote clients
- **🛡️ Resilience Patterns**: Circuit breaker, retry strategies, rate limiting, bulkhead isolation
- **⚡ High Performance**: Undici-based HTTP client with connection pooling and streaming
- **🔒 Security First**: Input validation, Origin checks, CORS support, session management
- **📊 Observability**: Structured logging with Pino, real-time metrics, health monitoring
- **🧪 Comprehensive Testing**: Unit tests, integration tests, chaos engineering, load testing
- **🚀 Production Ready**: Docker containerization, graceful shutdown, error recovery

## 🛠️ Technology Stack

| Technology | Version | Purpose | Links |
|------------|---------|---------|-------|
| **Node.js** | `>=22.0.0` | JavaScript runtime environment | [Homepage](https://nodejs.org/) |
| **TypeScript** | `^5.8.0` | Type-safe JavaScript development | [Homepage](https://www.typescriptlang.org/) \| [GitHub](https://github.com/microsoft/TypeScript) |
| **Fastify** | `^5.6.0` | High-performance web framework for HTTP transport (replaces Express.js) | [Homepage](https://fastify.dev/) \| [GitHub](https://github.com/fastify/fastify) |
| **@modelcontextprotocol/sdk** | `^1.17.5` | MCP protocol implementation | [GitHub](https://github.com/modelcontextprotocol/typescript-sdk) |
| **Pino** | `~8.15.0` | High-performance structured logging | [Homepage](https://getpino.io/) \| [GitHub](https://github.com/pinojs/pino) |
| **Vitest** | `^2.1.8` | Next-generation testing framework | [Homepage](https://vitest.dev/) \| [GitHub](https://github.com/vitest-dev/vitest) |
| **dotenv** | `~16.4.1` | Environment variable management | [Homepage](https://dotenvx.com/) \| [GitHub](https://github.com/motdotla/dotenv) |
| **undici** | `^6.19.8` | High-performance HTTP client with connection pooling | [GitHub](https://github.com/nodejs/undici) |
| **uuid** | `~9.0.1` | RFC-compliant UUID generation | [GitHub](https://github.com/uuidjs/uuid) |
| **Open-Meteo API** | N/A | Free weather data provider | [Homepage](https://open-meteo.com/) |

> **Note**: The project includes an advanced `undici-resilience` package that enhances the standard undici client with enterprise-grade resilience patterns including circuit breakers, retry strategies, rate limiting, and comprehensive monitoring. This ensures reliable weather API calls even under adverse conditions.

## Directory Structure

```
mcp-weather-server/
├── src/
│   ├── config/
│   │   └── config.ts              # Centralized configuration management
│   ├── transports/
│   │   ├── http-transport.ts      # HTTP/SSE transport implementation
│   │   └── http-transport.spec.ts # Transport unit tests
│   ├── undici-resilience/         # Advanced HTTP client with resilience patterns
│   │   ├── config/
│   │   │   └── pool-config.ts     # Connection pool configuration
│   │   ├── http/
│   │   │   └── pool-manager.ts    # HTTP connection pool management
│   │   ├── resilience/
│   │   │   ├── circuit-breaker.ts # Circuit breaker pattern
│   │   │   ├── retry-strategy.ts  # Exponential backoff retry
│   │   │   ├── rate-limiter.ts    # Request rate limiting
│   │   │   └── bulkhead.ts        # Bulkhead isolation pattern
│   │   ├── streaming/
│   │   │   ├── streaming-pool-manager.ts  # SSE streaming support
│   │   │   ├── backpressure-handler.ts    # Stream backpressure handling
│   │   │   └── streaming-metrics.ts       # Streaming performance metrics
│   │   ├── monitoring/
│   │   │   └── metrics.ts         # Performance metrics collection
│   │   ├── logger.ts              # Resilience layer logging
│   │   ├── index.ts               # Package exports
│   ├── types.ts                   # TypeScript type definitions
│   ├── logger.ts                  # Structured logging with Pino
│   ├── weather-service.ts         # Open-Meteo API integration
│   ├── mcp-server.ts              # MCP protocol implementation
│   ├── server.ts                  # Application entry point
│   ├── *.spec.ts                  # Unit test files
├── docs/
├── memory-bank/                  # Cline Memory - Project context and documentation
├── dist/                          # Compiled JavaScript output
├── test-results/                  # Test execution reports
├── .env.example                   # Environment variables template
├── .env.production.example        # Production environment template
├── package.json                   # Project dependencies
├── tsconfig.json                  # TypeScript configuration
├── vitest.config.ts               # Test framework configuration
├── eslint.config.js               # Linting rules
├── Dockerfile                     # Container image definition
├── docker-compose.yml             # Development orchestration
├── docker-compose.prod.yml        # Production orchestration
├── README.md                      # Project documentation
├── LICENSE                        # MIT license
└── CHANGELOG.md                   # Version history
```

## 🏗️ Architecture

### System Flow

#### HTTP Transport Sequence Diagram

```mermaid
sequenceDiagram
    participant Client
    participant Fastify
    participant HTTPTransport
    participant WeatherMCPServer
    participant WeatherService
    participant UndiciResilience
    participant OpenMeteoAPI

    %% Initialization Phase
    Client->>Fastify: POST /mcp (initialize)
    Note over Client,Fastify: Headers: MCP-Protocol-Version, Accept: application/json, text/event-stream
    Fastify->>HTTPTransport: handleRequest()
    HTTPTransport->>WeatherMCPServer: handleInitialize()
    WeatherMCPServer-->>HTTPTransport: Server capabilities & info
    HTTPTransport-->>Fastify: Session UUID generated
    Fastify-->>Client: 200 OK + Mcp-Session-Id header
    Note over Fastify,Client: Returns server info + session ID

    Client->>Fastify: POST /mcp (notifications/initialized)
    Note over Client,Fastify: Headers include Mcp-Session-Id
    Fastify->>HTTPTransport: processMessage()
    HTTPTransport->>WeatherMCPServer: handleInitialized()
    WeatherMCPServer-->>HTTPTransport: Acknowledged
    HTTPTransport-->>Fastify: 202 Accepted
    Fastify-->>Client: 202 Accepted

    %% Tool Operations
    Client->>Fastify: POST /mcp (tools/list)
    Note over Client,Fastify: Headers: Mcp-Session-Id
    Fastify->>HTTPTransport: processMCPMessage()
    HTTPTransport->>WeatherMCPServer: handleToolsList()
    WeatherMCPServer-->>HTTPTransport: Available tools array
    HTTPTransport-->>Fastify: JSON response
    Fastify-->>Client: 200 OK (tools array)

    %% Weather Request Flow with Resilience
    Client->>Fastify: POST /mcp (tools/call: get_current_weather)
    Note over Client,Fastify: {"name": "get_current_weather", "arguments": {"city": "London"}}
    Fastify->>HTTPTransport: processMCPMessage()
    HTTPTransport->>WeatherMCPServer: handleToolsCall()
    WeatherMCPServer->>WeatherService: getCurrentWeather("London")

    %% Geocoding with Resilience Patterns
    WeatherService->>UndiciResilience: Request with circuit breaker
    UndiciResilience->>OpenMeteoAPI: GET /geocoding-api/v1/search?name=London
    Note over UndiciResilience,OpenMeteoAPI: Circuit breaker monitors health
    OpenMeteoAPI-->>UndiciResilience: Geocoding response
    UndiciResilience-->>WeatherService: Coordinates (with retry if needed)

    %% Weather Data Fetch with Resilience
    WeatherService->>UndiciResilience: Request with rate limiting
    UndiciResilience->>OpenMeteoAPI: GET /v1/forecast?latitude=51.5&longitude=-0.1
    Note over UndiciResilience,OpenMeteoAPI: Rate limited, retries on failure
    OpenMeteoAPI-->>UndiciResilience: Weather data
    UndiciResilience-->>WeatherService: Weather response

    WeatherService-->>WeatherMCPServer: Formatted weather data
    WeatherMCPServer-->>HTTPTransport: Tool result
    HTTPTransport-->>Fastify: JSON-RPC response
    Fastify-->>Client: 200 OK (SSE format if streaming)
    Note over Fastify,Client: data: {"jsonrpc":"2.0","result":...}

    %% SSE Stream for Real-time Updates
    Client->>Fastify: GET /mcp (SSE stream)
    Note over Client,Fastify: Accept: text/event-stream
    Fastify->>HTTPTransport: handleGET()
    HTTPTransport-->>Fastify: 200 OK + SSE headers
    Fastify-->>Client: SSE connection established
    Note over HTTPTransport,Client: Persistent connection for notifications
```

#### Stdio Transport Sequence Diagram

```mermaid
sequenceDiagram
    participant AI Assistant
    participant StdioTransport
    participant WeatherMCPServer
    participant WeatherService
    participant UndiciResilience
    participant OpenMeteoAPI

    %% Connection Establishment
    AI Assistant->>StdioTransport: Start MCP server process (npx tsx src/server.ts)
    StdioTransport->>WeatherMCPServer: Initialize server
    WeatherMCPServer-->>StdioTransport: Server ready on stdin/stdout

    %% MCP Protocol Handshake
    AI Assistant->>StdioTransport: {"jsonrpc":"2.0","id":"1","method":"initialize","params":{...}}
    StdioTransport->>WeatherMCPServer: handleInitialize()
    WeatherMCPServer-->>StdioTransport: {"jsonrpc":"2.0","id":"1","result":{"capabilities":...}}
    StdioTransport-->>AI Assistant: Server capabilities & protocol version

    AI Assistant->>StdioTransport: {"jsonrpc":"2.0","method":"notifications/initialized"}
    StdioTransport->>WeatherMCPServer: handleInitialized()
    Note over WeatherMCPServer: Server fully initialized

    %% Tool Discovery
    AI Assistant->>StdioTransport: {"jsonrpc":"2.0","id":"2","method":"tools/list"}
    StdioTransport->>WeatherMCPServer: handleToolsList()
    WeatherMCPServer-->>StdioTransport: {"tools":[...]}
    StdioTransport-->>AI Assistant: 3 available tools
    Note over AI Assistant: get_current_weather, get_weather_forecast, retrieve_weather_context

    %% Weather Query Processing with Resilience
    AI Assistant->>StdioTransport: {"jsonrpc":"2.0","id":"3","method":"tools/call","params":{"name":"get_current_weather","arguments":{"city":"Tokyo"}}}
    StdioTransport->>WeatherMCPServer: handleToolsCall()
    WeatherMCPServer->>WeatherService: getCurrentWeather("Tokyo")

    %% API Integration with Resilience Patterns
    WeatherService->>UndiciResilience: Request with circuit breaker
    UndiciResilience->>OpenMeteoAPI: GET /geocoding-api/v1/search?name=Tokyo
    Note over UndiciResilience: Monitor latency, apply retry logic
    OpenMeteoAPI-->>UndiciResilience: {"results":[{"latitude":35.68,"longitude":139.69}]}
    UndiciResilience-->>WeatherService: Coordinates (with backoff retry)

    WeatherService->>UndiciResilience: Request with rate limiting
    UndiciResilience->>OpenMeteoAPI: GET /v1/forecast?latitude=35.68&longitude=139.69
    Note over UndiciResilience: Rate limit: 10 req/sec
    OpenMeteoAPI-->>UndiciResilience: Weather data JSON
    UndiciResilience-->>WeatherService: Parsed weather response

    WeatherService-->>WeatherMCPServer: Formatted weather object
    WeatherMCPServer-->>StdioTransport: {"jsonrpc":"2.0","id":"3","result":{"content":[...]}}
    StdioTransport-->>AI Assistant: Weather information via stdout

    %% Error Handling with Circuit Breaker
    Note over WeatherService,UndiciResilience: If circuit open or API fails
    UndiciResilience-->>WeatherService: Circuit breaker open/API error
    WeatherService-->>WeatherMCPServer: Error with details
    WeatherMCPServer-->>StdioTransport: {"jsonrpc":"2.0","id":"3","error":{"code":-32603,"message":"..."}}
    StdioTransport-->>AI Assistant: Error response
```

### Component Interactions

```mermaid
graph TB
    A[Client/AI Assistant] --> B[Transport Layer]
    B --> C{MCP Protocol Handler}

    C --> D[WeatherMCPServer]
    D --> E[WeatherService]

    E --> R[Undici Resilience Layer]
    R --> F[Open-Meteo Geocoding API]
    R --> G[Open-Meteo Weather API]

    D --> H[Pino Logger]
    D --> I[Configuration]

    B --> J[HTTP Transport<br/>StreamableHTTPTransport]
    B --> K[Stdio Transport<br/>StdioServerTransport]

    J --> L[Fastify Server]
    J --> M[SSE Handler]
    J --> S[Session Manager]

    R --> CB[Circuit Breaker]
    R --> RL[Rate Limiter]
    R --> RT[Retry Strategy]
    R --> BH[Bulkhead Pattern]
    R --> PM[Pool Manager]

    subgraph "Core Components"
        D
        E
        H
        I
    end

    subgraph "Transport Options"
        J
        K
        L
        M
        S
    end

    subgraph "Resilience Patterns"
        CB
        RL
        RT
        BH
        PM
    end

    subgraph "External APIs"
        F
        G
    end

    style R fill:#f9f,stroke:#333,stroke-width:2px
    style CB fill:#ffd,stroke:#333,stroke-width:1px
    style RL fill:#ffd,stroke:#333,stroke-width:1px
    style RT fill:#ffd,stroke:#333,stroke-width:1px
    style BH fill:#ffd,stroke:#333,stroke-width:1px
    style PM fill:#ffd,stroke:#333,stroke-width:1px
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

**HTTP Transport** (recommended for development)
```bash
npm run http
```

**Stdio Transport** (for AI assistants)
```bash
npm run stdio
```

**Development with Auto-restart**
```bash
npm run dev
```

#### Production Mode

**Build the Project**
```bash
npm run build
```

**Start Production Server**
```bash
npm start
```

#### Docker
Refer **[DOCKER-DEPLOYMENT.md](docs/DOCKER-DEPLOYMENT.md)**

## 🔧 Configuration

The server uses environment variables for configuration. Copy `.env.example` to `.env` and modify as needed:

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

- `POST /mcp` - Send MCP messages
- `GET /mcp` - Establish SSE stream for receiving messages
- `DELETE /mcp` - Terminate session

**Headers:**
- `MCP-Protocol-Version: 2025-06-18`
- `Mcp-Session-Id: <uuid>`
- `Content-Type: application/json`
- `Accept: application/json, text/event-stream`

## 🧪 Testing

For comprehensive testing instructions, see **[TESTING.md](docs/TESTING.md)** - a complete guide covering both stdio and HTTP transport testing.

### Quick Test Commands

#### Unit Tests

**Run All Tests**
```bash
npm test
```

**Run Tests with Coverage**
```bash
npm run test:coverage
```

#### HTTP Transport Testing

**Start HTTP Server**
```bash
npm run http
```

**Test with curl**
```bash
# Initialize session
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -d '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl-test","version":"1.0.0"}}}'

# Get current weather (use session ID from initialize response)
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: YOUR_SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":"2","method":"tools/call","params":{"name":"get_current_weather","arguments":{"city":"London"}}}'
```

**Health Check**
```bash
curl http://localhost:8080/health
```

#### Stdio Transport Testing

**Quick Stdio Test**
```bash
echo '{"jsonrpc":"2.0","id":"1","method":"tools/list"}' | npm run stdio
```

For detailed testing scenarios including manual curl commands, environment configuration, load testing, and troubleshooting, refer to **[docs/TESTING.md](docs/TESTING.md)**.

#### Postman Testing

**Quick Import:**
1. Start the server: `npm run http`
2. Open Postman and click "Import"
3. Import the file **[docs/mcp_weather.postman_collection.json](docs/mcp_weather.postman_collection.json)**
4. All requests are pre-configured with proper headers and variables!

## 🔌 Integration Examples

### Cline (Local AI Assistant)

**Complete Setup Guide**: See **[CLINE-INTEGRATION.md](docs/agent_mcp_setting/CLINE-INTEGRATION.md)** for detailed Cline integration instructions.

**Quick Configuration** (Stdio Transport):
Refer **[cline_mcp_settings.json](docs/agent_mcp_setting/cline_mcp_settings.json)**

**Quick Configuration** (HTTP Streamable Transport):
Refer **[cline_mcp_settings_http.json](docs/agent_mcp_setting/cline_mcp_settings_http.json)**

**Usage**: Ask Cline natural language questions like "What's the weather in London?" or "Should I bring an umbrella to Paris?"

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

## 🔒 Security

- **Input Validation**: All inputs are validated and sanitized
- **Origin Checks**: CORS validation for HTTP requests
- **Rate Limiting**: Built-in request throttling
- **HTTPS**: SSL/TLS support in production
- **No API Keys**: Uses free Open-Meteo API (no credentials needed)

## 📊 Session Management (HTTP Transport)

The HTTP transport includes a sophisticated session management system for handling stateful connections over HTTP/SSE:

### Session Manager Components

#### 1. **Session Identification**
- Generates unique UUID v4 session IDs for each client
- Session ID transmitted via `Mcp-Session-Id` header
- Sessions persist across multiple HTTP requests

#### 2. **Client Connection Registry**
```typescript
private clients: Map<string, ClientConnection> = new Map();
```
- Maintains active SSE connections mapped by session ID
- Tracks response objects for real-time message delivery
- Enables targeted notifications to specific clients

#### 3. **Message Queue System**
```typescript
private messageQueues: Map<string, unknown[]> = new Map();
```
- **In-memory message buffering** for disconnected clients
- Messages queued when client temporarily offline
- Automatic delivery when client reconnects with same session ID
- Supports resumable connections via `Last-Event-Id` header

#### 4. **Connection Lifecycle**
- **Session Creation**: New UUID generated on first request without session ID
- **Keep-Alive**: Maintains persistent SSE connections for real-time updates
- **Graceful Disconnection**: Automatic cleanup on client disconnect
- **Explicit Termination**: DELETE request ends session and clears queues

### Message Queueing Behavior

**When Messages are Queued:**
- Client connection lost (network interruption)
- Client not yet established SSE stream
- Server needs to send notification to offline client

**Queue Limitations:**
⚠️ **Important**: Messages are stored in-memory only
- Lost on server restart
- No persistence to disk/database
- Limited by available RAM
- No built-in size limits or TTL

**Queue Cleanup Triggers:**
1. Client disconnects normally (SSE stream closes)
2. Connection error occurs
3. Session explicitly terminated (DELETE request)
4. Server shutdown

### Session Recovery Flow

1. Client disconnects unexpectedly
2. Server queues subsequent messages for that session
3. Client reconnects with same `Mcp-Session-Id`
4. Client provides `Last-Event-Id` header (optional)
5. Server delivers all queued messages
6. Normal SSE stream resumes

### Production Considerations

For production deployments, consider:
- Adding Redis/database for persistent message storage
- Implementing queue size limits and message TTL
- Setting session timeout policies
- Adding metrics for queue depths and session counts
- Implementing distributed session storage for multi-server deployments

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

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
- **Cline Integration**: [CLINE-INTEGRATION.md](docs/agent_mcp_setting/CLINE-INTEGRATION.md) - Complete Cline setup guide

**Made with ❤️ for the AI assistant community**
