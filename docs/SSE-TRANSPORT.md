# SSE Transport Documentation

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Protocol Specification](#protocol-specification)
- [Implementation Details](#implementation-details)
- [Client Integration](#client-integration)
- [Security Considerations](#security-considerations)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

## Overview

The Server-Sent Events (SSE) transport provides a lightweight, HTTP-based real-time communication mechanism for MCP (Model Context Protocol) servers. This transport is specifically designed for compatibility with remote clients like Cline that require a simple, firewall-friendly protocol.

### Key Features

- **Unidirectional streaming**: Server-to-client push notifications
- **HTTP-based**: Works through firewalls and proxies
- **Auto-reconnection**: Built-in reconnection support
- **Simple protocol**: Easy to implement and debug
- **Text-based**: Human-readable message format
- **Event typing**: Support for different message types

### Use Cases

1. **Remote Cline connections**: Primary use case for AI assistant integration
2. **Browser-based clients**: Direct integration without WebSocket complexity
3. **Monitoring dashboards**: Real-time weather updates
4. **Mobile applications**: Efficient battery-conscious updates

## Architecture

### System Components

```
┌─────────────┐      HTTP GET       ┌──────────────┐
│             │ ──────────────────> │              │
│   Client    │      /sse           │  SSE Server  │
│   (Cline)   │ <────────────────── │   (Port      │
│             │   Event Stream      │    8081)     │
└─────────────┘                     └──────────────┘
       │                                    │
       │         HTTP POST                  │
       └────────────────────────────────────┘
              /messages/{clientId}
```

### Message Flow

1. **Connection Phase**:
   - Client connects via HTTP GET to `/sse`
   - Server sends `endpoint` event with unique message URL
   - Connection kept alive with periodic heartbeats

2. **Communication Phase**:
   - Client POSTs JSON-RPC messages to provided endpoint
   - Server processes message and sends response via SSE
   - Bidirectional communication over unidirectional channel

3. **Disconnection Phase**:
   - Client closes connection or times out
   - Server cleans up resources
   - Client can reconnect with Last-Event-Id

## Protocol Specification

### SSE Event Format

```
event: <event-type>
id: <message-id>
data: <json-payload>

```

### Event Types

#### 1. Endpoint Event
Sent immediately after connection to provide the message posting URL.

```
event: endpoint
data: http://localhost:8081/messages/client-123-456

```

#### 2. Message Event
MCP protocol messages sent from server to client.

```
event: message
id: msg-789
data: {"jsonrpc":"2.0","id":1,"result":{"temperature":20.5}}

```

#### 3. Error Event
Error notifications for protocol violations or server errors.

```
event: error
data: {"code":-32603,"message":"Internal server error"}

```

#### 4. Heartbeat
Keep-alive signal sent every 30 seconds.

```
:keepalive

```

### HTTP Endpoints

#### GET /sse
Establishes SSE connection for receiving server events.

**Headers**:
- `Accept`: text/event-stream
- `Cache-Control`: no-cache
- `Last-Event-Id`: (optional) Resume from last received event

**Response**:
- `Content-Type`: text/event-stream
- `Cache-Control`: no-cache
- `Connection`: keep-alive

#### POST /messages/{clientId}
Submit MCP messages to the server.

**Headers**:
- `Content-Type`: application/json

**Body**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_current_weather",
    "arguments": {"city": "London"}
  },
  "id": 1
}
```

**Response**:
- Status: 202 Accepted
- Body: `{}`

## Implementation Details

### Server Implementation

```typescript
export class SimpleSSETransport {
  private httpServer: Server;
  private clients: Map<string, ClientConnection>;
  private port: number;
  private weatherServer: WeatherMCPServer;

  constructor(weatherServer: WeatherMCPServer, port: number = 8081) {
    this.weatherServer = weatherServer;
    this.port = port;
    this.clients = new Map();
    this.httpServer = createServer(this.handleRequest.bind(this));
  }

  private async handleSSEConnection(req: IncomingMessage, res: ServerResponse) {
    // Generate unique client ID
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Client-Id': clientId
    });

    // Send endpoint event
    const endpointUrl = `http://localhost:${this.port}/messages/${clientId}`;
    this.sendSSEEvent(res, 'endpoint', endpointUrl);

    // Store client connection
    this.clients.set(clientId, { res, lastEventId });

    // Setup keep-alive
    const keepAlive = setInterval(() => {
      res.write(':keepalive\n\n');
    }, 30000);

    // Handle disconnect
    req.on('close', () => {
      clearInterval(keepAlive);
      this.clients.delete(clientId);
    });
  }

  private sendSSEEvent(res: ServerResponse, event: string, data: any, id?: string) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    let message = `event: ${event}\n`;
    if (id) message += `id: ${id}\n`;
    message += `data: ${payload}\n\n`;
    res.write(message);
  }
}
```

### Client Connection Management

```typescript
interface ClientConnection {
  res: ServerResponse;
  lastEventId?: string;
  connectedAt: Date;
  lastActivity: Date;
  messageCount: number;
}

