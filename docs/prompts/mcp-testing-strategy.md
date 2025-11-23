# 🧪 MCP Server Testing Strategy - Complete Implementation Guide

**Version**: 1.0.0
**Last Updated**: 2025-01-23
**Target**: AI Code Assistants (Claude Code, Cline, etc.)
**Companion To**: mcp-code-generator-v3.md

---

## 📋 Overview

This guide provides **complete, production-ready testing strategy** for MCP servers. Implement comprehensive test coverage with unit tests, integration tests, middleware tests, and deep integration tests.

### Test Pyramid

```
                    ▲
                   /E\     E2E Tests (Deep Integration)
                  /───\    - Full system scenarios
                 /─────\   - Multi-tool workflows
                /───────\
               /_________\
              /Integration\ Integration Tests
             /─────────────\ - Multi-component tests
            /───────────────\ - HTTP server tests
           /─────────────────\
          /     Unit Tests    \ Unit Tests (Targeted)
         /───────────────────── - Single component tests
        /───────────────────────\ - Resilience patterns
       /__________________________\ - Security components
```

### Testing Layers

1. **Targeted Tests** (Unit): Individual components in isolation
2. **Integration Tests**: Multiple components working together
3. **Middleware Tests**: HTTP middleware and hooks
4. **Server Tests**: Full HTTP server functionality
5. **Deep Tests**: End-to-end scenarios and workflows

---

## 🎯 Layer 1: Targeted Tests (Unit Tests)

**Purpose**: Test individual components in complete isolation

### Test Structure

```
src/__tests__/targeted/
├── circuit-breaker.spec.ts
├── bulkhead.spec.ts
├── rate-limiter.spec.ts
├── retry-strategy.spec.ts
├── pool-manager.spec.ts
├── security-manager.spec.ts
├── security-monitor.spec.ts
├── audit-logger.spec.ts
├── weather-cache.spec.ts
└── weather-service.spec.ts
```

### Example: Circuit Breaker Test

```typescript
// src/__tests__/targeted/circuit-breaker.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker } from '../../undici-resilience/resilience/circuit-breaker.js';
import pino from 'pino';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let logger: pino.Logger;

  beforeEach(() => {
    logger = pino({ level: 'silent' });
    circuitBreaker = new CircuitBreaker(
      'test-circuit',
      {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
        monitoringPeriod: 5000,
      },
      logger,
    );
  });

  describe('State Transitions', () => {
    it('should start in CLOSED state', () => {
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('CLOSED');
    });

    it('should remain CLOSED on success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      await circuitBreaker.execute(fn);

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('CLOSED');
      expect(stats.successes).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should OPEN after threshold failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      // Trigger failures
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(fn)).rejects.toThrow('failure');
      }

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('OPEN');
      expect(stats.failures).toBe(3);
    });

    it('should reject immediately when OPEN', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      // Open circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(fn)).rejects.toThrow();
      }

      // Next call should fail fast
      await expect(circuitBreaker.execute(fn)).rejects.toThrow(/Circuit breaker.*is OPEN/);
      expect(fn).toHaveBeenCalledTimes(3); // Not called again
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      // Open circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(fn)).rejects.toThrow();
      }

      expect(circuitBreaker.getStats().state).toBe('OPEN');

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next call should allow test
      fn.mockResolvedValue('success');
      await circuitBreaker.execute(fn);

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('HALF_OPEN');
    });

    it('should CLOSE after success threshold in HALF_OPEN', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      // Open circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(fn)).rejects.toThrow();
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Succeed twice (success threshold)
      fn.mockResolvedValue('success');
      await circuitBreaker.execute(fn);
      await circuitBreaker.execute(fn);

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('CLOSED');
      expect(stats.consecutiveSuccesses).toBe(0); // Reset on close
    });

    it('should reopen immediately on failure in HALF_OPEN', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      // Open circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(fn)).rejects.toThrow();
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Fail in HALF_OPEN
      await expect(circuitBreaker.execute(fn)).rejects.toThrow('failure');

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('OPEN');
    });
  });

  describe('Monitoring Period', () => {
    it('should only count recent failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      // Configure with short monitoring period
      circuitBreaker = new CircuitBreaker(
        'test-circuit',
        {
          failureThreshold: 3,
          successThreshold: 2,
          timeout: 1000,
          monitoringPeriod: 100, // 100ms window
        },
        logger,
      );

      // Trigger 2 failures
      await expect(circuitBreaker.execute(fn)).rejects.toThrow();
      await expect(circuitBreaker.execute(fn)).rejects.toThrow();

      // Wait for monitoring period to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Third failure should not open circuit (old failures expired)
      await expect(circuitBreaker.execute(fn)).rejects.toThrow();

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('CLOSED'); // Still closed
    });
  });

  describe('Manual Control', () => {
    it('should reset to CLOSED on manual reset', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('failure'));

      // Open circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(fn)).rejects.toThrow();
      }

      expect(circuitBreaker.getStats().state).toBe('OPEN');

      // Manual reset
      circuitBreaker.reset();

      expect(circuitBreaker.getStats().state).toBe('CLOSED');
    });

    it('should force OPEN on forceOpen', () => {
      expect(circuitBreaker.getStats().state).toBe('CLOSED');

      circuitBreaker.forceOpen();

      expect(circuitBreaker.getStats().state).toBe('OPEN');
    });
  });
});
```

