# Production-Grade MCP Server Generator Template v3.0
## AI-Optimized for Claude Code & Cline - 100% mcp-weather-server Equivalent

> **VERSION**: 3.0.0
> **BASE**: mcp-weather-server v3.1.0 (Production Battle-Tested)
> **PURPOSE**: Generate production-ready MCP servers with AI coding assistants
> **COMPATIBILITY**: Claude Code, Cline, Cursor, GitHub Copilot

---

## 🎯 WHAT THIS TEMPLATE GENERATES

This template produces **enterprise-grade MCP servers** with the same quality and architecture as mcp-weather-server:

### **Tech Stack (Exact Match)**
```json
{
  "@modelcontextprotocol/sdk": "~1.17.5",  // Latest MCP SDK
  "fastify": "~5.6.0",                      // High-performance HTTP
  "pino": "~9.9.4",                         // Structured logging
  "zod": "~3.25.76",                        // Runtime validation
  "undici": "~7.16.0",                      // HTTP client with resilience
  "lru-cache": "~11.2.1",                   // Multi-tier caching
  "dompurify": "~3.2.0",                    // Security sanitization
  "typescript": "~5.9.2",                   // Type safety
  "vitest": "~3.2.4"                        // Testing framework
}
```

### **Architecture Features**
- ✅ **Perfect 3-Layer SOLID Architecture** (Transport → Protocol → Business)
- ✅ **Latest MCP SDK Patterns** (`McpServer`, `registerTool()`, Zod validation)
- ✅ **Enterprise Resilience** (Circuit Breaker, Bulkhead, Retry, Rate Limiting)
- ✅ **Security-First** (DOMPurify sanitization, threat detection, audit logging)
- ✅ **Multi-Tier Caching** (LRU with intelligent TTLs)
- ✅ **Comprehensive Monitoring** (Pino logging, metrics, health checks)
- ✅ **50+ Environment Variables** (Zod-validated configuration)
- ✅ **Rich Error Hierarchy** (Domain-specific error classes)
- ✅ **Deep Testing** (Unit + Integration + E2E tests)
- ✅ **Production CI/CD** (8 GitHub Actions workflows)
- ✅ **AI Agent-First Design** (≤25 tools, intent-based, directive responses)

---

## 🚀 QUICK START FOR AI ASSISTANTS

### **Step 1: Collect Requirements**

AI assistants can accept requirements in ANY format:

#### **Option A: Simple Form Input** 📝
```
SERVICE NAME: Weather Data Service
DOMAIN: Weather & Climate
NUMBER OF TOOLS: 3-5 (target ≤25)
EXTERNAL API: Open-Meteo API (https://api.open-meteo.com)
AUTHENTICATION: None (public API)
DESCRIPTION: Provide real-time weather data and forecasts
```

#### **Option B: OpenAPI 3.0 Specification** 📄
```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Weather Analytics API",
    "version": "1.0.0"
  },
  "paths": {
    "/weather": {
      "get": {
        "operationId": "getCurrentWeather",
        "parameters": [...]
      }
    }
  }
}
```

#### **Option C: User Story Format** 📋
```yaml
user_stories:
  - "As a user, I want to get current weather for any city"
  - "As a user, I want to see 7-day forecast"
  - "As a user, I want weather alerts for my location"

agent_workflows:
  - name: "Travel Planning"
    steps:
      - "User asks: What's the weather in Paris?"
      - "Agent calls: get_current_weather(city='Paris')"
      - "Agent responds with formatted weather data"
```

---

## 📋 AI AGENT-FIRST DESIGN PRINCIPLES

### **CRITICAL: Tool Count Limits**
- **Target: ≤25 tools** → Achieves >98% first-try selection accuracy
- **Warning: 30 tools** → Monitor selection degradation
- **Hard Limit: NEVER exceed 40 tools**
- **Impact**: At 40+ tools, even o1-preview struggles with tool selection

### **MANDATORY: Intent-Based Consolidation**

```javascript
// ❌ WRONG: 6 separate tools (decision paralysis)
tools: [
  "createUser",
  "readUser",
  "updateUser",
  "deleteUser",
  "getUserById",
  "searchUsers"
]

// ✅ RIGHT: 2 intent-based tools (clear purpose)
tools: [
  "manageUser",      // Handles create/read/update/delete
  "searchUsers"      // Handles queries
]
```

### **MANDATORY: Agent-Directive Response Format**

Every tool MUST return responses that guide the agent:

```typescript
// ✅ REQUIRED Response Structure
interface AgentResponse {
  success: boolean;
  data: any;                      // Only requested fields
  next_actions: string[];         // Machine-readable next steps
  suggestion: string;             // Human-readable guidance
  context?: any;                  // State for chaining
  metadata?: {
    cached: boolean;
    duration_ms: number;
    correlation_id: string;
  };
}

// ✅ REQUIRED Error Structure
interface AgentError {
  error_code: string;
  message: string;
  suggestion: string;             // How to fix/retry
  retry_after?: number;
  corrective_params?: object;     // Suggested parameter fixes
  correlation_id: string;
}
```

### **MANDATORY: Tool Naming Conventions**

```typescript
// ✅ Use specific, action-oriented verbs
"fetch_user_by_id"           // Get by identifier
"lookup_user_by_email"       // Get by attribute
"search_users"               // Query-based retrieval
"cancel_subscription"        // State-changing action
"escalate_to_human"          // Human-in-the-loop

// ❌ NEVER use generic verbs
"get_user"                   // Too generic
"process_data"               // Meaningless
"handle_request"             // What request?
```

