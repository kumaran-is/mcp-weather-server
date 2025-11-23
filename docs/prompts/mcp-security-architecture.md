# 🔒 MCP Server Security Architecture - Complete Implementation Guide

**Version**: 1.0.0
**Last Updated**: 2025-01-23
**Target**: AI Code Assistants (Claude Code, Cline, etc.)
**Companion To**: mcp-code-generator-v3.md

---

## 📋 Overview

This guide provides **complete, production-ready security architecture** for MCP servers. Implement defense-in-depth with input sanitization, threat detection, audit logging, and secure HTTP headers.

### Security Layers

```
External Request
    ↓
Security Headers (CSP, HSTS, etc.)
    ↓
Input Sanitization (DOMPurify)
    ↓
Attack Pattern Detection (SQL injection, XSS, etc.)
    ↓
Threat Monitoring & Blocking
    ↓
Audit Logging (all security events)
    ↓
Business Logic
```

---

## 🎯 Component 1: Security Manager

**Purpose**: Input sanitization, attack pattern detection, security header generation

### Complete Implementation

```typescript
// src/security/security-manager.ts

import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import pino from 'pino';

export interface SecurityConfig {
  sanitizationEnabled: boolean;
  attackDetectionEnabled: boolean;
  sqlInjectionDetection: boolean;
  xssDetection: boolean;
  pathTraversalDetection: boolean;
  commandInjectionDetection: boolean;
  maxInputLength: number;
  allowedHtmlTags: string[];
}

export interface SanitizationResult {
  original: string;
  sanitized: string;
  modified: boolean;
  threats: string[];
}

export class SecurityManager {
  private domPurify: DOMPurify.DOMPurifyI;
  private config: SecurityConfig;
  private logger: pino.Logger;

  constructor(config: SecurityConfig, logger: pino.Logger) {
    this.config = config;
    this.logger = logger;

    // Initialize DOMPurify with JSDOM
    const window = new JSDOM('').window;
    this.domPurify = DOMPurify(window as unknown as Window);

    // Configure DOMPurify
    this.domPurify.setConfig({
      ALLOWED_TAGS: config.allowedHtmlTags,
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
    });
  }

  /**
   * Sanitize any input (string, object, array)
   */
  sanitizeInput(input: any): any {
    if (!this.config.sanitizationEnabled) {
      return input;
    }

    if (typeof input === 'string') {
      return this.sanitizeString(input);
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (input !== null && typeof input === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[this.sanitizeString(key)] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Sanitize string input
   */
  private sanitizeString(input: string): string {
    if (!input || input.length === 0) {
      return input;
    }

    // Check max length
    if (input.length > this.config.maxInputLength) {
      this.logger.warn({
        inputLength: input.length,
        maxLength: this.config.maxInputLength,
      }, 'Input exceeds max length');

      return input.substring(0, this.config.maxInputLength);
    }

    // Use DOMPurify to sanitize
    const sanitized = this.domPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      KEEP_CONTENT: true,
    });

    if (sanitized !== input) {
      this.logger.debug({
        original: input,
        sanitized,
      }, 'Input was sanitized');
    }

    return sanitized;
  }

  /**
   * Sanitize city name specifically
   */
  sanitizeCityName(city: string): string {
    if (!city) {
      return '';
    }

    // Remove any HTML/script tags
    let sanitized = this.sanitizeString(city);

    // Remove special characters (keep letters, numbers, spaces, hyphens, apostrophes)
    sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-']/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit length
    if (sanitized.length > 100) {
      sanitized = sanitized.substring(0, 100);
    }

    return sanitized;
  }

  /**
   * Sanitize HTTP headers
   */
  sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        sanitized[key.toLowerCase()] = this.sanitizeString(value);
      } else if (Array.isArray(value)) {
        sanitized[key.toLowerCase()] = value
          .map(v => this.sanitizeString(String(v)))
          .join(', ');
      } else {
        sanitized[key.toLowerCase()] = String(value);
      }
    }

    return sanitized;
  }

  /**
   * Check if input contains attack patterns
   */
  containsAttackPatterns(input: string): boolean {
    if (!this.config.attackDetectionEnabled) {
      return false;
    }

    const detectedPatterns: string[] = [];

    // SQL Injection detection
    if (this.config.sqlInjectionDetection && this.containsSqlInjection(input)) {
      detectedPatterns.push('SQL Injection');
    }

    // XSS detection
    if (this.config.xssDetection && this.containsXss(input)) {
      detectedPatterns.push('XSS');
    }

    // Path Traversal detection
    if (this.config.pathTraversalDetection && this.containsPathTraversal(input)) {
      detectedPatterns.push('Path Traversal');
    }

    // Command Injection detection
    if (this.config.commandInjectionDetection && this.containsCommandInjection(input)) {
      detectedPatterns.push('Command Injection');
    }

    if (detectedPatterns.length > 0) {
      this.logger.warn({
        input,
        detectedPatterns,
      }, 'Attack patterns detected in input');

      return true;
    }

    return false;
  }

  /**
   * Detect SQL injection patterns
   */
  private containsSqlInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(UNION\s+ALL\s+SELECT)/i,
      /(OR\s+1\s*=\s*1)/i,
      /(OR\s+'1'\s*=\s*'1')/i,
      /(';\s*DROP\s+TABLE)/i,
      /(--\s*$)/m,
      /('#)/,
      /(\bxp_cmdshell\b)/i,
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Detect XSS patterns
   */
  private containsXss(input: string): boolean {
    const xssPatterns = [
      /(<script[^>]*>.*?<\/script>)/is,
      /(<iframe[^>]*>)/i,
      /(javascript:)/i,
      /(onerror\s*=)/i,
      /(onload\s*=)/i,
      /(onclick\s*=)/i,
      /(<img[^>]+src[^>]*>)/i,
      /(<svg[^>]*>)/i,
      /(data:text\/html)/i,
      /(vbscript:)/i,
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Detect path traversal patterns
   */
  private containsPathTraversal(input: string): boolean {
    const pathPatterns = [
      /(\.\.\/)/,
      /(\.\.\\)/,
      /(%2e%2e%2f)/i,
      /(%2e%2e\/)/i,
      /(%2e%2e\\)/i,
      /(\/etc\/passwd)/i,
      /(\/windows\/system32)/i,
    ];

    return pathPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Detect command injection patterns
   */
  private containsCommandInjection(input: string): boolean {
    const commandPatterns = [
      /(\||&|;|`|\$\(|\))/,
      /(>\s*\/dev\/null)/,
      /(\$\{[^}]*\})/,
      /(&&|\|\|)/,
      /(>\s*&)/,
      /(<\s*&)/,
    ];

    return commandPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Get Content Security Policy header
   */
  getContentSecurityPolicy(): string {
    return [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
  }

  /**
   * Get security headers for HTTP responses
   */
  getSecurityHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': this.getContentSecurityPolicy(),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    };
  }

  /**
   * Validate input and return detailed result
   */
  validateInput(input: string): SanitizationResult {
    const sanitized = this.sanitizeString(input);
    const modified = sanitized !== input;
    const threats: string[] = [];

    if (this.config.sqlInjectionDetection && this.containsSqlInjection(input)) {
      threats.push('SQL Injection');
    }

    if (this.config.xssDetection && this.containsXss(input)) {
      threats.push('XSS');
    }

    if (this.config.pathTraversalDetection && this.containsPathTraversal(input)) {
      threats.push('Path Traversal');
    }

    if (this.config.commandInjectionDetection && this.containsCommandInjection(input)) {
      threats.push('Command Injection');
    }

    return {
      original: input,
      sanitized,
      modified,
      threats,
    };
  }
}
```

---

## 🎯 Component 2: Security Monitor

**Purpose**: Real-time threat detection, request monitoring, threat event tracking

### Complete Implementation

```typescript
// src/security/security-monitor.ts