### Example: Security Manager Test

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
    const sqlInjectionCases = [
      "'; SELECT * FROM users; --",
      "admin' OR '1'='1",
      "1' UNION ALL SELECT password FROM users --",
      "'; DROP TABLE users; --",
      "admin'--",
      "1' AND 1=1--",
    ];

    it.each(sqlInjectionCases)('should detect SQL injection: %s', (input) => {
      expect(securityManager.containsAttackPatterns(input)).toBe(true);
    });

    it('should not flag normal queries', () => {
      const safeInputs = [
        'London',
        'New York',
        "O'Brien", // Apostrophe is allowed in names
        'San Francisco',
      ];

      for (const input of safeInputs) {
        expect(securityManager.containsAttackPatterns(input)).toBe(false);
      }
    });
  });

  describe('XSS Detection', () => {
    const xssCases = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="evil.com"></iframe>',
      '<svg onload=alert("XSS")>',
      '<body onload=alert("XSS")>',
    ];

    it.each(xssCases)('should detect XSS: %s', (input) => {
      expect(securityManager.containsAttackPatterns(input)).toBe(true);
    });
  });

  describe('Path Traversal Detection', () => {
    const pathTraversalCases = [
      '../../etc/passwd',
      '..\\..\\windows\\system32',
      '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '../../../var/log',
    ];

    it.each(pathTraversalCases)('should detect path traversal: %s', (input) => {
      expect(securityManager.containsAttackPatterns(input)).toBe(true);
    });
  });

  describe('Command Injection Detection', () => {
    const commandInjectionCases = [
      'London | cat /etc/passwd',
      'London; rm -rf /',
      'London && cat /etc/passwd',
      'London `whoami`',
      'London $(whoami)',
    ];

    it.each(commandInjectionCases)('should detect command injection: %s', (input) => {
      expect(securityManager.containsAttackPatterns(input)).toBe(true);
    });
  });

  describe('Input Sanitization', () => {
    it('should remove HTML tags', () => {
      const input = '<b>London</b><script>alert("XSS")</script>';
      const sanitized = securityManager.sanitizeInput(input);

      expect(sanitized).not.toContain('<b>');
      expect(sanitized).not.toContain('</b>');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toBe('London');
    });

    it('should sanitize nested objects', () => {
      const input = {
        city: '<script>alert("XSS")</script>London',
        country: '<b>UK</b>',
        nested: {
          value: '<iframe>evil</iframe>',
        },
      };

      const sanitized = securityManager.sanitizeInput(input);

      expect(sanitized.city).toBe('London');
      expect(sanitized.country).toBe('UK');
      expect(sanitized.nested.value).not.toContain('<iframe>');
    });

    it('should sanitize arrays', () => {
      const input = ['<script>XSS</script>', 'Normal', '<b>Bold</b>'];
      const sanitized = securityManager.sanitizeInput(input);

      expect(sanitized[0]).not.toContain('<script>');
      expect(sanitized[1]).toBe('Normal');
      expect(sanitized[2]).not.toContain('<b>');
    });

    it('should enforce max length', () => {
      const input = 'A'.repeat(2000);
      const sanitized = securityManager.sanitizeInput(input);

      expect(sanitized.length).toBe(1000); // maxInputLength
    });
  });

  describe('City Name Sanitization', () => {
    it('should allow letters, numbers, spaces, hyphens, apostrophes', () => {
      const input = "New York-on-Thames 123'";
      const sanitized = securityManager.sanitizeCityName(input);

      expect(sanitized).toBe("New York-on-Thames 123'");
    });

    it('should remove special characters', () => {
      const input = 'London<script>alert("XSS")</script>@#$%';
      const sanitized = securityManager.sanitizeCityName(input);

      expect(sanitized).toBe('London');
    });

    it('should trim whitespace', () => {
      const input = '  London  ';
      const sanitized = securityManager.sanitizeCityName(input);

      expect(sanitized).toBe('London');
    });

    it('should limit length to 100 characters', () => {
      const input = 'A'.repeat(200);
      const sanitized = securityManager.sanitizeCityName(input);

      expect(sanitized.length).toBe(100);
    });
  });

  describe('Security Headers', () => {
    it('should generate comprehensive CSP', () => {
      const csp = securityManager.getContentSecurityPolicy();

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
    });

    it('should include all security headers', () => {
      const headers = securityManager.getSecurityHeaders();

      expect(headers).toHaveProperty('Content-Security-Policy');
      expect(headers).toHaveProperty('X-Frame-Options', 'DENY');
      expect(headers).toHaveProperty('X-Content-Type-Options', 'nosniff');
      expect(headers).toHaveProperty('X-XSS-Protection');
      expect(headers).toHaveProperty('Strict-Transport-Security');
      expect(headers).toHaveProperty('Referrer-Policy');
      expect(headers).toHaveProperty('Permissions-Policy');
    });

    it('should include HSTS with preload', () => {
      const headers = securityManager.getSecurityHeaders();

      expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
      expect(headers['Strict-Transport-Security']).toContain('includeSubDomains');
      expect(headers['Strict-Transport-Security']).toContain('preload');
    });
  });

  describe('Validate Input', () => {
    it('should return detailed validation result', () => {
      const input = '<script>alert("XSS")</script>London';
      const result = securityManager.validateInput(input);

      expect(result.original).toBe(input);
      expect(result.sanitized).toBe('London');
      expect(result.modified).toBe(true);
      expect(result.threats).toContain('XSS');
    });

    it('should detect multiple threats', () => {
      const input = "'; SELECT * FROM users; --<script>alert('XSS')</script>";
      const result = securityManager.validateInput(input);

      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats).toEqual(expect.arrayContaining(['SQL Injection', 'XSS']));
    });
  });
});
```

### Example: Audit Logger Test

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
    it('should log read access', () => {
      auditLogger.logDataAccess(
        'read',
        'weather_data',
        'success',
        'user123',
        { resourceId: 'London', dataClassification: 'public' },
      );

      const events = auditLogger.query({ type: 'data-access' });
      expect(events).toHaveLength(1);

      const event = events[0] as any;
      expect(event.action).toBe('read');
      expect(event.resource).toBe('weather_data');
      expect(event.userId).toBe('user123');
    });

    it('should track all CRUD operations', () => {
      auditLogger.logDataAccess('read', 'data', 'success');
      auditLogger.logDataAccess('write', 'data', 'success');
      auditLogger.logDataAccess('update', 'data', 'success');
      auditLogger.logDataAccess('delete', 'data', 'success');

      const stats = auditLogger.getStatistics();
      expect(stats.dataAccess.byAction.read).toBe(1);
      expect(stats.dataAccess.byAction.write).toBe(1);
      expect(stats.dataAccess.byAction.update).toBe(1);
      expect(stats.dataAccess.byAction.delete).toBe(1);
    });
  });

  describe('Security Event Logging', () => {
    it('should log security threats', () => {
      auditLogger.logSecurity(
        'threat_detected',
        '/api/weather',
        'success',
        'critical',
        undefined,
        {
          threatType: 'sql-injection',
          blocked: true,
        },
      );

      const events = auditLogger.query({ type: 'security' });
      expect(events).toHaveLength(1);

      const event = events[0] as any;
      expect(event.eventType).toBe('threat_detected');
      expect(event.severity).toBe('critical');
      expect(event.blocked).toBe(true);
    });

    it('should track severity levels', () => {
      auditLogger.logSecurity('event1', undefined, 'success', 'low');
      auditLogger.logSecurity('event2', undefined, 'success', 'medium');
      auditLogger.logSecurity('event3', undefined, 'success', 'high');
      auditLogger.logSecurity('event4', undefined, 'success', 'critical');

      const stats = auditLogger.getStatistics();
      expect(stats.security.bySeverity.low).toBe(1);
      expect(stats.security.bySeverity.medium).toBe(1);
      expect(stats.security.bySeverity.high).toBe(1);
      expect(stats.security.bySeverity.critical).toBe(1);
    });
  });

  describe('API Usage Logging', () => {
    it('should log successful API calls', () => {
      auditLogger.logApiUsage('GET', '/api/weather', 200, 125);

      const events = auditLogger.query({ type: 'api-usage' });
      expect(events).toHaveLength(1);

      const event = events[0] as any;
      expect(event.method).toBe('GET');
      expect(event.endpoint).toBe('/api/weather');
      expect(event.statusCode).toBe(200);
      expect(event.duration).toBe(125);
      expect(event.result).toBe('success');
    });

    it('should classify responses correctly', () => {
      auditLogger.logApiUsage('GET', '/success', 200, 100);
      auditLogger.logApiUsage('GET', '/client-error', 400, 50);
      auditLogger.logApiUsage('GET', '/server-error', 500, 75);

      const events = auditLogger.query({ type: 'api-usage' }) as any[];

      expect(events[0].result).toBe('success'); // 200
      expect(events[1].result).toBe('partial'); // 400
      expect(events[2].result).toBe('failure'); // 500
    });
  });

  describe('Querying', () => {
    beforeEach(() => {
      auditLogger.logDataAccess('read', 'data1', 'success', 'user1', { clientIp: '1.1.1.1' });
      auditLogger.logDataAccess('write', 'data2', 'failure', 'user2', { clientIp: '2.2.2.2' });
      auditLogger.logSecurity('event', undefined, 'success', 'low', 'user1');
      auditLogger.logApiUsage('GET', '/api', 200, 100, 'user1');
    });

    it('should filter by type', () => {
      const events = auditLogger.query({ type: 'data-access' });
      expect(events).toHaveLength(2);
      expect(events.every(e => e.type === 'data-access')).toBe(true);
    });

    it('should filter by result', () => {
      const events = auditLogger.query({ result: 'success' });
      expect(events).toHaveLength(3);
    });

    it('should filter by userId', () => {
      const events = auditLogger.query({ userId: 'user1' });
      expect(events).toHaveLength(3);
    });

    it('should filter by clientIp', () => {
      const events = auditLogger.query({ clientIp: '1.1.1.1' });
      expect(events).toHaveLength(1);
    });

    it('should filter by time range', () => {
      const startTime = new Date(Date.now() - 1000);
      const endTime = new Date(Date.now() + 1000);

      const events = auditLogger.query({ startTime, endTime });
      expect(events).toHaveLength(4); // All events within range
    });

    it('should limit results', () => {
      const events = auditLogger.query({ limit: 2 });
      expect(events).toHaveLength(2);
    });
  });

  describe('Statistics', () => {
    it('should calculate comprehensive statistics', () => {
      auditLogger.logDataAccess('read', 'weather_data', 'success', 'user1');
      auditLogger.logDataAccess('read', 'forecast_data', 'success', 'user2');
      auditLogger.logSecurity('threat', undefined, 'success', 'high', 'user3', { blocked: true });
      auditLogger.logApiUsage('GET', '/api', 200, 150);

      const stats = auditLogger.getStatistics();

      expect(stats.totalEvents).toBe(4);
      expect(stats.byType['data-access']).toBe(2);
      expect(stats.byType.security).toBe(1);
      expect(stats.byType['api-usage']).toBe(1);
      expect(stats.uniqueUsers).toBe(3);
      expect(stats.dataAccess.total).toBe(2);
      expect(stats.dataAccess.byResource.weather_data).toBe(1);
      expect(stats.security.blockedCount).toBe(1);
      expect(stats.apiUsage.averageDuration).toBe(150);
    });
  });

  describe('Export', () => {
    it('should export all events as JSON', () => {
      auditLogger.logDataAccess('read', 'data', 'success');
      auditLogger.logSecurity('event', undefined, 'success', 'low');

      const exported = auditLogger.export();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveProperty('exportTimestamp');
      expect(parsed).toHaveProperty('eventCount', 2);
      expect(parsed).toHaveProperty('events');
      expect(parsed.events).toHaveLength(2);
    });

    it('should export filtered events', () => {
      auditLogger.logDataAccess('read', 'data', 'success');
      auditLogger.logSecurity('event', undefined, 'success', 'low');

      const exported = auditLogger.export({ type: 'data-access' });
      const parsed = JSON.parse(exported);

      expect(parsed.eventCount).toBe(1);
      expect(parsed.filter).toEqual({ type: 'data-access' });
    });
  });

  describe('Retention', () => {
    it('should cleanup old events', async () => {
      const shortRetentionLogger = new AuditLogger({
        enabled: true,
        maxEventsInMemory: 1000,
        retentionMs: 100, // 100ms
        logLevel: 'info',
        includeMetadata: true,
        persistToDisk: false,
      }, logger);

      shortRetentionLogger.logDataAccess('read', 'data', 'success');

      // Wait for retention period to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Trigger cleanup manually (in real code, this happens automatically)
      const stats = shortRetentionLogger.getStatistics();

      // Events should be cleaned up
      expect(stats.totalEvents).toBe(0);
    });
  });
});
```