### **MANDATORY: LLM-Optimized Descriptions (≤180 tokens)**

```typescript
// ✅ Perfect Tool Description Template
{
  name: "fetch_current_weather",
  description: `
    Get real-time weather data for a city.

    USE WHEN: User asks "What's the weather in {city}?" or needs current conditions.

    EXAMPLES:
    - fetch_current_weather(city="London") → Current temp, conditions, humidity
    - fetch_current_weather(city="Tokyo") → Real-time weather data

    OUTPUT: Returns temperature, conditions, humidity, wind speed, feels-like temperature.
    If city not found, returns error with suggestion to check spelling.

    NEXT STEPS:
    - If user wants forecast, call get_weather_forecast(city, days)
    - If user wants alerts, call get_weather_alerts(city)
    - If location unclear, call lookup_city_suggestions(query)

    NOTES: Data cached for 10 minutes. Uses Open-Meteo API.
  `,
  inputSchema: {
    city: z.string()
      .min(2)
      .max(100)
      .describe("City name (e.g., 'London', 'New York', 'Tokyo')")
  }
}
```

---

## 🏗️ PERFECT 3-LAYER SOLID ARCHITECTURE

### **Layer 1: Transport Layer (server.ts)**

**Responsibilities:**
- HTTP/Stdio transport management
- Fastify server with security headers
- Session management (UUID-based)
- Security middleware (sanitization, threat detection)
- Audit logging for ALL requests
- Graceful shutdown

```typescript
/**
 * [SERVICE_NAME] MCP Server - Transport Layer
 * SOLID: Single Responsibility - Infrastructure & Transport
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { [SERVICE_PASCAL]McpServer } from './[service]-mcp-server';
import { logger } from './logger-pino';
import { getConfig } from './config/config';
import { securityManager } from './security/sanitizer';
import { securityMonitor } from './security/security-monitor';
import { auditLogger } from './audit/audit-logger';

export async function main() {
  const config = getConfig();
  const mcpServer = new [SERVICE_PASCAL]McpServer();

  if (config.server.transport === 'http') {
    await startHttpTransport(mcpServer, config);
  } else {
    await startStdioTransport(mcpServer);
  }
}

async function startHttpTransport(mcpServer, config) {
  const fastify = Fastify({ logger: false });

  // Security headers
  fastify.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Content-Security-Policy', securityManager.getContentSecurityPolicy());
    return payload;
  });

  // Security middleware
  fastify.addHook('preHandler', async (request, reply) => {
    const startTime = Date.now();

    // 1. Sanitize headers
    const sanitizedHeaders = securityManager.sanitizeHeaders(request.headers);

    // 2. Monitor for threats
    const threats = securityMonitor.monitorRequest(
      request.method,
      request.url,
      sanitizedHeaders,
      request.body,
      request.ip
    );

    // 3. Block critical threats
    if (threats.some(t => t.severity === 'critical')) {
      auditLogger.logSecurity('request_blocked', 'http', 'success', 'critical', undefined, {
        threats,
        ip: request.ip
      });
      return reply.status(403).send({ error: 'Blocked due to security threat' });
    }

    // 4. Audit ALL requests
    auditLogger.logApiUsage(request.method, request.url, 0, 0, undefined, {
      ip: request.ip,
      phase: 'request_start'
    });

    request.securityContext = { startTime, threats };
  });

  // MCP endpoints
  const transports = {};

  fastify.post('/mcp', async (request, reply) => {
    const sessionId = request.headers['mcp-session-id'];
    let transport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => { transports[id] = transport; }
      });
      await mcpServer.getServer().connect(transport);
    }

    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  // Health check
  fastify.get('/health', async () => ({
    status: 'healthy',
    version: VERSION,
    activeSessions: Object.keys(transports).length
  }));

  // Security endpoints
  fastify.get('/security/threats', async () => ({
    threats: securityMonitor.getThreats().slice(0, 100)
  }));

  // Audit endpoints
  fastify.get('/audit/events', async (request) => {
    const { limit = 50, offset = 0 } = request.query;
    return auditLogger.query({ limit, offset });
  });

  await fastify.listen({ port: config.server.httpPort, host: '0.0.0.0' });
  logger.info(`HTTP transport started on port ${config.server.httpPort}`);
}

async function startStdioTransport(mcpServer) {
  const transport = new StdioServerTransport();
  await mcpServer.getServer().connect(transport);
}
```

### **Layer 2: Protocol Layer ([service]-mcp-server.ts)**

**Responsibilities:**
- MCP protocol implementation
- Tool registration with latest SDK
- Input validation with Zod
- Security sanitization
- Audit logging
- Performance tracking
- Agent-directive responses