class ConnectionManager {
  private connections: Map<string, ClientConnection>;
  private readonly maxConnections = 100;
  private readonly connectionTimeout = 300000; // 5 minutes

  addConnection(clientId: string, res: ServerResponse): void {
    if (this.connections.size >= this.maxConnections) {
      throw new Error('Maximum connections reached');
    }

    this.connections.set(clientId, {
      res,
      connectedAt: new Date(),
      lastActivity: new Date(),
      messageCount: 0
    });
  }

  removeConnection(clientId: string): void {
    const conn = this.connections.get(clientId);
    if (conn) {
      conn.res.end();
      this.connections.delete(clientId);
    }
  }

  cleanupStale(): void {
    const now = Date.now();
    for (const [id, conn] of this.connections) {
      if (now - conn.lastActivity.getTime() > this.connectionTimeout) {
        this.removeConnection(id);
      }
    }
  }
}
```

## Client Integration

### Cline Configuration

```json
{
  "mcp-weather-server": {
    "transport": "sse",
    "url": "http://localhost:8081/sse",
    "timeout": 30000,
    "reconnect": {
      "enabled": true,
      "maxRetries": 5,
      "delay": 1000,
      "maxDelay": 30000
    }
  }
}
```

### JavaScript Client Example

```javascript
class MCPSSEClient {
  constructor(url) {
    this.url = url;
    this.eventSource = null;
    this.messageEndpoint = null;
    this.messageId = 0;
  }

