# 📝 MCP Server Audit Logging - Complete Implementation Guide

**Version**: 1.0.0
**Last Updated**: 2025-01-23
**Target**: AI Code Assistants (Claude Code, Cline, etc.)
**Companion To**: mcp-code-generator-v3.md

---

## 📋 Overview

This guide provides **complete, production-ready audit logging** for MCP servers. Implement comprehensive tracking of data access, security events, API usage, and system changes for compliance, debugging, and security analysis.

### Audit Event Types

```
1. Data Access (READ, WRITE, DELETE)
   - Who accessed what data
   - When and from where
   - Success or failure

2. Security Events
   - Authentication attempts
   - Authorization failures
   - Threat detection
   - Attack attempts

3. API Usage
   - Request method and endpoint
   - Response status
   - Duration
   - Client identification

4. System Changes
   - Configuration updates
   - Tool registration
   - State changes
```

---

## 🎯 Component 1: Audit Logger

**Purpose**: Centralized audit logging with structured events, querying, and retention

### Complete Implementation

```typescript
// src/audit/audit-logger.ts

import pino from 'pino';

export type AuditEventType = 'data-access' | 'security' | 'api-usage' | 'system-change';
export type DataAccessAction = 'read' | 'write' | 'delete' | 'update';
export type AuditResult = 'success' | 'failure' | 'partial';
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface BaseAuditEvent {
  id: string;
  timestamp: Date;
  type: AuditEventType;
  result: AuditResult;
  userId?: string;
  clientIp?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface DataAccessEvent extends BaseAuditEvent {
  type: 'data-access';
  action: DataAccessAction;
  resource: string;
  resourceId?: string;
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  fieldsAccessed?: string[];
  recordCount?: number;
}

export interface SecurityEvent extends BaseAuditEvent {
  type: 'security';
  eventType: string; // e.g., 'authentication', 'authorization', 'threat_detected'
  resource?: string;
  severity: SecuritySeverity;
  threatType?: string;
  blocked?: boolean;
  reason?: string;
}

export interface ApiUsageEvent extends BaseAuditEvent {
  type: 'api-usage';
  method: string;
  endpoint: string;
  statusCode: number;
  duration: number;
  userAgent?: string;
  requestSize?: number;
  responseSize?: number;
}

export interface SystemChangeEvent extends BaseAuditEvent {
  type: 'system-change';
  changeType: string; // e.g., 'config_update', 'tool_registration'
  component: string;
  previousValue?: any;
  newValue?: any;
  reason?: string;
}

export type AuditEvent =
  | DataAccessEvent
  | SecurityEvent
  | ApiUsageEvent
  | SystemChangeEvent;

export interface AuditLoggerConfig {
  enabled: boolean;
  maxEventsInMemory: number;
  retentionMs: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  includeMetadata: boolean;
  persistToDisk: boolean;
  diskPath?: string;
}

export interface AuditQueryFilter {
  type?: AuditEventType;
  result?: AuditResult;
  userId?: string;
  clientIp?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

export interface AuditStatistics {
  totalEvents: number;
  byType: Record<AuditEventType, number>;
  byResult: Record<AuditResult, number>;
  dataAccess: {
    total: number;
    byAction: Record<DataAccessAction, number>;
    byResource: Record<string, number>;
  };
  security: {
    total: number;
    bySeverity: Record<SecuritySeverity, number>;
    blockedCount: number;
  };
  apiUsage: {
    total: number;
    averageDuration: number;
    byStatusCode: Record<number, number>;
  };
  uniqueUsers: number;
  uniqueIps: number;
}

export class AuditLogger {
  private events: AuditEvent[] = [];
  private eventIdCounter: number = 0;
  private config: AuditLoggerConfig;
  private logger: pino.Logger;

  constructor(config: AuditLoggerConfig, logger: pino.Logger) {
    this.config = config;
    this.logger = logger;

    // Periodically clean up old events
    setInterval(() => {
      this.cleanupOldEvents();
    }, 300000); // Every 5 minutes
  }

  /**
   * Log data access event
   */
  logDataAccess(
    action: DataAccessAction,
    resource: string,
    result: AuditResult,
    userId?: string,
    metadata?: {
      resourceId?: string;
      dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
      fieldsAccessed?: string[];
      recordCount?: number;
      clientIp?: string;
      sessionId?: string;
      [key: string]: any;
    },
  ): void {
    if (!this.config.enabled) {
      return;
    }

    const event: DataAccessEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'data-access',
      action,
      resource,
      result,
      userId,
      clientIp: metadata?.clientIp,
      sessionId: metadata?.sessionId,
      resourceId: metadata?.resourceId,
      dataClassification: metadata?.dataClassification,
      fieldsAccessed: metadata?.fieldsAccessed,
      recordCount: metadata?.recordCount,
      metadata: this.config.includeMetadata ? this.cleanMetadata(metadata) : undefined,
    };

    this.addEvent(event);

    this.logger.info({
      auditEventId: event.id,
      type: 'data-access',
      action,
      resource,
      result,
      userId,
    }, 'Data access audit event');
  }

  /**
   * Log security event
   */
  logSecurity(
    eventType: string,
    resource: string | undefined,
    result: AuditResult,
    severity: SecuritySeverity,
    userId?: string,
    metadata?: {
      threatType?: string;
      blocked?: boolean;
      reason?: string;
      clientIp?: string;
      sessionId?: string;
      [key: string]: any;
    },
  ): void {
    if (!this.config.enabled) {
      return;
    }

    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'security',
      eventType,
      resource,
      result,
      severity,
      userId,
      clientIp: metadata?.clientIp,
      sessionId: metadata?.sessionId,
      threatType: metadata?.threatType,
      blocked: metadata?.blocked,
      reason: metadata?.reason,
      metadata: this.config.includeMetadata ? this.cleanMetadata(metadata) : undefined,
    };

    this.addEvent(event);

    const logLevel = this.getLogLevelForSeverity(severity);

    this.logger[logLevel]({
      auditEventId: event.id,
      type: 'security',
      eventType,
      severity,
      resource,
      result,
      userId,
    }, 'Security audit event');
  }

  /**
   * Log API usage event
   */
  logApiUsage(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    userId?: string,
    metadata?: {
      userAgent?: string;
      requestSize?: number;
      responseSize?: number;
      clientIp?: string;
      sessionId?: string;
      [key: string]: any;
    },
  ): void {
    if (!this.config.enabled) {
      return;
    }

    const result: AuditResult =
      statusCode >= 200 && statusCode < 300
        ? 'success'
        : statusCode >= 500
          ? 'failure'
          : 'partial';

    const event: ApiUsageEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'api-usage',
      method,
      endpoint,
      statusCode,
      duration,
      result,
      userId,
      clientIp: metadata?.clientIp,
      sessionId: metadata?.sessionId,
      userAgent: metadata?.userAgent,
      requestSize: metadata?.requestSize,
      responseSize: metadata?.responseSize,
      metadata: this.config.includeMetadata ? this.cleanMetadata(metadata) : undefined,
    };

    this.addEvent(event);

    this.logger.debug({
      auditEventId: event.id,
      type: 'api-usage',
      method,
      endpoint,
      statusCode,
      duration,
      userId,
    }, 'API usage audit event');
  }

  /**
   * Log system change event
   */
  logSystemChange(
    changeType: string,
    component: string,
    result: AuditResult,
    userId?: string,
    metadata?: {
      previousValue?: any;
      newValue?: any;
      reason?: string;
      clientIp?: string;
      sessionId?: string;
      [key: string]: any;
    },
  ): void {
    if (!this.config.enabled) {
      return;
    }

    const event: SystemChangeEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'system-change',
      changeType,
      component,
      result,
      userId,
      clientIp: metadata?.clientIp,
      sessionId: metadata?.sessionId,
      previousValue: metadata?.previousValue,
      newValue: metadata?.newValue,
      reason: metadata?.reason,
      metadata: this.config.includeMetadata ? this.cleanMetadata(metadata) : undefined,
    };

    this.addEvent(event);

    this.logger.info({
      auditEventId: event.id,
      type: 'system-change',
      changeType,
      component,
      result,
      userId,
    }, 'System change audit event');
  }

  /**
   * Query audit events
   */
  query(filter?: AuditQueryFilter): AuditEvent[] {
    let results = [...this.events];

    if (filter) {
      if (filter.type) {
        results = results.filter(e => e.type === filter.type);
      }

      if (filter.result) {
        results = results.filter(e => e.result === filter.result);
      }

      if (filter.userId) {
        results = results.filter(e => e.userId === filter.userId);
      }

      if (filter.clientIp) {
        results = results.filter(e => e.clientIp === filter.clientIp);
      }

      if (filter.startTime) {
        results = results.filter(e => e.timestamp >= filter.startTime!);
      }

      if (filter.endTime) {
        results = results.filter(e => e.timestamp <= filter.endTime!);
      }

      if (filter.limit && filter.limit > 0) {
        results = results.slice(-filter.limit);
      }
    }

    return results;
  }

  /**
   * Get audit statistics
   */
  getStatistics(): AuditStatistics {
    const stats: AuditStatistics = {
      totalEvents: this.events.length,
      byType: {
        'data-access': 0,
        'security': 0,
        'api-usage': 0,
        'system-change': 0,
      },
      byResult: {
        'success': 0,
        'failure': 0,
        'partial': 0,
      },
      dataAccess: {
        total: 0,
        byAction: {
          read: 0,
          write: 0,
          delete: 0,
          update: 0,
        },
        byResource: {},
      },
      security: {
        total: 0,
        bySeverity: {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        },
        blockedCount: 0,
      },
      apiUsage: {
        total: 0,
        averageDuration: 0,
        byStatusCode: {},
      },
      uniqueUsers: 0,
      uniqueIps: 0,
    };

    const uniqueUsers = new Set<string>();
    const uniqueIps = new Set<string>();
    let totalDuration = 0;

    for (const event of this.events) {
      stats.byType[event.type]++;
      stats.byResult[event.result]++;

      if (event.userId) {
        uniqueUsers.add(event.userId);
      }

      if (event.clientIp) {
        uniqueIps.add(event.clientIp);
      }

      // Data access stats
      if (event.type === 'data-access') {
        stats.dataAccess.total++;
        stats.dataAccess.byAction[event.action]++;

        if (!stats.dataAccess.byResource[event.resource]) {
          stats.dataAccess.byResource[event.resource] = 0;
        }
        stats.dataAccess.byResource[event.resource]++;
      }

      // Security stats
      if (event.type === 'security') {
        stats.security.total++;
        stats.security.bySeverity[event.severity]++;

        if (event.blocked) {
          stats.security.blockedCount++;
        }
      }

      // API usage stats
      if (event.type === 'api-usage') {
        stats.apiUsage.total++;
        totalDuration += event.duration;

        if (!stats.apiUsage.byStatusCode[event.statusCode]) {
          stats.apiUsage.byStatusCode[event.statusCode] = 0;
        }
        stats.apiUsage.byStatusCode[event.statusCode]++;
      }
    }

    stats.uniqueUsers = uniqueUsers.size;
    stats.uniqueIps = uniqueIps.size;

    if (stats.apiUsage.total > 0) {
      stats.apiUsage.averageDuration = totalDuration / stats.apiUsage.total;
    }

    return stats;
  }

  /**
   * Export audit events (for compliance reporting)
   */
  export(filter?: AuditQueryFilter): string {
    const events = this.query(filter);

    return JSON.stringify({
      exportTimestamp: new Date().toISOString(),
      eventCount: events.length,
      filter,
      events,
    }, null, 2);
  }

  /**
   * Clear all audit events
   */
  clear(): void {
    const count = this.events.length;
    this.events = [];

    this.logger.warn({ count }, 'Cleared all audit events');
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `audit-${++this.eventIdCounter}-${Date.now()}`;
  }

  /**
   * Add event to storage
   */
  private addEvent(event: AuditEvent): void {
    this.events.push(event);

    // Limit memory usage
    if (this.events.length > this.config.maxEventsInMemory) {
      this.events.shift();
    }

    // Persist to disk if configured
    if (this.config.persistToDisk && this.config.diskPath) {
      this.persistEvent(event);
    }
  }

  /**
   * Persist event to disk (placeholder - implement based on your needs)
   */
  private persistEvent(event: AuditEvent): void {
    // TODO: Implement disk persistence
    // Options:
    // 1. Append to JSON file
    // 2. Write to database
    // 3. Send to external logging service (e.g., Elasticsearch, Splunk)
    // 4. Stream to cloud storage (e.g., S3, Azure Blob)
  }

  /**
   * Clean up old events beyond retention period
   */
  private cleanupOldEvents(): void {
    const cutoffTime = Date.now() - this.config.retentionMs;
    const beforeCount = this.events.length;

    this.events = this.events.filter(
      event => event.timestamp.getTime() > cutoffTime,
    );

    const removedCount = beforeCount - this.events.length;

    if (removedCount > 0) {
      this.logger.debug({
        removedCount,
        remainingCount: this.events.length,
      }, 'Cleaned up old audit events');
    }
  }

  /**
   * Clean metadata to remove sensitive info
   */
  private cleanMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) {
      return undefined;
    }

    const cleaned: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
      // Skip certain sensitive keys
      if (['password', 'apiKey', 'token', 'secret'].includes(key.toLowerCase())) {
        cleaned[key] = '[REDACTED]';
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Get log level for security severity
   */
  private getLogLevelForSeverity(severity: SecuritySeverity): 'debug' | 'info' | 'warn' | 'error' {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
        return 'info';
      default:
        return 'info';
    }
  }
}
```

