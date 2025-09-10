# MCP Weather Server Transport Strategy

## Overview

The MCP Weather Server implements a **three-transport strategy** to maximize compatibility and flexibility across different deployment scenarios and client types.

## Three Transport Architecture

### 1. **Stdio Transport** (Local Development)
- **Protocol**: Standard input/output streams
- **Port**: None (process communication)
- **Primary Use**: Local development with VS Code extensions
- **Clients**: Cline (local), CLI tools, development environments

### 2. **Streamable HTTP Transport** (Production/Enterprise)
- **Protocol**: HTTP with SSE streaming
- **Port**: 8080 (configurable)
- **Primary Use**: Production deployments, microservices
- **Clients**: MCP Inspector,  LangChain/LangGraphCrewAI/AutoGen/OpenAI, web applications, API gateways

### 3. **Simple SSE Transport** (Remote Cline)
- **Protocol**: Server-Sent Events
- **Port**: 8081 (configurable)
- **Primary Use**: Remote Cline connections, lightweight clients
- **Clients**: Cline (remote), simple bots, quick prototypes

## Transport Decision Matrix

| Your Need | Recommended Transport | Why | Command |
|-----------|---------------------|-----|---------|
| Local Cline Development | **Stdio** | Zero latency, simple setup | `npm run stdio` |
| Remote Cline Access | **Simple SSE** | Cline compatible, lightweight | `npm run sse` |
|  LangChain/LangGraphCrewAI/AutoGen/OpenAI + Docker | **Streamable HTTP** | Production ready, scalable | `npm run http` |
| Web Applications | **Streamable HTTP** | Full HTTP features, sessions | `npm run http` |
| MCP Inspector Testing | **Streamable HTTP** | Native support, debugging | `npm run http` |
| CLI Tools | **Stdio** | Direct process communication | `npm run stdio` |
| Kubernetes/Cloud | **Streamable HTTP** | Load balancing, monitoring | `npm run http` |
| Quick Prototypes | **Simple SSE** | Easy integration | `npm run sse` |

## Transport Comparison

| Feature | Stdio | Streamable HTTP | Simple SSE |
|---------|-------|-----------------|------------|
| **Latency** | Minimal | Low-Medium | Low |
| **Scalability** | Single client | High | Medium |
| **Complexity** | Simple | Complex | Medium |
| **Session Management** | No | Yes | No |
| **Authentication** | Process-based | Headers/Tokens | Basic |
| **Load Balancing** | No | Yes | Limited |
| **CORS Support** | N/A | Yes | Yes |
| **Monitoring** | Basic | Full | Basic |
| **Resource Usage** | Minimal | Higher | Medium |
| **Network Required** | No | Yes | Yes |

## Configuration

### Environment Variables

```bash
# Transport selection
MCP_TRANSPORT=stdio  # Options: stdio, http, sse

# Port configuration
MCP_HTTP_PORT=8080   # For HTTP transport
MCP_SSE_PORT=8081    # For SSE transport
```

### Starting Each Transport

```bash
# Stdio Transport (Local Cline)
npm run stdio
# or
MCP_TRANSPORT=stdio npm run dev

# HTTP Transport (Production/MCP Inspector)
npm run http
# or
MCP_TRANSPORT=http npm run dev

# SSE Transport (Remote Cline)
npm run sse
# or
MCP_TRANSPORT=sse npm run dev
```

## Client Configuration Examples

### 1. Cline Local (Stdio)

```json
{
  "mcpServers": {
    "weather": {
      "command": "npx",
      "args": [
        "tsx",
        "src/server.ts"
      ],
      "cwd": "/Users/kumaraniyyasamysrinivasan/mydrive/personal/mcp-weather-server",
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
      "alwaysAllow": [
        "tools/list"
      ],
      "timeout": 30000
    }
  }
}
```

### 2. Cline Remote (Simple SSE)

```json
{
  "mcpServers": {
    "weather-remote": {
      "autoApprove": [
        "get_current_weather",
        "get_weather_forecast",
        "retrieve_weather_context"
      ],
      "disabled": false,
      "timeout": 30000,
      "type": "sse",
      "url": "http://localhost:8081/sse"
    }
  }
}
```

### 3. LangChain/LangGraphCrewAI/AutoGen/OpenAI (Streamable HTTP)

```python
from langchain import MCPClient

client = MCPClient(
    base_url="http://your-server:8080/mcp",
    transport="http",
    headers={"Authorization": "Bearer token"}
)

# Use the weather tools
response = await client.tools.call(
    name="get_current_weather",
    arguments={"city": "London"}
)
```

### 4. MCP Inspector

```bash
# For HTTP Transport
mcp-inspector http http://localhost:8080/mcp

# For Stdio Transport
mcp-inspector stdio "npx tsx src/server.ts"
```

## Deployment Scenarios

### Local Development