import pino from 'pino';

export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ThreatType =
  | 'sql-injection'
  | 'xss'
  | 'path-traversal'
  | 'command-injection'
  | 'rate-limit-violation'
  | 'suspicious-pattern'
  | 'invalid-input';

export interface ThreatEvent {
  id: string;
  timestamp: Date;
  type: ThreatType;
  severity: ThreatSeverity;
  source: string;
  details: string;
  clientIp?: string;
  userId?: string;
  blocked: boolean;
}

export interface SecurityMonitorConfig {
  enabled: boolean;
  maxThreatsInMemory: number;
  threatRetentionMs: number;
  blockOnCritical: boolean;
  blockOnHighThreshold: number; // Block if N high threats in retention window
}

export class SecurityMonitor {
  private threats: ThreatEvent[] = [];
  private threatIdCounter: number = 0;
  private config: SecurityMonitorConfig;
  private logger: pino.Logger;

  constructor(config: SecurityMonitorConfig, logger: pino.Logger) {
    this.config = config;
    this.logger = logger;

    // Periodically clean up old threats
    setInterval(() => {
      this.cleanupOldThreats();
    }, 60000); // Every minute
  }

  /**
   * Monitor incoming request for threats
   */
  monitorRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body: any,
    clientIp: string,
    userId?: string,
  ): ThreatEvent[] {
    if (!this.config.enabled) {
      return [];
    }

    const detectedThreats: ThreatEvent[] = [];

    // Check URL for attacks
    const urlThreats = this.checkForAttackPatterns(url, 'URL', clientIp, userId);
    detectedThreats.push(...urlThreats);

    // Check headers for attacks
    for (const [key, value] of Object.entries(headers)) {
      const headerThreats = this.checkForAttackPatterns(
        `${key}: ${value}`,
        `Header (${key})`,
        clientIp,
        userId,
      );
      detectedThreats.push(...headerThreats);
    }

    // Check body for attacks
    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      const bodyThreats = this.checkForAttackPatterns(
        bodyStr,
        'Request Body',
        clientIp,
        userId,
      );
      detectedThreats.push(...bodyThreats);
    }

    // Store detected threats
    for (const threat of detectedThreats) {
      this.addThreat(threat);
    }

    // Check if we should block
    if (this.shouldBlockRequest(detectedThreats, clientIp)) {
      detectedThreats.forEach(t => t.blocked = true);
    }

    return detectedThreats;
  }

  /**
   * Check input for attack patterns
   */
  private checkForAttackPatterns(
    input: string,
    source: string,
    clientIp: string,
    userId?: string,
  ): ThreatEvent[] {
    const threats: ThreatEvent[] = [];

    // SQL Injection
    if (this.containsSqlInjection(input)) {
      threats.push(this.createThreat(
        'sql-injection',
        'critical',
        source,
        `SQL injection pattern detected: ${input.substring(0, 100)}`,
        clientIp,
        userId,
      ));
    }

    // XSS
    if (this.containsXss(input)) {
      threats.push(this.createThreat(
        'xss',
        'high',
        source,
        `XSS pattern detected: ${input.substring(0, 100)}`,
        clientIp,
        userId,
      ));
    }

    // Path Traversal
    if (this.containsPathTraversal(input)) {
      threats.push(this.createThreat(
        'path-traversal',
        'high',
        source,
        `Path traversal pattern detected: ${input.substring(0, 100)}`,
        clientIp,
        userId,
      ));
    }

    // Command Injection
    if (this.containsCommandInjection(input)) {
      threats.push(this.createThreat(
        'command-injection',
        'critical',
        source,
        `Command injection pattern detected: ${input.substring(0, 100)}`,
        clientIp,
        userId,
      ));
    }

    return threats;
  }

  /**
   * Create threat event
   */
  private createThreat(
    type: ThreatType,
    severity: ThreatSeverity,
    source: string,
    details: string,
    clientIp: string,
    userId?: string,
  ): ThreatEvent {
    return {
      id: `threat-${++this.threatIdCounter}`,
      timestamp: new Date(),
      type,
      severity,
      source,
      details,
      clientIp,
      userId,
      blocked: false,
    };
  }

  /**
   * Add threat to monitoring
   */
  private addThreat(threat: ThreatEvent): void {
    this.threats.push(threat);

    // Limit memory usage
    if (this.threats.length > this.config.maxThreatsInMemory) {
      this.threats.shift();
    }

    this.logger.warn({
      threatId: threat.id,
      type: threat.type,
      severity: threat.severity,
      source: threat.source,
      details: threat.details,
      clientIp: threat.clientIp,
      userId: threat.userId,
    }, 'Security threat detected');
  }

  /**
   * Determine if request should be blocked
   */
  private shouldBlockRequest(
    detectedThreats: ThreatEvent[],
    clientIp: string,
  ): boolean {
    // Block on any critical threat
    if (this.config.blockOnCritical) {
      if (detectedThreats.some(t => t.severity === 'critical')) {
        this.logger.error({
          clientIp,
          threats: detectedThreats,
        }, 'Blocking request due to critical threat');

        return true;
      }
    }

    // Block if too many high threats from same IP
    const recentHighThreats = this.threats.filter(t =>
      t.severity === 'high' &&
      t.clientIp === clientIp &&
      Date.now() - t.timestamp.getTime() < this.config.threatRetentionMs,
    );

    if (recentHighThreats.length >= this.config.blockOnHighThreshold) {
      this.logger.error({
        clientIp,
        highThreatCount: recentHighThreats.length,
        threshold: this.config.blockOnHighThreshold,
      }, 'Blocking request due to repeated high threats');

      return true;
    }

    return false;
  }

  /**
   * Clean up old threats
   */
  private cleanupOldThreats(): void {
    const cutoffTime = Date.now() - this.config.threatRetentionMs;

    const beforeCount = this.threats.length;

    this.threats = this.threats.filter(
      threat => threat.timestamp.getTime() > cutoffTime,
    );

    const removedCount = beforeCount - this.threats.length;

    if (removedCount > 0) {
      this.logger.debug({
        removedCount,
        remainingCount: this.threats.length,
      }, 'Cleaned up old threats');
    }
  }

  /**
   * Get all threats
   */
  getThreats(filter?: {
    severity?: ThreatSeverity;
    type?: ThreatType;
    clientIp?: string;
    since?: Date;
  }): ThreatEvent[] {
    let filtered = [...this.threats];

    if (filter) {
      if (filter.severity) {
        filtered = filtered.filter(t => t.severity === filter.severity);
      }

      if (filter.type) {
        filtered = filtered.filter(t => t.type === filter.type);
      }

      if (filter.clientIp) {
        filtered = filtered.filter(t => t.clientIp === filter.clientIp);
      }

      if (filter.since) {
        filtered = filtered.filter(t => t.timestamp >= filter.since);
      }
    }

    return filtered;
  }

  /**
   * Get threat statistics
   */
  getStatistics(): {
    totalThreats: number;
    bySeverity: Record<ThreatSeverity, number>;
    byType: Record<ThreatType, number>;
    blockedCount: number;
    uniqueIps: number;
  } {
    const stats = {
      totalThreats: this.threats.length,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      } as Record<ThreatSeverity, number>,
      byType: {
        'sql-injection': 0,
        'xss': 0,
        'path-traversal': 0,
        'command-injection': 0,
        'rate-limit-violation': 0,
        'suspicious-pattern': 0,
        'invalid-input': 0,
      } as Record<ThreatType, number>,
      blockedCount: 0,
      uniqueIps: new Set<string>(),
    };

    for (const threat of this.threats) {
      stats.bySeverity[threat.severity]++;
      stats.byType[threat.type]++;

      if (threat.blocked) {
        stats.blockedCount++;
      }

      if (threat.clientIp) {
        stats.uniqueIps.add(threat.clientIp);
      }
    }

    return {
      ...stats,
      uniqueIps: stats.uniqueIps.size,
    };
  }

  /**
   * Clear all threats
   */
  clearThreats(): void {
    const count = this.threats.length;
    this.threats = [];

    this.logger.info({ count }, 'Cleared all threats');
  }

  // Attack pattern detection methods (same as SecurityManager)
  private containsSqlInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(UNION\s+ALL\s+SELECT)/i,
      /(OR\s+1\s*=\s*1)/i,
      /(OR\s+'1'\s*=\s*'1')/i,
      /(';\s*DROP\s+TABLE)/i,
      /(--\s*$)/m,
      /('#)/,
      /(\bxp_cmdshell\b)/i,
    ];
    return sqlPatterns.some(pattern => pattern.test(input));
  }

  private containsXss(input: string): boolean {
    const xssPatterns = [
      /(<script[^>]*>.*?<\/script>)/is,
      /(<iframe[^>]*>)/i,
      /(javascript:)/i,
      /(onerror\s*=)/i,
      /(onload\s*=)/i,
      /(onclick\s*=)/i,
      /(<img[^>]+src[^>]*>)/i,
      /(<svg[^>]*>)/i,
      /(data:text\/html)/i,
      /(vbscript:)/i,
    ];
    return xssPatterns.some(pattern => pattern.test(input));
  }

  private containsPathTraversal(input: string): boolean {
    const pathPatterns = [
      /(\.\.\/)/,
      /(\.\.\\)/,
      /(%2e%2e%2f)/i,
      /(%2e%2e\/)/i,
      /(%2e%2e\\)/i,
      /(\/etc\/passwd)/i,
      /(\/windows\/system32)/i,
    ];
    return pathPatterns.some(pattern => pattern.test(input));
  }

  private containsCommandInjection(input: string): boolean {
    const commandPatterns = [
      /(\||&|;|`|\$\(|\))/,
      /(>\s*\/dev\/null)/,
      /(\$\{[^}]*\})/,
      /(&&|\|\|)/,
      /(>\s*&)/,
      /(<\s*&)/,
    ];
    return commandPatterns.some(pattern => pattern.test(input));
  }
}
```

---

## 🎯 Component 3: Security Middleware

**Purpose**: Integrate security into Fastify HTTP server

### Complete Implementation

```typescript
// src/server.ts (security middleware excerpts)

import { SecurityManager } from './security/security-manager.js';
import { SecurityMonitor } from './security/security-monitor.js';

// Initialize security components
const securityManager = new SecurityManager({
  sanitizationEnabled: true,
  attackDetectionEnabled: true,
  sqlInjectionDetection: true,
  xssDetection: true,
  pathTraversalDetection: true,
  commandInjectionDetection: true,
  maxInputLength: 10000,
  allowedHtmlTags: [],
}, logger);

const securityMonitor = new SecurityMonitor({
  enabled: true,
  maxThreatsInMemory: 1000,
  threatRetentionMs: 3600000, // 1 hour
  blockOnCritical: true,
  blockOnHighThreshold: 5,
}, logger);

// Add security headers to all responses
fastify.addHook('onRequest', async (request, reply) => {
  const securityHeaders = securityManager.getSecurityHeaders();

  for (const [key, value] of Object.entries(securityHeaders)) {
    reply.header(key, value);
  }
});

// Security monitoring and threat detection
fastify.addHook('preHandler', async (request, reply) => {
  // 1. Sanitize headers
  const sanitizedHeaders = securityManager.sanitizeHeaders(request.headers as any);

  // 2. Monitor request for threats
  const threats = securityMonitor.monitorRequest(
    request.method,
    request.url,
    sanitizedHeaders,
    request.body,
    request.ip,
  );

  // 3. Block critical threats
  if (threats.some(t => t.severity === 'critical')) {
    logger.error({
      method: request.method,
      url: request.url,
      ip: request.ip,
      threats,
    }, 'Request blocked due to critical security threat');

    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Request blocked due to security violation',
    });
  }

  // 4. Warn on high threats
  if (threats.some(t => t.severity === 'high')) {
    logger.warn({
      method: request.method,
      url: request.url,
      ip: request.ip,
      threats,
    }, 'High severity security threat detected');
  }
});

// Security health endpoint
fastify.get('/health/security', async (request, reply) => {
  const stats = securityMonitor.getStatistics();
  const recentThreats = securityMonitor.getThreats({
    since: new Date(Date.now() - 3600000), // Last hour
  });

  return {
    timestamp: new Date().toISOString(),
    status: stats.bySeverity.critical === 0 ? 'healthy' : 'degraded',
    statistics: stats,
    recentThreats: recentThreats.slice(0, 10), // Last 10 threats
  };
});
```

---

## 🎯 Component 4: Input Validation with Zod

**Purpose**: Type-safe input validation before security checks

### Complete Implementation

```typescript
// src/mcp-server.ts (tool registration with validation)

import { z } from 'zod';
import { SecurityManager } from './security/security-manager.js';

// Tool input schemas with security constraints
const cityInputSchema = z.object({
  city: z.string()
    .min(1, 'City name is required')
    .max(100, 'City name too long')
    .regex(/^[a-zA-Z0-9\s\-']+$/, 'City name contains invalid characters')
    .describe('City name (e.g., "London", "New York", "Tokyo")'),
});

// Register tool with validation and sanitization
this.mcpServer.registerTool(
  'get_current_weather',
  {
    title: 'Current Weather',
    description: 'Get current weather for a city',
    inputSchema: cityInputSchema,
  },
  async ({ city }) => {
    try {
      // 1. Zod validation (already done by SDK)
      // 2. Security sanitization
      const sanitizedInput = securityManager.sanitizeInput({ city });
      const cleanCity = securityManager.sanitizeCityName(sanitizedInput.city);

      // 3. Attack pattern check
      if (securityManager.containsAttackPatterns(cleanCity)) {
        logger.warn({ city, cleanCity }, 'Attack patterns detected in city input');

        return {
          content: [{
            type: 'text',
            text: 'Invalid input: potential security threat detected',
          }],
          isError: true,
        };
      }

      // 4. Business logic
      const weather = await this.weatherService.getCurrentWeather(cleanCity);

      // 5. Return safe result
      return {
        content: [{
          type: 'text',
          text: this.formatWeatherText(weather),
        }],
      };

    } catch (error) {
      logger.error({ error, city }, 'Error getting weather');

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
```

---

## 🧪 Testing Security Components

### SecurityManager Tests

```typescript
// src/__tests__/targeted/security-manager.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityManager } from '../../security/security-manager.js';
import pino from 'pino';

describe('SecurityManager', () => {
  let securityManager: SecurityManager;
  let logger: pino.Logger;

  beforeEach(() => {
    logger = pino({ level: 'silent' });
    securityManager = new SecurityManager({
      sanitizationEnabled: true,
      attackDetectionEnabled: true,
      sqlInjectionDetection: true,
      xssDetection: true,
      pathTraversalDetection: true,
      commandInjectionDetection: true,
      maxInputLength: 1000,
      allowedHtmlTags: [],
    }, logger);
  });

  describe('SQL Injection Detection', () => {
    it('should detect SQL injection in SELECT statement', () => {
      const input = "'; SELECT * FROM users; --";
      expect(securityManager.containsAttackPatterns(input)).toBe(true);
    });

    it('should detect SQL injection in UNION attack', () => {
      const input = "London' UNION ALL SELECT password FROM users --";
      expect(securityManager.containsAttackPatterns(input)).toBe(true);
    });

    it('should not flag normal city names', () => {
      const input = "San Francisco";
      expect(securityManager.containsAttackPatterns(input)).toBe(false);
    });
  });

  describe('XSS Detection', () => {
    it('should detect XSS in script tag', () => {
      const input = '<script>alert("XSS")</script>';
      expect(securityManager.containsAttackPatterns(input)).toBe(true);
    });

    it('should detect XSS in event handler', () => {
      const input = '<img src=x onerror=alert("XSS")>';
      expect(securityManager.containsAttackPatterns(input)).toBe(true);
    });

    it('should detect XSS in javascript: URL', () => {
      const input = 'javascript:alert("XSS")';
      expect(securityManager.containsAttackPatterns(input)).toBe(true);
    });
  });

  describe('Path Traversal Detection', () => {
    it('should detect path traversal with ../''', () => {
      const input = '../../etc/passwd';
      expect(securityManager.containsAttackPatterns(input)).toBe(true);
    });

    it('should detect URL-encoded path traversal', () => {
      const input = '%2e%2e%2f%2e%2e%2fetc%2fpasswd';
      expect(securityManager.containsAttackPatterns(input)).toBe(true);
    });
  });

  describe('Command Injection Detection', () => {
    it('should detect command injection with pipe', () => {
      const input = 'London | cat /etc/passwd';
      expect(securityManager.containsAttackPatterns(input)).toBe(true);
    });

    it('should detect command injection with semicolon', () => {
      const input = 'London; rm -rf /';
      expect(securityManager.containsAttackPatterns(input)).toBe(true);
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize HTML tags', () => {
      const input = '<b>London</b>';
      const sanitized = securityManager.sanitizeInput(input);
      expect(sanitized).toBe('London');
    });

    it('should sanitize nested objects', () => {
      const input = {
        city: '<script>alert("XSS")</script>London',
        country: 'UK<b>Bold</b>',
      };

      const sanitized = securityManager.sanitizeInput(input);
      expect(sanitized.city).not.toContain('<script>');
      expect(sanitized.country).not.toContain('<b>');
    });

    it('should sanitize city names correctly', () => {
      const input = "London<script>alert('XSS')</script>";
      const sanitized = securityManager.sanitizeCityName(input);
      expect(sanitized).toBe('London');
      expect(sanitized).not.toContain('<script>');
    });
  });

  describe('Security Headers', () => {
    it('should generate CSP header', () => {
      const csp = securityManager.getContentSecurityPolicy();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('should generate all security headers', () => {
      const headers = securityManager.getSecurityHeaders();
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
    });
  });
});
```

---

## 📊 Security Monitoring Dashboard

### Health Endpoint Response

```json
{
  "timestamp": "2025-01-23T10:30:00.000Z",
  "status": "healthy",
  "statistics": {
    "totalThreats": 15,
    "bySeverity": {
      "low": 5,
      "medium": 7,
      "high": 3,
      "critical": 0
    },
    "byType": {
      "sql-injection": 2,
      "xss": 5,
      "path-traversal": 1,
      "command-injection": 0,
      "rate-limit-violation": 7,
      "suspicious-pattern": 0,
      "invalid-input": 0
    },
    "blockedCount": 2,
    "uniqueIps": 8
  },
  "recentThreats": [
    {
      "id": "threat-15",
      "timestamp": "2025-01-23T10:25:00.000Z",
      "type": "xss",
      "severity": "high",
      "source": "Request Body",
      "details": "XSS pattern detected: <script>alert('test')</script>",
      "clientIp": "192.168.1.100",
      "blocked": false
    }
  ]
}
```

---

## 📈 Configuration Best Practices

### Production Security Configuration

```typescript
// config.ts (security section)

export const productionSecurityConfig = {
  securityManager: {
    sanitizationEnabled: true,
    attackDetectionEnabled: true,
    sqlInjectionDetection: true,
    xssDetection: true,
    pathTraversalDetection: true,
    commandInjectionDetection: true,
    maxInputLength: 10000,
    allowedHtmlTags: [], // No HTML allowed
  },

  securityMonitor: {
    enabled: true,
    maxThreatsInMemory: 1000,
    threatRetentionMs: 3600000, // 1 hour
    blockOnCritical: true,
    blockOnHighThreshold: 5, // Block after 5 high-severity threats
  },
};
```

---

## ✅ Security Validation Checklist

- [ ] DOMPurify integrated for input sanitization
- [ ] All attack patterns detected (SQL injection, XSS, path traversal, command injection)
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options, etc.)
- [ ] Threat monitoring enabled with appropriate thresholds
- [ ] Critical threats blocked automatically
- [ ] All inputs validated with Zod schemas
- [ ] City names sanitized (letters, numbers, spaces, hyphens, apostrophes only)
- [ ] Security health endpoint implemented
- [ ] Comprehensive security tests written
- [ ] Audit logging integrated for all security events
- [ ] Rate limiting prevents abuse
- [ ] HTTPS enforced in production (HSTS header)

---

**Next**: See `mcp-audit-logging.md` for comprehensive audit logging implementation.