---

## 🎯 Component 2: Integration with MCP Server

**Purpose**: Integrate audit logging throughout the application

### Tool Execution Audit

```typescript
// src/mcp-server.ts (tool registration with audit logging)

import { AuditLogger } from './audit/audit-logger.js';

export class MCPServer {
  private auditLogger: AuditLogger;

  constructor(
    weatherService: WeatherService,
    auditLogger: AuditLogger,
    logger: pino.Logger,
  ) {
    this.auditLogger = auditLogger;
    // ... other initialization
  }

  private registerTools(): void {
    // Register get_current_weather tool with audit logging
    this.mcpServer.registerTool(
      'get_current_weather',
      {
        title: 'Current Weather',
        description: 'Get current weather for a city',
        inputSchema: cityInputSchema,
      },
      async ({ city }) => {
        const startTime = Date.now();

        try {
          // Sanitize and validate input
          const cleanCity = securityManager.sanitizeCityName(city);

          // Audit: Log data access attempt
          auditLogger.logDataAccess(
            'read',
            'weather_data',
            'success',
            undefined, // userId (if authentication implemented)
            {
              resourceId: cleanCity,
              dataClassification: 'public',
              fieldsAccessed: ['temperature', 'humidity', 'windSpeed', 'description'],
            },
          );

          // Fetch weather data
          const weather = await this.weatherService.getCurrentWeather(cleanCity);

          // Log performance metrics
          const duration = Date.now() - startTime;
          logger.logPerformance('tool_get_current_weather', startTime, duration, {
            city: cleanCity,
          });

          return {
            content: [{
              type: 'text',
              text: this.formatWeatherText(weather),
            }],
          };

        } catch (error) {
          const duration = Date.now() - startTime;

          // Audit: Log data access failure
          auditLogger.logDataAccess(
            'read',
            'weather_data',
            'failure',
            undefined,
            {
              resourceId: city,
              error: error instanceof Error ? error.message : String(error),
            },
          );

          logger.error({
            city,
            duration,
            error: error instanceof Error ? error.message : String(error),
          }, 'Error getting weather');

          return {
            content: [{
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }],
            isError: true,
          };
        }
      },
    );
  }
}
```