```typescript
/**
 * [SERVICE_NAME] MCP Server - Protocol Layer
 * SOLID: Single Responsibility - MCP Protocol & Tool Orchestration
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z } from 'zod';
import { [SERVICE_PASCAL]Service } from './[service]-service';
import { logger } from './logger-pino';
import { securityManager } from './security/sanitizer';
import { auditLogger } from './audit/audit-logger';
import { VERSION, NAME } from './utils/version';

export class [SERVICE_PASCAL]McpServer {
  private mcpServer: McpServer;
  private service: [SERVICE_PASCAL]Service;

  constructor() {
    this.mcpServer = new McpServer({ name: NAME, version: VERSION });
    this.service = new [SERVICE_PASCAL]Service();
    this.setupTools();
  }

  private setupTools(): void {
    // AI: REGISTER YOUR TOOLS HERE
    // Follow this EXACT pattern for each tool

    this.mcpServer.registerTool(
      'tool_name',
      {
        title: 'Tool Title',
        description: `
          One-line purpose (≤20 tokens)

          USE WHEN: Intent/context (≤30 tokens)

          EXAMPLES:
          - tool_name(param="value") → Expected output
          - tool_name(param="another") → Another example

          OUTPUT: What response means (≤40 tokens)

          NEXT STEPS:
          - If condition A, call tool_x
          - If condition B, call tool_y
          - If uncertain, escalate_to_human

          NOTES: Warnings/caveats (≤20 tokens)
        `,
        inputSchema: {
          param1: z.string()
            .min(1)
            .max(100)
            .describe("Concrete parameter description with examples"),
          param2: z.number()
            .optional()
            .describe("Optional parameter (defaults to X)")
        }
      },
      async ({ param1, param2 }) => {
        const startTime = Date.now();
        const correlationId = generateCorrelationId();

        try {
          // 1. Security: Sanitize inputs
          const sanitizedInput = securityManager.sanitizeInput({ param1, param2 });

          // 2. Validate business rules
          if (!this.validateBusinessRules(sanitizedInput)) {
            throw new Error('Business rule validation failed');
          }

          // 3. Audit: Log data access
          auditLogger.logDataAccess(
            'read',
            'resource_name',
            'success',
            undefined,
            {
              method: 'tool_name',
              payload: sanitizedInput,
              correlationId
            }
          );

          // 4. Business: Delegate to service layer
          const result = await this.service.methodName(sanitizedInput);

          // 5. Performance: Track metrics
          logger.logPerformance('tool_name', startTime, {
            success: true,
            correlationId
          });

          // 6. Audit: Log successful API usage
          auditLogger.logApiUsage(
            'POST',
            '/tools/tool_name',
            200,
            Date.now() - startTime,
            undefined,
            {
              payload: sanitizedInput,
              responseSize: JSON.stringify(result).length,
              correlationId
            }
          );

          // 7. Return agent-directive response
          return this.formatAgentResponse(result, correlationId, 'tool_name');

        } catch (error) {
          // 8. Audit: Log error
          auditLogger.logDataAccess(
            'read',
            'resource_name',
            'error',
            undefined,
            {
              method: 'tool_name',
              error: error.message,
              correlationId,
              duration: Date.now() - startTime
            }
          );

          // 9. Return agent-directive error
          return this.formatAgentError(error, correlationId, 'tool_name');
        }
      }
    );
  }

  /**
   * Format agent-directive response (MANDATORY)
   */
  private formatAgentResponse(data: any, correlationId: string, toolName: string) {
    // Determine next actions based on response
    const nextActions = this.determineNextActions(toolName, data);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data,
          next_actions: nextActions,
          suggestion: this.generateSuggestion(toolName, nextActions, data),
          metadata: {
            correlation_id: correlationId,
            timestamp: new Date().toISOString(),
            cached: false
          }
        }, null, 2)
      }]
    };
  }

  /**
   * Format agent-directive error (MANDATORY)
   */
  private formatAgentError(error: any, correlationId: string, toolName: string) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error_code: error.code || 'UNKNOWN_ERROR',
          message: error.message,
          suggestion: this.generateErrorRecovery(error, toolName),
          retry_after: error.retryAfter || 1,
          correlation_id: correlationId
        }, null, 2)
      }]
    };
  }

  /**
   * Determine next actions based on tool and result
   */
  private determineNextActions(toolName: string, data: any): string[] {
    // AI: Implement tool-specific decision logic
    const nextActions: string[] = [];

    switch (toolName) {
      case 'tool_name':
        if (data.status === 'pending') {
          nextActions.push('check_status');
        } else if (data.status === 'complete') {
          nextActions.push('fetch_results');
        }
        break;
      // Add more cases
    }

    return nextActions;
  }

  getServer(): McpServer {
    return this.mcpServer;
  }
}
```

### **Layer 3: Business Layer ([service]-service.ts)**

**Responsibilities:**
- Core business logic
- External API integration
- Resilience patterns (bulkhead, rate limiting, retry)
- Caching strategy
- Data transformation