---

## 🎯 Layer 2: Integration Tests

**Purpose**: Test multiple components working together

### Weather Service Integration Test

```typescript
// src/__tests__/integration/weather-service.spec.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WeatherService } from '../../weather-service.js';
import { WeatherCache } from '../../cache/weather-cache.js';
import { PoolManager } from '../../undici-resilience/http/pool-manager.js';
import pino from 'pino';

describe('WeatherService Integration', () => {
  let weatherService: WeatherService;
  let logger: pino.Logger;

  beforeEach(() => {
    logger = pino({ level: 'silent' });

    const config = {
      api: {
        openMeteoBaseUrl: 'https://api.open-meteo.com',
        geocodingApiUrl: 'https://geocoding-api.open-meteo.com',
        timeout: 10000,
        retries: 3,
        retryDelay: 100,
      },
      // ... other config
    };

    weatherService = new WeatherService(config as any, logger);
  });

  afterEach(async () => {
    await weatherService.close();
  });

  describe('getCurrentWeather', () => {
    it('should fetch real weather data', async () => {
      const weather = await weatherService.getCurrentWeather('London');

      expect(weather).toBeDefined();
      expect(weather.location).toBe('London');
      expect(typeof weather.temperature).toBe('number');
      expect(typeof weather.humidity).toBe('number');
      expect(typeof weather.windSpeed).toBe('number');
      expect(weather.description).toBeTruthy();
    }, 15000);

    it('should use cache on subsequent requests', async () => {
      // First request
      const weather1 = await weatherService.getCurrentWeather('Paris');

      // Second request (should be cached)
      const startTime = Date.now();
      const weather2 = await weatherService.getCurrentWeather('Paris');
      const duration = Date.now() - startTime;

      expect(weather2).toEqual(weather1);
      expect(duration).toBeLessThan(50); // Cache should be very fast
    }, 15000);

    it('should handle invalid city gracefully', async () => {
      await expect(
        weatherService.getCurrentWeather('InvalidCityThatDoesNotExist12345'),
      ).rejects.toThrow(/Unable to find location/);
    }, 15000);
  });

  describe('getForecast', () => {
    it('should fetch forecast data', async () => {
      const forecast = await weatherService.getForecast('Tokyo', 5);

      expect(forecast).toBeDefined();
      expect(forecast.location).toBe('Tokyo');
      expect(forecast.forecasts).toHaveLength(5);

      for (const day of forecast.forecasts) {
        expect(day.date).toBeTruthy();
        expect(typeof day.temperature).toBe('number');
        expect(day.description).toBeTruthy();
      }
    }, 15000);
  });

  describe('Resilience Stack', () => {
    it('should handle rate limiting', async () => {
      // Make many rapid requests to trigger rate limiter
      const promises = Array.from({ length: 100 }, () =>
        weatherService.getCurrentWeather('London'),
      );

      const results = await Promise.allSettled(promises);

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // Some should succeed (within rate limit)
      expect(succeeded).toBeGreaterThan(0);

      // Some should fail (rate limited)
      expect(failed).toBeGreaterThan(0);
    }, 30000);
  });
});
```