### HTTP Server Audit

```typescript
// src/server.ts (HTTP middleware with audit logging)

import { AuditLogger } from './audit/audit-logger.js';

const auditLogger = new AuditLogger({
  enabled: true,
  maxEventsInMemory: 10000,
  retentionMs: 86400000, // 24 hours
  logLevel: 'info',
  includeMetadata: true,
  persistToDisk: false,
}, logger);

// Audit all HTTP requests
fastify.addHook('onResponse', async (request, reply) => {
  const duration = reply.getResponseTime();

  auditLogger.logApiUsage(
    request.method,
    request.url,
    reply.statusCode,
    duration,
    undefined, // userId (if authentication implemented)
    {
      userAgent: request.headers['user-agent'],
      clientIp: request.ip,
      requestSize: request.headers['content-length']
        ? parseInt(request.headers['content-length'] as string, 10)
        : undefined,
    },
  );
});

// Audit security events from security monitor
fastify.addHook('preHandler', async (request, reply) => {
  const threats = securityMonitor.monitorRequest(
    request.method,
    request.url,
    request.headers,
    request.body,
    request.ip,
  );

  for (const threat of threats) {
    auditLogger.logSecurity(
      'threat_detected',
      request.url,
      threat.blocked ? 'success' : 'partial',
      threat.severity as any,
      undefined,
      {
        threatType: threat.type,
        blocked: threat.blocked,
        reason: threat.details,
        clientIp: request.ip,
      },
    );
  }

  if (threats.some(t => t.blocked)) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Request blocked due to security violation',
    });
  }
});
```