```typescript
/**
 * [SERVICE_NAME] MCP Server - Business Logic Layer
 * SOLID: Single Responsibility - Domain Logic & External APIs
 */

import { poolManager } from './undici-resilience';
import { logger } from './logger-pino';
import { [service]Cache } from './cache/[service]-cache';
import { Bulkhead, bulkheadManager } from './undici-resilience/resilience/bulkhead';
import { RateLimiter, rateLimiterManager } from './undici-resilience/resilience/rate-limiter';
import { RetryStrategy } from './undici-resilience/resilience/retry-strategy';

export class [SERVICE_PASCAL]Service {
  private bulkhead: Bulkhead;
  private rateLimiter: RateLimiter;
  private retryStrategy: RetryStrategy;
  private cache: typeof [service]Cache;

  constructor() {
    this.setupResiliencePatterns();
    this.cache = [service]Cache;
  }

  /**
   * Initialize resilience patterns
   */
  private setupResiliencePatterns(): void {
    // Bulkhead: Isolate external API calls
    this.bulkhead = bulkheadManager.getBulkhead('[service]-api', {
      maxConcurrent: 10,
      maxQueueSize: 50,
      queueTimeout: 10000
    });

    // Rate Limiter: Throttle API requests
    this.rateLimiter = rateLimiterManager.getRateLimiter('[service]-api', {
      requests: 60,
      windowMs: 60000,
      burst: 10,
      sliding: true
    });

    // Retry Strategy: Exponential backoff
    this.retryStrategy = new RetryStrategy({
      maxRetries: 4,
      baseDelay: 500,
      maxDelay: 8000,
      jitterFactor: 0.15
    });
  }

  /**
   * Core business method with full resilience stack
   */
  async methodName(params: any): Promise<any> {
    const startTime = Date.now();

    try {
      // 1. Check cache first
      const cacheKey = this.generateCacheKey('method', params);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.info('Cache hit', { method: 'methodName', params });
        return cached;
      }

      // 2. Apply full resilience stack: Rate Limiter → Bulkhead → Retry → Pool Manager
      const result = await this.rateLimiter.execute(async () => {
        return await this.bulkhead.execute(async () => {
          return await this.retryStrategy.execute(async () => {
            return await this.fetchFromExternalAPI(params);
          }, `method-${params.id}`);
        });
      });

      // 3. Transform data for agent consumption
      const transformed = this.transformForAgent(result);

      // 4. Cache the result
      this.cache.set(cacheKey, transformed);

      // 5. Log performance
      logger.logPerformance('methodName', startTime, {
        params,
        cached: false,
        transformedSize: JSON.stringify(transformed).length
      });

      return transformed;

    } catch (error) {
      logger.logError(error as Error, {
        method: 'methodName',
        params,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Fetch from external API with resilience
   */
  private async fetchFromExternalAPI(params: any): Promise<any> {
    const response = await poolManager.request(
      'api-pool',
      {
        path: `/endpoint?param=${params.value}`,
        method: 'GET',
        headers: {
          'User-Agent': `${NAME}/${VERSION}`
        }
      },
      `fetch-${params.id}`
    );

    return response;
  }

  /**
   * Transform API data for agent consumption
   */
  private transformForAgent(data: any): any {
    // Simplify, flatten, and enrich data for LLM understanding
    return {
      // Only essential fields
      id: data.id,
      name: data.name,
      status: data.status,
      // Human-readable timestamps
      created_at: new Date(data.timestamp).toLocaleString(),
      // Computed fields
      is_active: data.status === 'active',
      // Metadata for context
      _meta: {
        source: 'external_api',
        cached: false
      }
    };
  }

  private generateCacheKey(method: string, params: any): string {
    return `${method}:${JSON.stringify(params)}`;
  }
}
```

---

## 🛡️ ENTERPRISE RESILIENCE LAYER

### **MANDATORY: undici-resilience/ Package**

This is the **most critical missing piece** in existing templates. Generate the complete resilience layer:

```
src/undici-resilience/
├── index.ts                           # Main exports
├── config/pool-config.ts              # Pool configuration
├── http/pool-manager.ts               # Connection pooling
├── resilience/
│   ├── circuit-breaker.ts             # Circuit breaker pattern
│   ├── bulkhead.ts                    # Bulkhead isolation
│   ├── rate-limiter.ts                # Token bucket rate limiting
│   └── retry-strategy.ts              # Exponential backoff retry
├── streaming/
│   ├── streaming-pool-manager.ts      # Streaming pool management
│   ├── streaming-metrics.ts           # Stream metrics
│   └── backpressure-handler.ts        # Backpressure handling
└── monitoring/
    ├── connection-monitor.ts          # Connection health
    └── metrics.ts                     # Performance metrics
```

**Pattern: Resilience Stack Application**

```typescript
// ALWAYS apply resilience in this order:
// Rate Limiter → Bulkhead → Retry → Pool Manager

async fetchData() {
  return await rateLimiter.execute(async () => {
    return await bulkhead.execute(async () => {
      return await retryStrategy.execute(async () => {
        return await poolManager.request(...);
      });
    });
  });
}
```

---

## 🔒 SECURITY-FIRST ARCHITECTURE

### **MANDATORY Security Components**

```
src/security/
├── sanitizer.ts              # DOMPurify-based input sanitization
└── security-monitor.ts       # Threat detection & monitoring

src/audit/
└── audit-logger.ts           # Enterprise audit logging

src/middleware/
├── validation.ts             # JSON-RPC & MCP validation
├── sanitization.ts           # Security sanitization
├── rate-limit.ts             # Rate limiting protection
└── auth.ts                   # Authentication middleware
```

### **Security Manager (security/sanitizer.ts)**