```bash
# Use stdio for zero-config local development
npm run stdio
```

**Best for:**
- VS Code with Cline
- Quick testing
- Debugging
- No network setup

### Cloud Functions / Serverless

```javascript
// Use HTTP transport for serverless
exports.handler = async (event) => {
  process.env.MCP_TRANSPORT = 'http';
  // Handle MCP requests
};
```

## Architecture Decisions

### Why Three Transports?

1. **Different Clients Have Different Needs**
   - Cline uses stdio locally, SSE remotely
   -  LangChain/LangGraphCrewAI/AutoGen/OpenAI prefers HTTP APIs
   - MCP Inspector supports both stdio and HTTP

2. **Deployment Flexibility**
   - Local: stdio (no network)
   - Cloud: HTTP (scalable)
   - Hybrid: SSE (simple remote)

3. **Future Compatibility**
   - Ready for new MCP clients
   - Supports evolving standards
   - Easy to add WebSocket later

### Why Not Replace HTTP with SSE?

1. **HTTP is Production-Ready**
   - Session management
   - Full HTTP features
   - Enterprise authentication
   - Load balancer compatible

2. **SSE is Simpler but Limited**
   - No session management
   - Limited error handling
   - Single connection model
   - Less monitoring capability

3. **They Serve Different Purposes**
   - HTTP: Production, APIs, enterprise
   - SSE: Remote Cline, simple clients
   - Both valuable for different use cases

## Performance Considerations

### Stdio Transport
- **Latency**: < 1ms
- **Throughput**: Limited by process I/O
- **Memory**: Minimal overhead
- **CPU**: Negligible

### HTTP Transport
- **Latency**: 5-20ms (local), 50-200ms (remote)
- **Throughput**: High with connection pooling
- **Memory**: ~50MB per 100 connections
- **CPU**: Moderate with SSL/TLS

### SSE Transport
- **Latency**: 10-30ms
- **Throughput**: Medium
- **Memory**: ~20MB per 100 connections
- **CPU**: Low-moderate

## Security Considerations

### Stdio
- Process isolation
- No network exposure
- Inherits parent process permissions

### HTTP
- HTTPS/TLS support
- Authentication headers
- CORS configuration
- Rate limiting

### SSE
- Basic CORS support
- Client ID tracking
- Connection limits

## Monitoring & Observability

### Metrics by Transport

| Metric | Stdio | HTTP | SSE |
|--------|-------|------|-----|
| Connection Count | N/A | ✅ | ✅ |
| Request Rate | ✅ | ✅ | ✅ |
| Error Rate | ✅ | ✅ | ✅ |
| Latency | ✅ | ✅ | ✅ |
| Session Duration | N/A | ✅ | ✅ |
| Memory Usage | ✅ | ✅ | ✅ |

## Migration Guide

### From Stdio to HTTP

```bash
# Before (local only)
MCP_TRANSPORT=stdio npm run dev

# After (network accessible)
MCP_TRANSPORT=http npm run dev
# Access at http://localhost:8080/mcp
```

### From HTTP to SSE (for Cline)

```bash
# Start SSE server
MCP_TRANSPORT=sse npm run dev

# Update Cline config
{
  "url": "http://your-server:8081/sse",
  "transport": { "type": "sse" }
}
```

## Troubleshooting

### Transport Selection Issues

```bash
# Check current transport
echo $MCP_TRANSPORT

# Force specific transport
MCP_TRANSPORT=stdio npm run dev  # Stdio
MCP_TRANSPORT=http npm run dev   # HTTP
MCP_TRANSPORT=sse npm run dev    # SSE
```

### Port Conflicts

```bash
# Check port usage
lsof -i :8080  # HTTP
lsof -i :8081  # SSE

# Use different ports
MCP_HTTP_PORT=3000 MCP_TRANSPORT=http npm run dev
MCP_SSE_PORT=3001 MCP_TRANSPORT=sse npm run dev
```

## Future Roadmap

### Planned Enhancements

1. **WebSocket Transport** (Q2 2025)
   - Real-time bidirectional
   - Lower latency than SSE
   - Better for chat interfaces

2. **gRPC Transport** (Q3 2025)
   - Binary protocol
   - Better performance
   - Strong typing

3. **Multi-Transport Mode** (Q4 2025)
   - Run all transports simultaneously
   - Single server, multiple protocols
   - Unified configuration

## Summary

The three-transport strategy provides:

1. **Maximum Compatibility** - Works with all MCP clients
2. **Deployment Flexibility** - From local to cloud
3. **Future-Proof Architecture** - Ready for new protocols
4. **Optimal Performance** - Right transport for each use case

Choose your transport based on your specific needs:
- **Local development?** → Stdio
- **Production API?** → HTTP
- **Remote Cline?** → SSE

---

Last Updated: September 2025
MCP Version: 2025-06-18