---

## 🎯 Layer 3: Middleware Tests

**Purpose**: Test HTTP middleware and Fastify hooks

### Security Middleware Test

```typescript
// src/__tests__/middleware/security-middleware.spec.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { SecurityManager } from '../../security/security-manager.js';
import { SecurityMonitor } from '../../security/security-monitor.js';
import pino from 'pino';

describe('Security Middleware', () => {
  let fastify: FastifyInstance;
  let securityManager: SecurityManager;
  let securityMonitor: SecurityMonitor;
  let logger: pino.Logger;

  beforeEach(async () => {
    logger = pino({ level: 'silent' });

    securityManager = new SecurityManager({
      sanitizationEnabled: true,
      attackDetectionEnabled: true,
      sqlInjectionDetection: true,
      xssDetection: true,
      pathTraversalDetection: true,
      commandInjectionDetection: true,
      maxInputLength: 10000,
      allowedHtmlTags: [],
    }, logger);

    securityMonitor = new SecurityMonitor({
      enabled: true,
      maxThreatsInMemory: 1000,
      threatRetentionMs: 3600000,
      blockOnCritical: true,
      blockOnHighThreshold: 5,
    }, logger);

    fastify = Fastify({ logger: false });

    // Add security headers
    fastify.addHook('onRequest', async (request, reply) => {
      const headers = securityManager.getSecurityHeaders();
      for (const [key, value] of Object.entries(headers)) {
        reply.header(key, value);
      }
    });

    // Add threat monitoring
    fastify.addHook('preHandler', async (request, reply) => {
      const threats = securityMonitor.monitorRequest(
        request.method,
        request.url,
        request.headers as any,
        request.body,
        request.ip,
      );

      if (threats.some(t => t.severity === 'critical')) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
    });

    // Test route
    fastify.get('/test', async () => {
      return { message: 'success' };
    });

    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('Security Headers', () => {
    it('should add security headers to all responses', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    });
  });

  describe('Threat Detection', () => {
    it('should allow normal requests', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test?city=London',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ message: 'success' });
    });

    it('should block SQL injection attempts', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: "/test?city='; DROP TABLE users; --",
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: 'Forbidden' });
    });

    it('should block XSS attempts', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test?city=<script>alert("XSS")</script>',
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: 'Forbidden' });
    });

    it('should block command injection', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test?cmd=London | cat /etc/passwd',
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
```