```typescript
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

export class SecurityManager {
  /**
   * Sanitize all inputs with DOMPurify
   */
  sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      return this.sanitizeString(input);
    }
    if (typeof input === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    return input;
  }

  /**
   * Sanitize string with attack pattern detection
   */
  sanitizeString(input: string): string {
    // 1. DOMPurify sanitization
    const cleaned = purify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });

    // 2. Additional attack pattern checks
    if (this.containsAttackPatterns(cleaned)) {
      throw new Error('Input contains suspicious patterns');
    }

    return cleaned;
  }

  /**
   * Detect attack patterns
   */
  containsAttackPatterns(input: string): boolean {
    const attackPatterns = [
      // SQL Injection
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(\b(UNION|OR|AND)\b.*=.*)/i,
      /(--|;|\/\*|\*\/|xp_|sp_)/i,

      // XSS
      /(<script|<iframe|<object|<embed|<img|onerror|onload|javascript:)/i,

      // Path Traversal
      /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/)/i,

      // Command Injection
      /(\||&|;|`|\$\(|\{|>|<)/
    ];

    return attackPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Sanitize city name (domain-specific)
   */
  sanitizeCityName(city: string): string {
    const cleaned = this.sanitizeString(city);

    // Only allow letters, spaces, hyphens, apostrophes
    if (!/^[a-zA-Z\s\-']+$/.test(cleaned)) {
      return '';
    }

    // Length validation
    if (cleaned.length < 2 || cleaned.length > 100) {
      return '';
    }

    return cleaned.trim();
  }

  /**
   * Generate Content Security Policy
   */
  getContentSecurityPolicy(): string {
    return "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';";
  }
}

export const securityManager = new SecurityManager();
```

### **Security Monitor (security/security-monitor.ts)**

```typescript
interface ThreatEvent {
  timestamp: string;
  type: 'sql_injection' | 'xss' | 'path_traversal' | 'command_injection';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  metadata: any;
}

export class SecurityMonitor {
  private threats: ThreatEvent[] = [];

  /**
   * Monitor request for security threats
   */
  monitorRequest(
    method: string,
    url: string,
    headers: any,
    body: any,
    clientIP: string,
    userId?: string
  ): ThreatEvent[] {
    const detectedThreats: ThreatEvent[] = [];

    // 1. Check for SQL injection
    if (this.detectSQLInjection(url + JSON.stringify(body))) {
      detectedThreats.push({
        timestamp: new Date().toISOString(),
        type: 'sql_injection',
        severity: 'high',
        source: clientIP,
        metadata: { method, url, body }
      });
    }

    // 2. Check for XSS
    if (this.detectXSS(url + JSON.stringify(body))) {
      detectedThreats.push({
        timestamp: new Date().toISOString(),
        type: 'xss',
        severity: 'high',
        source: clientIP,
        metadata: { method, url, body }
      });
    }

    // 3. Check for path traversal
    if (this.detectPathTraversal(url)) {
      detectedThreats.push({
        timestamp: new Date().toISOString(),
        type: 'path_traversal',
        severity: 'critical',
        source: clientIP,
        metadata: { method, url }
      });
    }

    // 4. Check for command injection
    if (this.detectCommandInjection(JSON.stringify(body))) {
      detectedThreats.push({
        timestamp: new Date().toISOString(),
        type: 'command_injection',
        severity: 'critical',
        source: clientIP,
        metadata: { method, url, body }
      });
    }

    // Store threats
    this.threats.push(...detectedThreats);

    return detectedThreats;
  }