---

## 🎯 Component 3: Audit Query API

**Purpose**: Provide endpoints for querying audit logs

### Complete Implementation

```typescript
// src/server.ts (audit endpoints)

// Get audit statistics
fastify.get('/audit/statistics', async (request, reply) => {
  const stats = auditLogger.getStatistics();

  return {
    timestamp: new Date().toISOString(),
    statistics: stats,
  };
});

// Query audit events
fastify.get<{
  Querystring: {
    type?: AuditEventType;
    result?: AuditResult;
    userId?: string;
    clientIp?: string;
    startTime?: string;
    endTime?: string;
    limit?: string;
  };
}>('/audit/events', async (request, reply) => {
  const filter: AuditQueryFilter = {};

  if (request.query.type) {
    filter.type = request.query.type;
  }

  if (request.query.result) {
    filter.result = request.query.result;
  }

  if (request.query.userId) {
    filter.userId = request.query.userId;
  }

  if (request.query.clientIp) {
    filter.clientIp = request.query.clientIp;
  }

  if (request.query.startTime) {
    filter.startTime = new Date(request.query.startTime);
  }

  if (request.query.endTime) {
    filter.endTime = new Date(request.query.endTime);
  }

  if (request.query.limit) {
    filter.limit = parseInt(request.query.limit, 10);
  }

  const events = auditLogger.query(filter);

  return {
    timestamp: new Date().toISOString(),
    filter,
    count: events.length,
    events,
  };
});

// Export audit events (for compliance)
fastify.get('/audit/export', async (request, reply) => {
  const exportData = auditLogger.export();

  reply.type('application/json');
  reply.header('Content-Disposition', `attachment; filename="audit-export-${Date.now()}.json"`);

  return exportData;
});

// Get data access events
fastify.get('/audit/data-access', async (request, reply) => {
  const events = auditLogger.query({ type: 'data-access', limit: 100 });

  return {
    timestamp: new Date().toISOString(),
    count: events.length,
    events,
  };
});

// Get security events
fastify.get('/audit/security', async (request, reply) => {
  const events = auditLogger.query({ type: 'security', limit: 100 });

  return {
    timestamp: new Date().toISOString(),
    count: events.length,
    events,
  };
});
```