---

## 🎯 Layer 4: Server Tests

**Purpose**: Test full HTTP server with all components

### HTTP Server Test

```typescript
// src/__tests__/server/http-server.spec.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from '../../server.js';
import type { FastifyInstance } from 'fastify';

describe('HTTP Server', () => {
  let fastify: FastifyInstance;

  beforeAll(async () => {
    process.env.MCP_TRANSPORT = 'http';
    process.env.HTTP_PORT = '0'; // Random port

    fastify = await startServer();
  });

  afterAll(async () => {
    await fastify.close();
  });

  describe('Health Endpoints', () => {
    it('should return basic health status', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('status', 'healthy');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('environment');
    });

    it('should return resilience metrics', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/health/resilience',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('pools');
      expect(body).toHaveProperty('circuitBreakers');
      expect(body).toHaveProperty('bulkheads');
      expect(body).toHaveProperty('rateLimiters');
    });

    it('should return security metrics', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/health/security',
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('statistics');
    });
  });

  describe('MCP Session', () => {
    it('should initialize MCP session', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/mcp/v1/initialize',
        payload: {
          protocolVersion: '0.1.0',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('protocolVersion');
      expect(body).toHaveProperty('capabilities');
      expect(body).toHaveProperty('serverInfo');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/mcp/v1/tools/call',
        headers: {
          'origin': 'http://localhost:3000',
          'access-control-request-method': 'POST',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle malformed JSON', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/mcp/v1/tools/call',
        payload: 'invalid json{',
        headers: {
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
```