  private detectSQLInjection(input: string): boolean {
    return /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b)/i.test(input);
  }

  private detectXSS(input: string): boolean {
    return /(<script|<iframe|javascript:|onerror=|onload=)/i.test(input);
  }

  private detectPathTraversal(input: string): boolean {
    return /(\.\.\/|\.\.\\|%2e%2e)/i.test(input);
  }

  private detectCommandInjection(input: string): boolean {
    return /(\||&|;|`|\$\()/i.test(input);
  }

  getThreats(): ThreatEvent[] {
    return this.threats;
  }
}

export const securityMonitor = new SecurityMonitor();
```

### **Audit Logger (audit/audit-logger.ts)**

```typescript
interface AuditEvent {
  id: string;
  timestamp: string;
  category: 'authentication' | 'authorization' | 'data_access' | 'security' | 'api_usage' | 'configuration';
  eventType: string;
  result: 'success' | 'failure' | 'error';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  resource?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export class AuditLogger {
  private events: AuditEvent[] = [];
  private enabled: boolean = true;

  /**
   * Log data access events
   */
  logDataAccess(
    action: string,
    resource: string,
    result: 'success' | 'failure' | 'error',
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.enabled) return;

    this.events.push({
      id: generateCorrelationId(),
      timestamp: new Date().toISOString(),
      category: 'data_access',
      eventType: `data_access_${action}`,
      result,
      resource,
      action,
      userId,
      metadata
    });
  }

  /**
   * Log security events
   */
  logSecurity(
    eventType: string,
    resource: string,
    result: 'success' | 'failure' | 'error',
    severity: 'low' | 'medium' | 'high' | 'critical',
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.enabled) return;

    this.events.push({
      id: generateCorrelationId(),
      timestamp: new Date().toISOString(),
      category: 'security',
      eventType,
      result,
      severity,
      resource,
      userId,
      metadata
    });
  }

  /**
   * Log API usage
   */
  logApiUsage(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.enabled) return;

    this.events.push({
      id: generateCorrelationId(),
      timestamp: new Date().toISOString(),
      category: 'api_usage',
      eventType: 'api_call',
      result: statusCode < 400 ? 'success' : statusCode < 500 ? 'failure' : 'error',
      resource: endpoint,
      action: method,
      userId,
      metadata: {
        ...metadata,
        statusCode,
        duration
      }
    });
  }

  /**
   * Query audit events
   */
  query(filter: { limit?: number; offset?: number; category?: string }): AuditEvent[] {
    let filtered = this.events;

    if (filter.category) {
      filtered = filtered.filter(e => e.category === filter.category);
    }

    const offset = filter.offset || 0;
    const limit = filter.limit || 50;

    return filtered.slice(offset, offset + limit);
  }

  /**
   * Get audit statistics
   */
  getStatistics() {
    const total = this.events.length;
    const byCategory = this.events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byResult = this.events.reduce((acc, event) => {
      acc[event.result] = (acc[event.result] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      byCategory,
      byResult,
      lastEvent: this.events[this.events.length - 1]
    };
  }

  getConfiguration() {
    return { enabled: this.enabled };
  }
}

export const auditLogger = new AuditLogger();

function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

---

## 📊 COMPLETE CONFIGURATION (50+ Variables)

### **Configuration Schema (config/config.ts)**

```typescript
import { z } from 'zod';

const parseBoolean = (value: string | undefined): boolean => {
  return value?.toLowerCase() === 'true';
};

const envSchema = z.object({
  // Core Configuration
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MCP_TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
  MCP_HTTP_PORT: z.coerce.number().min(1024).max(65535).default(8080),

  // API Configuration
  [API_NAME]_BASE_URL: z.string().url().default('https://api.example.com'),
  [API_NAME]_API_KEY: z.string().optional(),

  // Security Configuration (20+ variables)
  SECURITY_MONITORING_ENABLED: z.string().default('true').transform(parseBoolean),
  AUDIT_LOGGING_ENABLED: z.string().default('true').transform(parseBoolean),
  AUDIT_LOG_FILE: z.string().default('true').transform(parseBoolean),
  AUDIT_LOG_WEBHOOK_URL: z.string().optional(),
  THREAT_DETECTION_SQL_INJECTION: z.string().default('true').transform(parseBoolean),
  THREAT_DETECTION_XSS: z.string().default('true').transform(parseBoolean),
  THREAT_DETECTION_PATH_TRAVERSAL: z.string().default('true').transform(parseBoolean),
  THREAT_DETECTION_COMMAND_INJECTION: z.string().default('true').transform(parseBoolean),
  IP_BLOCKING_ENABLED: z.string().default('true').transform(parseBoolean),
  IP_WHITELIST: z.string().default('127.0.0.1,::1'),
  SENSITIVE_DATA_MASKING_ENABLED: z.string().default('true').transform(parseBoolean),
  MASK_API_KEYS: z.string().default('true').transform(parseBoolean),
  CSP_DEFAULT_SRC: z.string().default("'self'"),
  HSTS_MAX_AGE: z.coerce.number().default(31536000),
  MAX_REQUEST_SIZE: z.coerce.number().default(1048576),
  SESSION_TIMEOUT: z.coerce.number().default(3600000),

  // Rate Limiting Configuration
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.coerce.number().default(100),
  RATE_LIMIT_BURST_LIMIT: z.coerce.number().default(20),
  RATE_LIMIT_BLOCK_DURATION: z.coerce.number().default(300000),

  // Audit Configuration
  AUDIT_RETENTION_DAYS: z.coerce.number().default(90),
  AUDIT_MAX_EVENTS: z.coerce.number().default(10000),
  AUDIT_MINIMUM_SEVERITY: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  AUDIT_ENABLED_CATEGORIES: z.string().default('authentication,authorization,data_access,security,api_usage'),

  // Resilience Configuration
  CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().default(5),
  CIRCUIT_BREAKER_TIMEOUT: z.coerce.number().default(60000),
  MAX_RETRIES: z.coerce.number().default(3),
  BASE_RETRY_DELAY: z.coerce.number().default(1000),

  // Cache Configuration
  CACHE_TTL_SECONDS: z.coerce.number().default(300),
  CACHE_MAX_SIZE: z.coerce.number().default(500),

  // Streaming Configuration
  MAX_CONCURRENT_STREAMS: z.coerce.number().default(10),
  STREAM_TIMEOUT: z.coerce.number().default(60000),
  BACKPRESSURE_HIGH_WATER_MARK: z.coerce.number().default(1048576),
  BACKPRESSURE_LOW_WATER_MARK: z.coerce.number().default(524288),

  // Logging Configuration
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
});

function validateEnvironment() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    throw new Error(`Configuration validation failed: ${error.message}`);
  }
}

const env = validateEnvironment();

export const config = {
  server: {
    transport: env.MCP_TRANSPORT,
    httpPort: env.MCP_HTTP_PORT,
  },
  api: {
    baseUrl: env.[API_NAME]_BASE_URL,
    apiKey: env.[API_NAME]_API_KEY,
  },
  security: {
    monitoringEnabled: env.SECURITY_MONITORING_ENABLED,
    auditLoggingEnabled: env.AUDIT_LOGGING_ENABLED,
    threatDetection: {
      sqlInjection: env.THREAT_DETECTION_SQL_INJECTION,
      xss: env.THREAT_DETECTION_XSS,
      pathTraversal: env.THREAT_DETECTION_PATH_TRAVERSAL,
      commandInjection: env.THREAT_DETECTION_COMMAND_INJECTION,
    },
    ipBlocking: env.IP_BLOCKING_ENABLED,
    dataMasking: env.SENSITIVE_DATA_MASKING_ENABLED,
  },
  resilience: {
    circuitBreaker: {
      threshold: env.CIRCUIT_BREAKER_THRESHOLD,
      timeout: env.CIRCUIT_BREAKER_TIMEOUT,
    },
    retry: {
      maxRetries: env.MAX_RETRIES,
      baseDelay: env.BASE_RETRY_DELAY,
    },
  },
  cache: {
    ttl: env.CACHE_TTL_SECONDS,
    maxSize: env.CACHE_MAX_SIZE,
  },
  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },
};