---

## 📊 Audit Dashboard Examples

### Audit Statistics Response

```json
{
  "timestamp": "2025-01-23T10:30:00.000Z",
  "statistics": {
    "totalEvents": 1543,
    "byType": {
      "data-access": 892,
      "security": 45,
      "api-usage": 550,
      "system-change": 56
    },
    "byResult": {
      "success": 1450,
      "failure": 58,
      "partial": 35
    },
    "dataAccess": {
      "total": 892,
      "byAction": {
        "read": 850,
        "write": 30,
        "delete": 5,
        "update": 7
      },
      "byResource": {
        "weather_data": 800,
        "forecast_data": 92
      }
    },
    "security": {
      "total": 45,
      "bySeverity": {
        "low": 20,
        "medium": 15,
        "high": 8,
        "critical": 2
      },
      "blockedCount": 10
    },
    "apiUsage": {
      "total": 550,
      "averageDuration": 125.5,
      "byStatusCode": {
        "200": 500,
        "400": 30,
        "403": 10,
        "500": 10
      }
    },
    "uniqueUsers": 45,
    "uniqueIps": 32
  }
}
```

### Query Events Response

```json
{
  "timestamp": "2025-01-23T10:30:00.000Z",
  "filter": {
    "type": "data-access",
    "result": "success",
    "limit": 5
  },
  "count": 5,
  "events": [
    {
      "id": "audit-1543-1706006400000",
      "timestamp": "2025-01-23T10:29:55.000Z",
      "type": "data-access",
      "action": "read",
      "resource": "weather_data",
      "result": "success",
      "resourceId": "London",
      "dataClassification": "public",
      "fieldsAccessed": ["temperature", "humidity", "windSpeed", "description"],
      "clientIp": "192.168.1.100",
      "metadata": {
        "duration": 125
      }
    }
  ]
}
```

