# MCP Weather Server Transport Strategy

## Table of Contents

1. [Overview](#overview)
2. [Modern Dual Transport Architecture](#modern-dual-transport-architecture)
   - [Stdio Transport](#1-stdio-transport-local-development)
   - [Streamable HTTP Transport](#2-streamable-http-transport-production)
3. [Transport Decision Matrix](#transport-decision-matrix)
4. [Transport Comparison](#transport-comparison)
5. [Architecture Evolution](#architecture-evolution)
6. [Production Considerations](#production-considerations)
7. [Client Configuration Examples](#client-configuration-examples)
8. [Performance & Security](#performance--security)

## Overview

The MCP Weather Server implements a **modern dual-transport strategy** optimized for the latest MCP SDK patterns, providing maximum compatibility while maintaining simplicity and performance.

**Architecture Evolution (v2.5.0):** Streamlined from a three-transport system to a focused dual-transport approach, removing the legacy SSE transport to align with MCP protocol evolution toward **Streamable HTTP** as the standard for remote connections.

## Modern Dual Transport Architecture

### 1. **Stdio Transport** (Local Development)
- **Protocol**: Standard input/output streams  
- **Port**: None (process communication)
- **Primary Use**: Local development with VS Code extensions
- **Clients**: Cline (local), CLI tools, development environments
- **SDK Integration**: `StdioServerTransport` from `@modelcontextprotocol/sdk`

### 2. **Streamable HTTP Transport** (Production)
- **Protocol**: HTTP with SSE streaming (MCP v2025-06-18 compliant)
- **Port**: 8080 (configurable)
- **Primary Use**: Production deployments, microservices, remote AI agents
- **Clients**: LangChain, MCP Inspector, web applications, AI agents
- **SDK Integration**: `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk`

## Transport Decision Matrix

| Your Need | Recommended Transport | Why | Command |
|-----------|---------------------|-----|---------|
| Local Cline Development | **Stdio** | Zero latency, simple setup | `npm run stdio` |
| Production APIs | **Streamable HTTP** | Scalable, session management | `npm run http` |
| LangChain/AI Agents | **Streamable HTTP** | Standard REST patterns | `npm run http` |
| Docker Deployment | **Streamable HTTP** | Container-friendly | `npm run http` |
| Web Applications | **Streamable HTTP** | Full HTTP features | `npm run http` |
| MCP Inspector Testing | **Streamable HTTP** | Native support | `npm run http` |
| CLI Tools | **Stdio** | Direct process communication | `npm run stdio` |
| Kubernetes/Cloud | **Streamable HTTP** | Load balancing, monitoring | `npm run http` |

## Transport Comparison

| Feature | Stdio | Streamable HTTP |
|---------|-------|-----------------|
| **Latency** | Minimal (<1ms) | Low (5-20ms) |
| **Scalability** | Single client | High (horizontal) |
| **Complexity** | Simple | Moderate |
| **Session Management** | No | Yes (with UUID) |
| **Authentication** | Process-based | Headers/Tokens |
| **Load Balancing** | No | Yes |
| **CORS Support** | N/A | Yes |
| **Monitoring** | Basic | Full (health checks) |
| **Resource Usage** | Minimal | Moderate |
| **Network Required** | No | Yes |
| **Production Ready** | Local only | ✅ Yes |

## Architecture Evolution

### Why Streamline to Dual Transport?

1. **Protocol Evolution**: MCP standard moving toward Streamable HTTP for remote connections
2. **Reduced Complexity**: Fewer transports = easier maintenance and testing  
3. **Better Performance**: Focus resources on optimizing two excellent transports
4. **Cleaner Architecture**: Perfect SOLID compliance with simplified transport layer

### What Changed in v2.5.0?

| Change | Before | After | Benefit |
|--------|--------|-------|---------|
| **Transport Count** | 3 (stdio, HTTP, SSE) | 2 (stdio, HTTP) | Simplified maintenance |
| **Remote Access** | Custom SSE implementation | Standard Streamable HTTP | Better compatibility |
| **SDK Integration** | Mixed manual/SDK code | Full SDK patterns | Latest MCP features |
| **Code Complexity** | 40% more complex | Streamlined | Easier debugging |

## Production Considerations

### Streamable HTTP Advantages

```typescript
// Modern MCP SDK patterns with Fastify
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  enableDnsRebindingProtection: false, // Local dev
  onsessioninitialized: (sessionId) => {
    transports[sessionId] = transport;
  }
});

await mcpServer.connect(transport);
```

**Key Benefits:**
- **Session Management**: UUID-based session tracking
- **Scalability**: Stateless horizontal scaling  
- **Standard Tooling**: Works with all HTTP infrastructure
- **Security**: Full HTTP authentication support
- **Monitoring**: Rich metrics and health endpoints

### When to Use Each Transport

| Use Case | Transport | Reason |
|----------|-----------|--------|
| **Local Development** | Stdio | No network setup, instant feedback |
| **Remote AI Agents** | Streamable HTTP | Production-grade, scalable |
| **Microservices** | Streamable HTTP | Standard patterns, monitoring |
| **Container Deployment** | Streamable HTTP | Network-based, health checks |
| **CLI Automation** | Stdio | Direct process control |
| **Browser Integration** | Streamable HTTP | CORS support, sessions |

## Client Configuration Examples

### 1. Cline Local (Stdio)

```json
{
  "mcpServers": {
    "weather": {
      "command": "npx",
      "args": ["tsx", "src/server.ts"],
      "cwd": "/path-to/mcp-weather-server",
      "env": {
        "MCP_TRANSPORT": "stdio",
        "LOG_LEVEL": "info",
        "NODE_ENV": "production"
      },
      "type": "stdio",
      "disabled": false,
      "autoApprove": [
        "get_current_weather",
        "get_weather_forecast", 
        "retrieve_weather_context"
      ],
      "timeout": 30000
    }
  }
}
```

### 2. Production AI Agent (Streamable HTTP)

```python
import httpx
import asyncio

class MCPWeatherClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session_id = None
    
    async def initialize(self):
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/mcp",
                json={
                    "jsonrpc": "2.0",
                    "id": "1",
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2025-06-18",
                        "capabilities": {},
                        "clientInfo": {"name": "ai-agent", "version": "1.0.0"}
                    }
                },
                headers={"MCP-Protocol-Version": "2025-06-18"}
            )
            self.session_id = response.headers.get("Mcp-Session-Id")
    
    async def get_weather(self, city: str):
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/mcp",
                json={
                    "jsonrpc": "2.0",
                    "id": "2", 
                    "method": "tools/call",
                    "params": {
                        "name": "get_current_weather",
                        "arguments": {"city": city}
                    }
                },
                headers={"Mcp-Session-Id": self.session_id}
            )
            return response.json()
```

### 3. MCP Inspector

```bash
# For Streamable HTTP Transport
mcp-inspector http http://localhost:8080/mcp

# For Stdio Transport  
mcp-inspector stdio "npx tsx src/server.ts"
```

### 4. Health Monitoring

```bash
# Check server health
curl http://localhost:8080/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2025-09-14T23:58:00.000Z", 
  "version": "2.5.0",
  "transport": "http",
  "activeSessions": 3
}
```

## Performance & Security

### Performance Characteristics

| Metric | Stdio | Streamable HTTP |
|--------|-------|-----------------|
| **Startup Time** | ~4ms | ~58ms |
| **Request Latency** | <1ms | 5-20ms (local) |
| **Memory per Client** | ~2MB | ~5MB |
| **Concurrent Clients** | 1 | 1000+ |
| **Throughput** | High | Very High |

### Security Features

| Feature | Stdio | Streamable HTTP |
|---------|-------|-----------------|
| **Process Isolation** | ✅ Parent process | ✅ Container isolation |
| **Network Security** | ❌ Not applicable | ✅ HTTPS, CORS |
| **Authentication** | ❌ Process-based | ✅ Headers, tokens |
| **Input Validation** | ✅ Zod schemas | ✅ Zod schemas |
| **Rate Limiting** | ❌ Not needed | ✅ Built-in |
| **Audit Logging** | ✅ Pino structured | ✅ Pino structured |

## Configuration

### Environment Variables

```bash
# Transport selection
MCP_TRANSPORT=stdio  # Options: stdio, http

# Port configuration (HTTP only)
MCP_HTTP_PORT=8080   # Default: 8080

# Logging
LOG_LEVEL=info       # Default: info

# Environment
NODE_ENV=production  # Default: development
```

### Starting Each Transport

```bash
# Stdio Transport (Local Development)
npm run stdio
# or
MCP_TRANSPORT=stdio npm run dev

# HTTP Transport (Production)
npm run http  
# or
MCP_TRANSPORT=http npm run dev
```

### Docker Configuration

```dockerfile
# Streamable HTTP optimized for containers
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci --only=production

# Health check using built-in endpoint
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080
ENV MCP_TRANSPORT=http
ENV MCP_HTTP_PORT=8080
ENV NODE_ENV=production

CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

```bash
# Check current transport
echo $MCP_TRANSPORT

# Force specific transport
MCP_TRANSPORT=stdio npm run dev  # Local
MCP_TRANSPORT=http npm run dev   # Production

# Check port conflicts
lsof -i :8080

# Use different port
MCP_HTTP_PORT=3000 MCP_TRANSPORT=http npm run dev

# Debug with verbose logging
LOG_LEVEL=debug npm run dev
```

### Transport Selection Logic

```typescript
// Automatic transport selection in server.ts
const transportType = process.env.MCP_TRANSPORT || 'stdio';

if (transportType === 'http') {
  // Use Streamable HTTP with Fastify
  setupHTTPTransport();
} else {
  // Default to stdio for local development
  setupStdioTransport();
}
```

## Migration Guide

### From Legacy SSE to Streamable HTTP

If you were using the deprecated SSE transport:

```bash
# Before (deprecated)
MCP_TRANSPORT=sse npm run dev

# After (modern)
MCP_TRANSPORT=http npm run dev
```

**Key Changes:**
- URL changes from `/sse` to `/mcp`
- Uses standard MCP session management
- Better error handling and monitoring
- Full SDK compliance

### Update Client Configurations

```json
// Old SSE config (deprecated)
{
  "url": "http://localhost:8081/sse",
  "transport": {"type": "sse"}
}

// New Streamable HTTP config
{
  "url": "http://localhost:8080/mcp", 
  "transport": {"type": "http"}
}
```

## Summary

The modern dual-transport strategy provides:

1. **Simplified Architecture** - Two excellent transports instead of three
2. **Latest MCP SDK** - Full compliance with modern patterns
3. **Production Ready** - Streamable HTTP optimized for scale
4. **Developer Friendly** - Stdio perfect for local development
5. **Future Proof** - Aligned with MCP protocol evolution

**Choose your transport based on deployment:**
- **Local development** → Stdio
- **Everything else** → Streamable HTTP

---

**Version**: 2.5.0  
**MCP Protocol**: 2025-06-18  
**Last Updated**: September 14, 2025