export function getConfig() {
  return config;
}
```

---

## 🧪 COMPREHENSIVE TESTING STRUCTURE

```
src/__tests__/
├── deep/                              # Deep integration tests
│   ├── context-audit-comprehensive.spec.ts
│   ├── server-integration.spec.ts
│   ├── execution-paths.spec.ts
│   └── middleware-comprehensive.spec.ts
├── integration/                       # Full-stack integration
│   ├── full-stack.integration.spec.ts
│   └── coverage-boost.integration.spec.ts
├── middleware/                        # Middleware-specific
│   └── middleware-execution.spec.ts
├── server/                            # Server startup
│   └── server-startup.spec.ts
└── targeted/                          # Targeted component tests
    ├── context-audit.targeted.spec.ts
    └── middleware.targeted.spec.ts
```

### **Example Test Pattern**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { [SERVICE_PASCAL]Service } from '../[service]-service';

describe('[SERVICE_PASCAL]Service', () => {
  let service: [SERVICE_PASCAL]Service;

  beforeEach(() => {
    service = new [SERVICE_PASCAL]Service();
  });

  describe('methodName', () => {
    it('should return cached data on second call', async () => {
      const params = { id: 'test-123' };

      // First call - hits API
      const result1 = await service.methodName(params);
      expect(result1).toBeDefined();

      // Second call - hits cache
      const result2 = await service.methodName(params);
      expect(result2).toEqual(result1);
    });

    it('should apply resilience patterns', async () => {
      // Test circuit breaker
      // Test rate limiting
      // Test retry logic
    });

    it('should handle errors gracefully', async () => {
      // Test error scenarios
    });
  });
});
```

---

## 📦 COMPLETE FILE STRUCTURE

```
[service-name]-mcp/
├── src/
│   ├── server.ts                           ✅ Transport layer
│   ├── [service]-mcp-server.ts             ✅ Protocol layer
│   ├── [service]-service.ts                ✅ Business layer
│   ├── types.ts                            ✅ TypeScript types
│   ├── config/
│   │   ├── config.ts                       ✅ Zod-validated config (50+ vars)
│   │   └── auth-config.ts                  ✅ Auth configuration
│   ├── cache/
│   │   └── [service]-cache.ts              ✅ Multi-tier LRU cache
│   ├── errors/
│   │   └── [service]-errors.ts             ✅ Error hierarchy (8+ classes)
│   ├── logger-pino.ts                      ✅ Structured logging
│   ├── middleware/
│   │   ├── validation.ts                   ✅ JSON-RPC validation
│   │   ├── sanitization.ts                 ✅ Security sanitization
│   │   ├── rate-limit.ts                   ✅ Rate limiting
│   │   └── auth.ts                         ✅ Authentication
│   ├── security/                           ✅ CRITICAL - NEW
│   │   ├── sanitizer.ts                    ✅ DOMPurify sanitization
│   │   └── security-monitor.ts             ✅ Threat detection
│   ├── audit/                              ✅ CRITICAL - NEW
│   │   └── audit-logger.ts                 ✅ Enterprise audit logging
│   ├── context/                            ✅ NEW
│   │   └── context-manager.ts              ✅ Request context
│   ├── undici-resilience/                  ✅ CRITICAL - NEW
│   │   ├── index.ts
│   │   ├── config/pool-config.ts
│   │   ├── http/pool-manager.ts
│   │   ├── resilience/
│   │   │   ├── circuit-breaker.ts
│   │   │   ├── bulkhead.ts
│   │   │   ├── rate-limiter.ts
│   │   │   └── retry-strategy.ts
│   │   ├── streaming/
│   │   │   ├── streaming-pool-manager.ts
│   │   │   ├── streaming-metrics.ts
│   │   │   └── backpressure-handler.ts
│   │   └── monitoring/
│   │       ├── connection-monitor.ts
│   │       └── metrics.ts
│   ├── utils/
│   │   └── version.ts
│   └── __tests__/                          ✅ Enhanced test structure
│       ├── deep/
│       ├── integration/
│       ├── middleware/
│       ├── server/
│       └── targeted/
├── .github/
│   └── workflows/
│       ├── ci.yml                          ✅ CI pipeline
│       ├── security.yml                    ✅ Security scanning
│       ├── docker.yml                      ✅ Docker builds
│       ├── performance.yml                 ✅ Performance testing
│       ├── integration-tests.yml           ✅ Integration tests
│       ├── docs.yml                        ✅ Documentation
│       ├── dependency-update.yml           ✅ Dependency updates
│       └── release.yml                     ✅ Release automation
├── docs/
│   ├── README.md
│   ├── TESTING.md
│   ├── CLAUDE_DESKTOP_SETUP.md
│   └── CLINE_SETUP.md
├── package.json                            ✅ Exact dependencies
├── tsconfig.json                           ✅ Strict TypeScript
├── eslint.config.js                        ✅ Flat config
├── vitest.config.ts                        ✅ Test configuration
├── Dockerfile                              ✅ Multi-stage build
├── docker-compose.yml                      ✅ Container orchestration
├── .env.example                            ✅ 50+ env vars
├── CHANGELOG.md
└── LICENSE
```

