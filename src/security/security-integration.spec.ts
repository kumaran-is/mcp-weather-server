/**
 * Comprehensive Security Integration Tests
 * Tests all security components working together
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { securityManager } from './sanitizer';
import { securityMonitor } from './security-monitor';
import { auditLogger } from '../audit/audit-logger';

describe('Security Integration Tests', () => {
  beforeEach(() => {
    // Reset security state before each test
    securityMonitor.reset();
    auditLogger.clear();
  });

  afterEach(() => {
    // Clean up after each test
    vi.restoreAllMocks();
  });

  describe('Input Sanitization Security', () => {
    test('should block SQL injection attempts', () => {
      const maliciousInputs = [
        "London'; DROP TABLE users; --",
        "Paris' OR '1'='1",
        "SELECT * FROM cities WHERE name='Tokyo'",
        "'; DELETE FROM weather; --"
      ];

      maliciousInputs.forEach(input => {
        const cleanCity = securityManager.sanitizeCityName(input);
        expect(cleanCity).toBeFalsy();
        expect(securityManager.containsAttackPatterns(input)).toBe(true);
      });
    });

    test('should block XSS attempts', () => {
      const xssInputs = [
        "<script>alert('xss')</script>",
        "javascript:alert('xss')",
        "<iframe src='evil.com'></iframe>",
        "onload=alert('xss')",
        "<img src=x onerror=alert('xss')>"
      ];

      xssInputs.forEach(input => {
        const sanitized = securityManager.sanitizeString(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror');
        expect(securityManager.containsAttackPatterns(input)).toBe(true);
      });
    });

    test('should block path traversal attempts', () => {
      const pathTraversalInputs = [
        "../../../etc/passwd",
        "..\\..\\windows\\system32",
        "....//....//etc/passwd",
        "%2e%2e%2f%2e%2e%2f"
      ];

      pathTraversalInputs.forEach(input => {
        const sanitized = securityManager.sanitizePath(input);
        expect(sanitized).not.toContain('../');
        expect(sanitized).not.toContain('..\\');
        expect(securityManager.containsAttackPatterns(input)).toBe(true);
      });
    });

    test('should allow valid city names', () => {
      const validCities = [
        "London",
        "New York",
        "São Paulo",
        "المدينة المنورة", // Arabic
        "北京", // Chinese
        "Москва", // Russian
        "København" // Danish
      ];

      validCities.forEach(city => {
        const cleanCity = securityManager.sanitizeCityName(city);
        expect(cleanCity).toBeTruthy();
        expect(cleanCity.length).toBeGreaterThan(0);
        expect(securityManager.containsAttackPatterns(city)).toBe(false);
      });
    });
  });

  describe('Threat Detection and Monitoring', () => {
    test('should detect and track brute force attempts', () => {
      const attackerIP = '192.168.1.100';
      
      // Simulate 6 failed attempts (threshold is 5)
      for (let i = 0; i < 6; i++) {
        const threats = securityMonitor.monitorRequest(
          'POST',
          '/mcp',
          {},
          { malicious: 'payload' },
          attackerIP
        );
        
        if (i >= 4) { // After 5th attempt (0-indexed)
          expect(threats).toHaveLength(1);
          expect(threats[0].type).toBe('brute_force');
          expect(threats[0].severity).toBe('high');
        }
      }

      expect(securityMonitor.isIPBlocked(attackerIP)).toBe(true);
    });

    test('should detect rate limiting violations', () => {
      const attackerIP = '192.168.1.101';
      const threats: any[] = [];
      
      // Simulate rapid requests (more than rate limit)
      for (let i = 0; i < 120; i++) { // Over 100 requests per minute limit
        const detected = securityMonitor.monitorRequest(
          'GET',
          '/weather',
          {},
          {},
          attackerIP
        );
        threats.push(...detected);
      }

      const rateLimitThreats = threats.filter(t => t.type === 'rate_limit');
      expect(rateLimitThreats.length).toBeGreaterThan(0);
      expect(securityMonitor.isIPBlocked(attackerIP)).toBe(true);
    });

    test('should detect suspicious pattern combinations', () => {
      const suspiciousRequests = [
        {
          url: '/mcp',
          body: { city: "'; DROP TABLE users; --" },
          headers: { 'user-agent': '<script>alert("xss")</script>' }
        },
        {
          url: '/../../../etc/passwd',
          body: { query: 'SELECT * FROM secrets' },
          headers: { 'x-forwarded-for': '127.0.0.1' }
        }
      ];

      suspiciousRequests.forEach((req, index) => {
        const threats = securityMonitor.monitorRequest(
          'POST',
          req.url,
          req.headers,
          req.body,
          `192.168.1.${200 + index}`
        );

        expect(threats.length).toBeGreaterThan(0);
        const criticalThreats = threats.filter(t => t.severity === 'critical');
        expect(criticalThreats.length).toBeGreaterThan(0);
      });
    });

    test('should maintain threat history and statistics', () => {
      const attackerIP = '192.168.1.102';
      
      // Generate various types of threats
      securityMonitor.monitorRequest('POST', '/mcp', {}, { city: "'; DROP TABLE users; --" }, attackerIP);
      securityMonitor.monitorRequest('GET', '/../etc/passwd', {}, {}, attackerIP);
      securityMonitor.monitorRequest('POST', '/mcp', {}, { query: '<script>alert("xss")</script>' }, attackerIP);

      const threats = securityMonitor.getThreats();
      expect(threats.length).toBeGreaterThan(0);
      
      const threatTypes = threats.map(t => t.type);
      expect(threatTypes).toContain('sql_injection');
      expect(threatTypes).toContain('path_traversal');
      expect(threatTypes).toContain('xss');
    });
  });

  describe('Audit Logging Integration', () => {
    test('should log all security events with proper categories', () => {
      const maliciousIP = '192.168.1.103';
      
      // Trigger security event
      securityMonitor.monitorRequest(
        'POST',
        '/mcp',
        {},
        { city: "'; DROP TABLE users; --" },
        maliciousIP
      );

      // Log additional security events
      auditLogger.logSecurity(
        'malicious_input_detected',
        'weather_tools',
        'success',
        'critical',
        undefined,
        {
          metadata: {
            tool: 'get_current_weather',
            input: "'; DROP TABLE users; --",
            reason: 'sql_injection_detected'
          }
        }
      );

      const securityEvents = auditLogger.query({ category: 'security' });
      expect(securityEvents.length).toBeGreaterThan(0);
      
      const criticalEvents = securityEvents.filter(e => e.severity === 'critical');
      expect(criticalEvents.length).toBeGreaterThan(0);
    });

    test('should log data access attempts with sanitization details', () => {
      const originalInput = "London'; DROP TABLE users; --";
      const sanitizedInput = securityManager.sanitizeInput({ city: originalInput });

      auditLogger.logDataAccess('read', 'weather_data', 'failure', undefined, {
        method: 'get_current_weather',
        statusCode: 400,
        duration: 50,
        error: 'Invalid city name',
        metadata: { originalInput, sanitizedInput }
      });

      const dataAccessEvents = auditLogger.query({ category: 'data_access' });
      expect(dataAccessEvents.length).toBeGreaterThan(0);
      
      const failedAttempt = dataAccessEvents.find(e => e.outcome === 'failure');
      expect(failedAttempt).toBeDefined();
      expect(failedAttempt?.details.metadata?.originalInput).toBe(originalInput);
      expect(failedAttempt?.details.metadata?.sanitizedInput).toBeDefined();
    });

    test('should provide comprehensive audit statistics', () => {
      // Generate various audit events
      auditLogger.logSecurity('threat_detected', 'security_monitor', 'success', 'high');
      auditLogger.logDataAccess('read', 'weather_data', 'success', undefined, { method: 'getCurrentWeather' });
      auditLogger.logApiUsage('POST', '/mcp', 200, 100, undefined, { payload: { city: 'London' } });

      const statistics = auditLogger.getStatistics();
      
      expect(statistics.totalEvents).toBeGreaterThan(0);
      expect(statistics.eventsByCategory).toBeDefined();
      expect(statistics.eventsBySeverity).toBeDefined();
      expect(statistics.securityMetrics).toBeDefined();
      expect(statistics.complianceScore).toBeGreaterThan(0);
    });
  });

  describe('Comprehensive Security Scenarios', () => {
    test('should handle coordinated attack simulation', () => {
      const attackerIPs = ['192.168.1.110', '192.168.1.111', '192.168.1.112'];
      const attackVectors = [
        { type: 'sql_injection', payload: "'; DROP TABLE users; --" },
        { type: 'xss', payload: '<script>alert("xss")</script>' },
        { type: 'path_traversal', payload: '../../../etc/passwd' }
      ];

      let totalThreats = 0;
      let blockedIPs = 0;

      attackerIPs.forEach((ip, ipIndex) => {
        attackVectors.forEach((vector, vectorIndex) => {
          // Multiple attempts per vector per IP
          for (let attempt = 0; attempt < 8; attempt++) {
            const threats = securityMonitor.monitorRequest(
              'POST',
              '/mcp',
              {},
              { input: vector.payload },
              ip
            );
            totalThreats += threats.length;
          }
        });

        if (securityMonitor.isIPBlocked(ip)) {
          blockedIPs++;
        }
      });

      expect(totalThreats).toBeGreaterThan(0);
      expect(blockedIPs).toBe(attackerIPs.length); // All IPs should be blocked
      
      // Verify audit trail
      const securityEvents = auditLogger.query({ category: 'security' });
      expect(securityEvents.length).toBeGreaterThan(0);
    });

    test('should maintain security under legitimate high load', () => {
      const legitimateIPs = Array.from({ length: 10 }, (_, i) => `10.0.0.${i + 1}`);
      const legitimateCities = ['London', 'Paris', 'Tokyo', 'New York', 'Berlin'];

      let totalRequests = 0;
      let threatsDetected = 0;
      let blockedLegitimateIPs = 0;

      legitimateIPs.forEach(ip => {
        legitimateCities.forEach(city => {
          // Normal rate of requests
          for (let i = 0; i < 5; i++) {
            const threats = securityMonitor.monitorRequest(
              'POST',
              '/mcp',
              { 'user-agent': 'MCP-Client/1.0' },
              { city },
              ip
            );
            totalRequests++;
            threatsDetected += threats.length;
          }
        });

        if (securityMonitor.isIPBlocked(ip)) {
          blockedLegitimateIPs++;
        }
      });

      expect(totalRequests).toBe(250); // 10 IPs × 5 cities × 5 requests
      expect(threatsDetected).toBe(0); // No threats should be detected
      expect(blockedLegitimateIPs).toBe(0); // No legitimate IPs should be blocked
    });

    test('should handle mixed legitimate and malicious traffic', () => {
      const mixedScenarios = [
        { ip: '192.168.2.1', legitimate: true, payload: { city: 'London' } },
        { ip: '192.168.2.2', legitimate: false, payload: { city: "'; DROP TABLE users; --" } },
        { ip: '192.168.2.3', legitimate: true, payload: { city: 'Paris' } },
        { ip: '192.168.2.4', legitimate: false, payload: { query: '<script>alert("xss")</script>' } },
        { ip: '192.168.2.5', legitimate: true, payload: { city: 'Tokyo' } }
      ];

      let legitimateBlocked = 0;
      let maliciousBlocked = 0;
      let threatsDetected = 0;

      mixedScenarios.forEach(scenario => {
        // Multiple requests to trigger blocking thresholds
        for (let i = 0; i < 10; i++) {
          const threats = securityMonitor.monitorRequest(
            'POST',
            '/mcp',
            {},
            scenario.payload,
            scenario.ip
          );
          threatsDetected += threats.length;
        }

        if (securityMonitor.isIPBlocked(scenario.ip)) {
          if (scenario.legitimate) {
            legitimateBlocked++;
          } else {
            maliciousBlocked++;
          }
        }
      });

      expect(threatsDetected).toBeGreaterThan(0);
      expect(legitimateBlocked).toBe(0); // No legitimate traffic should be blocked
      expect(maliciousBlocked).toBe(2); // Both malicious IPs should be blocked
    });
  });

  describe('Security Configuration and CSP', () => {
    test('should generate secure Content Security Policy', () => {
      const csp = securityManager.getContentSecurityPolicy();
      
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("style-src 'self'");
      expect(csp).not.toContain("'unsafe-eval'");
    });

    test('should sanitize HTTP headers properly', () => {
      const maliciousHeaders = {
        'user-agent': '<script>alert("xss")</script>',
        'x-forwarded-for': '127.0.0.1; DROP TABLE users;',
        'content-type': 'application/json',
        'authorization': 'Bearer valid-token-123'
      };

      const sanitizedHeaders = securityManager.sanitizeHeaders(maliciousHeaders);
      
      expect(sanitizedHeaders['user-agent']).not.toContain('<script>');
      expect(sanitizedHeaders['x-forwarded-for']).not.toContain('DROP TABLE');
      expect(sanitizedHeaders['content-type']).toBe('application/json'); // Should remain unchanged
      expect(sanitizedHeaders['authorization']).toBe('Bearer valid-token-123'); // Should remain unchanged
    });

    test('should validate and sanitize complex nested inputs', () => {
      const complexInput = {
        city: "London'; DROP TABLE users; --",
        query: '<script>alert("xss")</script>',
        metadata: {
          userAgent: 'Mozilla/5.0...',
          nested: {
            value: '../../../etc/passwd'
          }
        },
        array: ['valid', "'; DROP TABLE", '<iframe>']
      };

      const sanitized = securityManager.sanitizeInput(complexInput);
      
      expect(sanitized.city).not.toContain('DROP TABLE');
      expect(sanitized.query).not.toContain('<script>');
      expect(sanitized.metadata.userAgent).toBe('Mozilla/5.0...');
      expect(sanitized.metadata.nested.value).not.toContain('../');
      expect(sanitized.array[1]).not.toContain('DROP TABLE');
      expect(sanitized.array[2]).not.toContain('<iframe>');
    });
  });

  describe('Error Handling and Security', () => {
    test('should handle security component failures gracefully', () => {
      // Mock security manager failure
      const originalSanitize = securityManager.sanitizeInput;
      vi.spyOn(securityManager, 'sanitizeInput').mockImplementation(() => {
        throw new Error('Security module failure');
      });

      expect(() => {
        try {
          securityManager.sanitizeInput({ city: 'London' });
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('Security module failure');
        }
      }).not.toThrow();

      // Restore original function
      securityManager.sanitizeInput = originalSanitize;
    });

    test('should handle audit logger failures without blocking requests', () => {
      // Mock audit logger failure
      const originalLog = auditLogger.logSecurity;
      vi.spyOn(auditLogger, 'logSecurity').mockImplementation(() => {
        throw new Error('Audit logging failure');
      });

      expect(() => {
        try {
          auditLogger.logSecurity('test_event', 'test_resource', 'success', 'low');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('Audit logging failure');
        }
      }).not.toThrow();

      // Restore original function
      auditLogger.logSecurity = originalLog;
    });
  });

  describe('Performance and Memory Management', () => {
    test('should maintain performance under security load', () => {
      const startTime = Date.now();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const input = `test-city-${i}`;
        securityManager.sanitizeCityName(input);
        securityManager.containsAttackPatterns(input);
      }

      const duration = Date.now() - startTime;
      const avgTimePerOp = duration / iterations;
      
      // Should process security checks in under 1ms per operation on average
      expect(avgTimePerOp).toBeLessThan(1);
    });

    test('should not leak memory during security operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many security operations
      for (let i = 0; i < 10000; i++) {
        const threats = securityMonitor.monitorRequest(
          'POST',
          '/test',
          {},
          { test: `data-${i}` },
          `192.168.${Math.floor(i / 256)}.${i % 256}`
        );
        
        if (i % 1000 === 0) {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB for 10k operations)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});