---

## 🎯 Layer 5: Deep Tests (E2E)

**Purpose**: End-to-end scenarios testing complete workflows

### Weather Workflow Test

```typescript
// src/__tests__/deep/weather-workflow.spec.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from '../../server.js';
import type { FastifyInstance } from 'fastify';

describe('Weather Workflow (E2E)', () => {
  let fastify: FastifyInstance;
  let sessionId: string;

  beforeAll(async () => {
    process.env.MCP_TRANSPORT = 'http';
    process.env.HTTP_PORT = '0';

    fastify = await startServer();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should complete full weather query workflow', async () => {
    // Step 1: Initialize session
    const initResponse = await fastify.inject({
      method: 'POST',
      url: '/mcp/v1/initialize',
      payload: {
        protocolVersion: '0.1.0',
        capabilities: {},
        clientInfo: {
          name: 'e2e-test',
          version: '1.0.0',
        },
      },
    });

    expect(initResponse.statusCode).toBe(200);

    const initBody = initResponse.json();
    sessionId = initBody.sessionId || 'test-session';

    // Step 2: List available tools
    const toolsResponse = await fastify.inject({
      method: 'POST',
      url: '/mcp/v1/tools/list',
      headers: {
        'x-session-id': sessionId,
      },
      payload: {},
    });

    expect(toolsResponse.statusCode).toBe(200);

    const toolsBody = toolsResponse.json();
    expect(toolsBody.tools).toBeInstanceOf(Array);
    expect(toolsBody.tools.length).toBeGreaterThan(0);

    const weatherTool = toolsBody.tools.find((t: any) => t.name === 'get_current_weather');
    expect(weatherTool).toBeDefined();

    // Step 3: Call weather tool
    const weatherResponse = await fastify.inject({
      method: 'POST',
      url: '/mcp/v1/tools/call',
      headers: {
        'x-session-id': sessionId,
      },
      payload: {
        name: 'get_current_weather',
        arguments: {
          city: 'London',
        },
      },
    });

    expect(weatherResponse.statusCode).toBe(200);

    const weatherBody = weatherResponse.json();
    expect(weatherBody.content).toBeInstanceOf(Array);
    expect(weatherBody.content[0].type).toBe('text');
    expect(weatherBody.content[0].text).toContain('London');
    expect(weatherBody.content[0].text).toContain('°C');

    // Step 4: Call forecast tool
    const forecastResponse = await fastify.inject({
      method: 'POST',
      url: '/mcp/v1/tools/call',
      headers: {
        'x-session-id': sessionId,
      },
      payload: {
        name: 'get_forecast',
        arguments: {
          city: 'London',
          days: 3,
        },
      },
    });

    expect(forecastResponse.statusCode).toBe(200);

    const forecastBody = forecastResponse.json();
    expect(forecastBody.content[0].text).toContain('day forecast');
  }, 30000);

  it('should handle multi-city comparison workflow', async () => {
    const cities = ['London', 'Paris', 'Tokyo'];

    // Initialize session
    const initResponse = await fastify.inject({
      method: 'POST',
      url: '/mcp/v1/initialize',
      payload: {
        protocolVersion: '0.1.0',
        capabilities: {},
        clientInfo: { name: 'multi-city-test', version: '1.0.0' },
      },
    });

    sessionId = initResponse.json().sessionId || 'test-session';

    // Fetch weather for all cities
    const weatherPromises = cities.map(city =>
      fastify.inject({
        method: 'POST',
        url: '/mcp/v1/tools/call',
        headers: { 'x-session-id': sessionId },
        payload: {
          name: 'get_current_weather',
          arguments: { city },
        },
      }),
    );

    const responses = await Promise.all(weatherPromises);

    // All requests should succeed
    expect(responses.every(r => r.statusCode === 200)).toBe(true);

    // Each response should contain city weather
    for (let i = 0; i < cities.length; i++) {
      const body = responses[i].json();
      expect(body.content[0].text).toContain(cities[i]);
    }
  }, 30000);
});
```

---

## 📊 Test Coverage

### Coverage Configuration

```typescript
// vitest.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/__tests__/**',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        'src/**/index.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

### Run Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- targeted/circuit-breaker.spec.ts

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run integration tests only
npm run test:integration

# Run deep tests only
npm run test:deep
```

---

## ✅ Testing Validation Checklist

- [ ] All targeted tests pass (individual components)
- [ ] Integration tests cover multi-component scenarios
- [ ] Middleware tests validate HTTP hooks
- [ ] Server tests cover full HTTP server
- [ ] Deep tests validate end-to-end workflows
- [ ] Test coverage exceeds 80% for lines, functions, statements
- [ ] Test coverage exceeds 75% for branches
- [ ] All resilience patterns tested (circuit breaker, bulkhead, etc.)
- [ ] Security components thoroughly tested
- [ ] Audit logging validated with multiple scenarios
- [ ] Error handling tested for all failure modes
- [ ] Performance tests validate response times
- [ ] Load tests validate concurrent request handling
- [ ] Mock external APIs for deterministic tests
- [ ] Real API tests validate integration (with longer timeouts)

---

**Congratulations!** You now have a complete testing strategy for production-grade MCP servers.