---

## 🚀 AI ASSISTANT WORKFLOW

### **For Claude Code / Cline:**

1. **Read this template completely**
2. **Collect user requirements** (any format)
3. **Calculate all placeholders**:
   ```javascript
   const placeholders = {
     '[SERVICE_NAME]': 'Weather Data Service',
     '[service-name]': 'weather-data-service',
     '[service]': 'weatherDataService',
     '[SERVICE]': 'WEATHER_DATA_SERVICE',
     '[SERVICE_PASCAL]': 'WeatherDataService',
     '[API_NAME]': 'OPEN_METEO',
   };
   ```
4. **Generate files in order**:
   - Types and interfaces
   - Configuration
   - Errors
   - Resilience layer
   - Security layer
   - Audit layer
   - Cache layer
   - Business layer
   - Protocol layer
   - Transport layer
   - Tests
   - CI/CD
   - Documentation
5. **Validate generation**:
   - All placeholders replaced
   - No syntax errors
   - All imports resolved
   - Tests pass
   - Builds successfully

---

## ✅ PRODUCTION READINESS CHECKLIST

Before deploying, verify:

**Architecture:**
- [ ] Perfect 3-layer separation (Transport/Protocol/Business)
- [ ] Latest MCP SDK patterns (McpServer, registerTool, Zod)
- [ ] Zero cross-contamination between layers

**AI Agent-First:**
- [ ] Tool count ≤25 (hard limit: 30)
- [ ] Intent-based consolidation applied
- [ ] Agent-directive responses (next_actions, suggestion)
- [ ] LLM-optimized descriptions (≤180 tokens each)
- [ ] Tool naming conventions followed

**Resilience:**
- [ ] Complete undici-resilience layer implemented
- [ ] Circuit breaker configured
- [ ] Bulkhead isolation active
- [ ] Rate limiting enforced
- [ ] Retry strategy with exponential backoff
- [ ] Connection pooling optimized

**Security:**
- [ ] DOMPurify sanitization on ALL inputs
- [ ] Attack pattern detection active
- [ ] Security headers configured
- [ ] Audit logging enabled for ALL operations
- [ ] Security monitoring endpoints exposed

**Performance:**
- [ ] Multi-tier LRU caching implemented
- [ ] Cache TTLs optimized per data type
- [ ] Performance logging active
- [ ] Correlation IDs tracked

**Testing:**
- [ ] Unit tests for all components
- [ ] Integration tests for full workflows
- [ ] Deep integration tests for edge cases
- [ ] Security tests for attack patterns
- [ ] Performance tests for latency

**CI/CD:**
- [ ] All 8 workflows configured
- [ ] Security scanning enabled
- [ ] Docker builds automated
- [ ] Performance benchmarks running
- [ ] Release automation ready

**Documentation:**
- [ ] README with architecture diagrams
- [ ] Setup guides for all AI assistants
- [ ] Testing guide comprehensive
- [ ] API documentation complete
- [ ] Environment variables documented

---

## 🎓 SUCCESS METRICS

After generation, validate:

| Metric | Target | Validation Method |
|--------|--------|-------------------|
| Tool count | ≤25 | Count registered tools |
| First-try accuracy | >90% | MCP Inspector testing |
| Workflow completion | ≤3 calls | Agent workflow tests |
| Token overhead | <5K/interaction | Token usage monitoring |
| Error rate | <2% | Error logs analysis |
| Circuit breaker opens | <1% | Resilience metrics |
| Cache hit rate | >70% | Cache statistics |
| Security threats blocked | 100% | Security monitor logs |
| Audit coverage | 100% | Audit event logs |

---

## 🔧 MAINTENANCE & ITERATION

**After Deployment:**
1. Monitor first-try tool selection accuracy
2. Track average workflow completion time
3. Analyze agent selection confusion patterns
4. Measure token usage per interaction
5. Review audit logs for security events
6. Monitor circuit breaker state changes
7. Track cache hit rates
8. Analyze error patterns

**Continuous Improvement:**
1. A/B test tool descriptions
2. Consolidate underused tools
3. Split overloaded tools
4. Refine next_actions logic
5. Update based on agent feedback
6. Optimize cache TTLs
7. Tune resilience thresholds
8. Enhance security rules

---

## 📚 ADDITIONAL RESOURCES

**Related Templates:**
- `mcp-architecture-blueprint.md` - Architecture guidelines
- `mcp-resilience-patterns.md` - Resilience implementation guide
- `mcp-security-architecture.md` - Security implementation guide
- `mcp-audit-logging.md` - Audit logging guide
- `mcp-testing-strategy.md` - Testing strategy guide

**Reference Implementation:**
- `mcp-weather-server` - Production-grade example
- Complete source code available for study
- All patterns battle-tested in production

---

## 🎯 FINAL NOTES

This template generates MCP servers that:
- ✅ Match mcp-weather-server quality 100%
- ✅ Use identical tech stack
- ✅ Follow AI agent-first principles
- ✅ Include all production features
- ✅ Are maintainable and scalable
- ✅ Work with Claude Code and Cline
- ✅ Pass all quality gates
- ✅ Are ready for production deployment

**The result:** MCP servers that don't explode at 3 AM. 🚀

---

*Template Version: 3.0.0 | Last Updated: 2025-01-08 | Based on: mcp-weather-server v3.1.0*