---

## 🧪 Testing Audit Logging

### Audit Logger Tests

```typescript
// src/__tests__/targeted/audit-logger.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLogger } from '../../audit/audit-logger.js';
import pino from 'pino';

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;
  let logger: pino.Logger;

  beforeEach(() => {
    logger = pino({ level: 'silent' });
    auditLogger = new AuditLogger({
      enabled: true,
      maxEventsInMemory: 1000,
      retentionMs: 3600000,
      logLevel: 'info',
      includeMetadata: true,
      persistToDisk: false,
    }, logger);
  });

  describe('Data Access Logging', () => {
    it('should log data access event', () => {
      auditLogger.logDataAccess(
        'read',
        'weather_data',
        'success',
        'user123',
        {
          resourceId: 'London',
          dataClassification: 'public',
          fieldsAccessed: ['temperature', 'humidity'],
        },
      );

      const events = auditLogger.query({ type: 'data-access' });
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('data-access');
      expect(events[0].action).toBe('read');
      expect(events[0].resource).toBe('weather_data');
      expect(events[0].result).toBe('success');
      expect(events[0].userId).toBe('user123');
    });

    it('should track data classification', () => {
      auditLogger.logDataAccess(
        'read',
        'sensitive_data',
        'success',
        'user123',
        { dataClassification: 'confidential' },
      );

      const events = auditLogger.query({ type: 'data-access' });
      const event = events[0] as any;
      expect(event.dataClassification).toBe('confidential');
    });
  });

  describe('Security Event Logging', () => {
    it('should log security event', () => {
      auditLogger.logSecurity(
        'threat_detected',
        '/api/weather',
        'success',
        'high',
        undefined,
        {
          threatType: 'sql-injection',
          blocked: true,
          reason: 'SQL pattern detected',
        },
      );

      const events = auditLogger.query({ type: 'security' });
      expect(events).toHaveLength(1);

      const event = events[0] as any;
      expect(event.type).toBe('security');
      expect(event.eventType).toBe('threat_detected');
      expect(event.severity).toBe('high');
      expect(event.blocked).toBe(true);
    });
  });

  describe('API Usage Logging', () => {
    it('should log API usage event', () => {
      auditLogger.logApiUsage(
        'GET',
        '/api/weather',
        200,
        125,
        'user123',
        {
          userAgent: 'Mozilla/5.0',
          clientIp: '192.168.1.100',
        },
      );

      const events = auditLogger.query({ type: 'api-usage' });
      expect(events).toHaveLength(1);

      const event = events[0] as any;
      expect(event.type).toBe('api-usage');
      expect(event.method).toBe('GET');
      expect(event.endpoint).toBe('/api/weather');
      expect(event.statusCode).toBe(200);
      expect(event.duration).toBe(125);
      expect(event.result).toBe('success');
    });

    it('should classify 5xx as failure', () => {
      auditLogger.logApiUsage('GET', '/api/error', 500, 50);

      const events = auditLogger.query({ type: 'api-usage' });
      expect(events[0].result).toBe('failure');
    });
  });

  describe('Querying Events', () => {
    beforeEach(() => {
      // Add multiple events
      auditLogger.logDataAccess('read', 'weather_data', 'success', 'user1');
      auditLogger.logDataAccess('write', 'weather_data', 'failure', 'user2');
      auditLogger.logSecurity('authentication', undefined, 'success', 'low', 'user1');
    });

    it('should filter by type', () => {
      const events = auditLogger.query({ type: 'data-access' });
      expect(events).toHaveLength(2);
      expect(events.every(e => e.type === 'data-access')).toBe(true);
    });

    it('should filter by result', () => {
      const events = auditLogger.query({ result: 'success' });
      expect(events).toHaveLength(2);
      expect(events.every(e => e.result === 'success')).toBe(true);
    });

    it('should filter by userId', () => {
      const events = auditLogger.query({ userId: 'user1' });
      expect(events).toHaveLength(2);
      expect(events.every(e => e.userId === 'user1')).toBe(true);
    });

    it('should limit results', () => {
      const events = auditLogger.query({ limit: 2 });
      expect(events).toHaveLength(2);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      auditLogger.logDataAccess('read', 'weather_data', 'success', 'user1');
      auditLogger.logDataAccess('read', 'forecast_data', 'success', 'user2');
      auditLogger.logSecurity('threat_detected', undefined, 'success', 'critical');
      auditLogger.logApiUsage('GET', '/api/weather', 200, 100);
    });

    it('should calculate statistics correctly', () => {
      const stats = auditLogger.getStatistics();

      expect(stats.totalEvents).toBe(4);
      expect(stats.byType['data-access']).toBe(2);
      expect(stats.byType['security']).toBe(1);
      expect(stats.byType['api-usage']).toBe(1);
      expect(stats.dataAccess.total).toBe(2);
      expect(stats.dataAccess.byAction.read).toBe(2);
      expect(stats.security.total).toBe(1);
      expect(stats.security.bySeverity.critical).toBe(1);
      expect(stats.uniqueUsers).toBe(2);
    });
  });

  describe('Export', () => {
    it('should export events as JSON', () => {
      auditLogger.logDataAccess('read', 'weather_data', 'success');

      const exported = auditLogger.export();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveProperty('exportTimestamp');
      expect(parsed).toHaveProperty('eventCount', 1);
      expect(parsed).toHaveProperty('events');
      expect(parsed.events).toHaveLength(1);
    });
  });
});
```