  connect() {
    this.eventSource = new EventSource(this.url);

    this.eventSource.addEventListener('endpoint', (event) => {
      this.messageEndpoint = event.data;
      console.log('Connected to MCP server:', this.messageEndpoint);
    });

    this.eventSource.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    });

    this.eventSource.addEventListener('error', (event) => {
      console.error('SSE error:', event);
      this.reconnect();
    });
  }

  async sendMessage(method, params) {
    if (!this.messageEndpoint) {
      throw new Error('Not connected to server');
    }

    const message = {
      jsonrpc: '2.0',
      method,
      params,
      id: ++this.messageId
    };

    const response = await fetch(this.messageEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  handleMessage(message) {
    // Process MCP response
    if (message.result) {
      console.log('Result:', message.result);
    } else if (message.error) {
      console.error('Error:', message.error);
    }
  }

  reconnect() {
    setTimeout(() => {
      console.log('Reconnecting...');
      this.connect();
    }, 1000);
  }
}
```

## Security Considerations

### Authentication & Authorization

1. **Token-based Authentication**:
   ```typescript
   // Generate secure token
   const token = crypto.randomBytes(32).toString('hex');
   
   // Validate in connection handler
   if (req.headers.authorization !== `Bearer ${token}`) {
     res.writeHead(401);
     res.end('Unauthorized');
     return;
   }
   ```

2. **Rate Limiting**:
   ```typescript
   const rateLimiter = new RateLimiter({
     windowMs: 60000,
     maxRequests: 100
   });
   
   if (rateLimiter.isLimited(clientId)) {
     res.writeHead(429);
     res.end('Too Many Requests');
     return;
   }
   ```

3. **CORS Configuration**:
   ```typescript
   res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
   ```

### Input Validation

1. **Message Size Limits**:
   ```typescript
   const MAX_MESSAGE_SIZE = 100 * 1024; // 100KB
   
   if (Buffer.byteLength(body) > MAX_MESSAGE_SIZE) {
     res.writeHead(413);
     res.end('Payload Too Large');
     return;
   }
   ```

2. **JSON Schema Validation**:
   ```typescript
   const messageSchema = {
     type: 'object',
     required: ['jsonrpc', 'method'],
     properties: {
       jsonrpc: { const: '2.0' },
       method: { type: 'string' },
       params: { type: 'object' },
       id: { type: ['string', 'number', 'null'] }
     }
   };
   
   if (!validateSchema(message, messageSchema)) {
     throw new ValidationError('Invalid message format');
   }
   ```

### TLS/HTTPS Support

```typescript
import { createServer } from 'https';
import { readFileSync } from 'fs';

const options = {
  key: readFileSync('server-key.pem'),
  cert: readFileSync('server-cert.pem')
};

const httpsServer = createServer(options, this.handleRequest.bind(this));
```

## Performance Optimization

### Connection Pooling

```typescript
class ConnectionPool {
  private readonly maxPoolSize = 10;
  private readonly connections: ClientConnection[] = [];
  
  acquire(): ClientConnection {
    // Reuse existing connection or create new
    return this.connections.find(c => !c.inUse) || this.createNew();
  }
  
  release(conn: ClientConnection): void {
    conn.inUse = false;
    conn.lastActivity = new Date();
  }
}
```

### Message Batching

```typescript
class MessageBatcher {
  private queue: Message[] = [];
  private timer: NodeJS.Timeout;
  private readonly batchSize = 10;
  private readonly batchDelay = 100;
  
  add(message: Message): void {
    this.queue.push(message);
    
    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.batchDelay);
    }
  }
  
  flush(): void {
    if (this.queue.length === 0) return;
    
    const batch = this.queue.splice(0);
    this.sendBatch(batch);
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
```

### Compression

```typescript
import { createGzip } from 'zlib';

// Enable compression for large messages
if (payload.length > 1024) {
  res.setHeader('Content-Encoding', 'gzip');
  const gzip = createGzip();
  gzip.pipe(res);
  gzip.write(payload);
  gzip.end();
} else {
  res.write(payload);
}
```

## Troubleshooting

### Common Issues

#### 1. Connection Drops
**Symptom**: Client frequently disconnects
**Causes**:
- Network instability
- Proxy timeouts
- Keep-alive not working

**Solution**:
```typescript
// Increase keep-alive frequency
const keepAlive = setInterval(() => {
  res.write(':keepalive\n\n');
}, 15000); // 15 seconds instead of 30
```

#### 2. Message Loss
**Symptom**: Client misses messages
**Causes**:
- Network interruption
- Buffer overflow
- Client processing delays

**Solution**:
```typescript
// Implement message acknowledgment
class ReliableSSE {
  private pendingMessages: Map<string, Message> = new Map();
  
  sendWithAck(clientId: string, message: Message): void {
    const msgId = generateId();
    this.pendingMessages.set(msgId, message);
    this.send(clientId, { ...message, id: msgId });
    
    // Retry if not acknowledged
    setTimeout(() => {
      if (this.pendingMessages.has(msgId)) {
        this.resend(msgId);
      }
    }, 5000);
  }
}
```

#### 3. High Memory Usage
**Symptom**: Server memory grows over time
**Causes**:
- Connection leaks
- Message queue buildup
- No cleanup of disconnected clients

**Solution**:
```typescript
// Implement automatic cleanup
setInterval(() => {
  for (const [id, client] of this.clients) {
    if (!client.res.writable) {
      this.clients.delete(id);
      logger.info('Cleaned up dead connection', { clientId: id });
    }
  }
}, 60000); // Every minute
```

### Debug Logging

```typescript
// Enable detailed SSE logging
if (process.env.SSE_DEBUG === 'true') {
  logger.debug('SSE Event', {
    event: eventType,
    clientId,
    dataSize: data.length,
    timestamp: new Date().toISOString()
  });
}
```

### Health Checks

```typescript
// GET /health endpoint
if (url.pathname === '/health') {
  const health = {
    status: 'healthy',
    transport: 'sse',
    connections: this.clients.size,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(health));
}
```

## API Reference

### Class: SimpleSSETransport

#### Constructor
```typescript
new SimpleSSETransport(weatherServer: WeatherMCPServer, port?: number)
```

#### Methods

##### start()
Starts the SSE server.
```typescript
async start(): Promise<void>
```

##### stop()
Gracefully shuts down the server.
```typescript
async stop(): Promise<void>
```

##### getStats()
Returns server statistics.
```typescript
getStats(): {
  activeClients: number;
  port: number;
  transport: 'sse';
}
```

### Events

#### 'connection'
Emitted when a new client connects.
```typescript
transport.on('connection', (clientId: string) => {
  console.log(`Client connected: ${clientId}`);
});
```

#### 'disconnect'
Emitted when a client disconnects.
```typescript
transport.on('disconnect', (clientId: string) => {
  console.log(`Client disconnected: ${clientId}`);
});
```

#### 'error'
Emitted on server errors.
```typescript
transport.on('error', (error: Error) => {
  console.error(`Server error: ${error.message}`);
});
```

## Best Practices

1. **Always implement heartbeats** to detect stale connections
2. **Use unique client IDs** to prevent message routing conflicts
3. **Implement reconnection logic** on the client side
4. **Monitor connection count** to prevent resource exhaustion
5. **Log all connection events** for debugging
6. **Validate all input** to prevent injection attacks
7. **Use HTTPS in production** to ensure message privacy
8. **Implement rate limiting** to prevent abuse
9. **Clean up resources** on connection close
10. **Test with network interruptions** to ensure robustness

## References

- [Server-Sent Events W3C Specification](https://www.w3.org/TR/eventsource/)
- [MDN SSE Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [MCP Protocol Specification](https://github.com/modelcontextprotocol/specification)
- [Cline MCP Integration Guide](https://github.com/cline/cline-mcp)