---

## 📈 Configuration Best Practices

### Production Audit Configuration

```typescript
// config.ts (audit logging section)

export const productionAuditConfig: AuditLoggerConfig = {
  enabled: true,
  maxEventsInMemory: 10000,
  retentionMs: 86400000, // 24 hours in memory
  logLevel: 'info',
  includeMetadata: true,
  persistToDisk: true, // Enable for production
  diskPath: '/var/log/mcp-server/audit',
};

export const developmentAuditConfig: AuditLoggerConfig = {
  enabled: true,
  maxEventsInMemory: 1000,
  retentionMs: 3600000, // 1 hour
  logLevel: 'debug',
  includeMetadata: true,
  persistToDisk: false,
};
```

---

## 🔒 Compliance Considerations

### GDPR Compliance

```typescript
// Implement data retention policies
class GDPRCompliantAuditLogger extends AuditLogger {
  /**
   * Anonymize user data in audit logs after retention period
   */
  anonymizeOldEvents(retentionDays: number): void {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    for (const event of this.events) {
      if (event.timestamp.getTime() < cutoffTime) {
        event.userId = '[ANONYMIZED]';
        event.clientIp = '[ANONYMIZED]';

        if (event.metadata) {
          delete event.metadata.email;
          delete event.metadata.username;
        }
      }
    }
  }

  /**
   * Export user data (GDPR data portability)
   */
  exportUserData(userId: string): string {
    const events = this.query({ userId });

    return JSON.stringify({
      userId,
      exportTimestamp: new Date().toISOString(),
      eventCount: events.length,
      events,
    }, null, 2);
  }

  /**
   * Delete user data (GDPR right to be forgotten)
   */
  deleteUserData(userId: string): number {
    const beforeCount = this.events.length;

    this.events = this.events.filter(e => e.userId !== userId);

    const deletedCount = beforeCount - this.events.length;

    this.logger.info({ userId, deletedCount }, 'Deleted user audit data (GDPR)');

    return deletedCount;
  }
}
```

---

## ✅ Audit Logging Validation Checklist

- [ ] AuditLogger class implemented with all event types
- [ ] Data access events logged for all data operations
- [ ] Security events logged for all threat detections
- [ ] API usage logged for all HTTP requests
- [ ] System changes logged for configuration updates
- [ ] Query API implemented for audit investigation
- [ ] Statistics endpoint provides comprehensive metrics
- [ ] Export functionality for compliance reporting
- [ ] Event retention policy configured appropriately
- [ ] Sensitive data redacted from audit logs
- [ ] GDPR compliance features implemented (if applicable)
- [ ] Comprehensive unit tests written
- [ ] Integration tests validate audit flow
- [ ] Disk persistence implemented for production
- [ ] Audit logs protected from unauthorized access

---

**Next**: See `mcp-testing-strategy.md` for comprehensive testing implementation.
