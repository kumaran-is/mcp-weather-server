/**
 * Comprehensive Context Manager and Audit Logger Tests
 * Goal: Execute all code paths to maximize coverage
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Context Manager Comprehensive Tests', () => {
  describe('Context CRUD Operations', () => {
    it('should execute complete context lifecycle multiple times', async () => {
      const { contextManager } = await import('../../context/context-manager');

      // Create 20 contexts and exercise all operations
      for (let i = 0; i < 20; i++) {
        const sessionId = `comprehensive-${i}-${Date.now()}`;

        // Create
        const context = contextManager.createContext(sessionId);
        expect(context).toBeDefined();
        expect(context.sessionId).toBe(sessionId);
        expect(context.messages).toBeDefined();
        expect(Array.isArray(context.messages)).toBe(true);
        expect(context.createdAt).toBeDefined();
        expect(context.lastAccessedAt).toBeDefined();

        // Add various message types
        const messageTypes = [
          { role: 'user' as const, content: 'User message 1' },
          { role: 'assistant' as const, content: 'Assistant response 1' },
          { role: 'user' as const, content: 'User message 2' },
          { role: 'assistant' as const, content: 'Assistant response 2' },
          { role: 'system' as const, content: 'System message' }
        ];

        for (const msg of messageTypes) {
          contextManager.addMessage(sessionId, msg);
        }

        // Get and verify
        const retrieved = contextManager.getContext(sessionId);
        expect(retrieved).toBeDefined();
        expect(retrieved?.messages.length).toBeGreaterThanOrEqual(5);

        // Get stats
        const stats = contextManager.getStats(sessionId);
        expect(stats).toBeDefined();
        expect(stats?.messageCount).toBeGreaterThanOrEqual(5);
        expect(stats?.createdAt).toBeDefined();
        expect(stats?.lastAccessedAt).toBeDefined();

        // Clear
        contextManager.clearContext(sessionId);
        const afterClear = contextManager.getContext(sessionId);
        expect(afterClear?.messages.length).toBe(0);

        // Add more messages after clear
        contextManager.addMessage(sessionId, { role: 'user', content: 'After clear' });
        const afterAdd = contextManager.getContext(sessionId);
        expect(afterAdd?.messages.length).toBe(1);

        // Delete
        contextManager.deleteContext(sessionId);
        const afterDelete = contextManager.getContext(sessionId);
        expect(afterDelete).toBeUndefined();
      }
    });

    it('should handle bulk context operations', async () => {
      const { contextManager } = await import('../../context/context-manager');

      // Create many contexts
      const sessionIds = Array.from({ length: 50 }, (_, i) => `bulk-${i}-${Date.now()}`);

      for (const sessionId of sessionIds) {
        contextManager.createContext(sessionId);

        // Add variable number of messages
        const msgCount = (i % 10) + 1;
        for (let j = 0; j < msgCount; j++) {
          contextManager.addMessage(sessionId, {
            role: j % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${j}`
          });
        }
      }

      // Get all context IDs
      const allIds = contextManager.getAllContextIds();
      expect(allIds.length).toBeGreaterThanOrEqual(50);

      // Get stats for each
      for (const sessionId of sessionIds) {
        const stats = contextManager.getStats(sessionId);
        expect(stats).toBeDefined();
        expect(stats?.messageCount).toBeGreaterThan(0);
      }

      // Cleanup
      for (const sessionId of sessionIds) {
        contextManager.deleteContext(sessionId);
      }
    });

    it('should handle edge cases', async () => {
      const { contextManager } = await import('../../context/context-manager');

      // Try to get non-existent context
      const nonExistent = contextManager.getContext('does-not-exist');
      expect(nonExistent).toBeUndefined();

      // Try to add message to non-existent context
      contextManager.addMessage('does-not-exist', { role: 'user', content: 'test' });

      // Try to clear non-existent context
      contextManager.clearContext('does-not-exist');

      // Try to get stats for non-existent context
      const stats = contextManager.getStats('does-not-exist');
      expect(stats).toBeUndefined();

      // Delete non-existent context (should not throw)
      contextManager.deleteContext('does-not-exist');

      // Create context with empty session ID
      const emptySession = contextManager.createContext('');
      expect(emptySession).toBeDefined();

      // Create context with special characters
      const specialSession = contextManager.createContext('session-!@#$%^&*()');
      expect(specialSession).toBeDefined();
    });

    it('should handle concurrent operations', async () => {
      const { contextManager } = await import('../../context/context-manager');

      const sessionId = `concurrent-${Date.now()}`;
      contextManager.createContext(sessionId);

      // Simulate concurrent message additions
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve(contextManager.addMessage(sessionId, {
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Concurrent message ${i}`
        }))
      );

      await Promise.all(promises);

      const context = contextManager.getContext(sessionId);
      expect(context?.messages.length).toBeGreaterThanOrEqual(100);

      contextManager.deleteContext(sessionId);
    });

    it('should handle message content variations', async () => {
      const { contextManager } = await import('../../context/context-manager');

      const sessionId = `variations-${Date.now()}`;
      contextManager.createContext(sessionId);

      const messageVariations = [
        { role: 'user' as const, content: '' },
        { role: 'user' as const, content: ' ' },
        { role: 'user' as const, content: '\n\n\n' },
        { role: 'user' as const, content: 'a'.repeat(1000) },
        { role: 'user' as const, content: '你好世界' },
        { role: 'user' as const, content: '🌍🌎🌏' },
        { role: 'user' as const, content: JSON.stringify({ nested: { object: true } }) },
        { role: 'assistant' as const, content: 'Normal response' },
        { role: 'system' as const, content: 'System notification' }
      ];

      for (const msg of messageVariations) {
        contextManager.addMessage(sessionId, msg);
      }

      const context = contextManager.getContext(sessionId);
      expect(context?.messages.length).toBe(messageVariations.length);

      contextManager.deleteContext(sessionId);
    });
  });
});

describe('Audit Logger Comprehensive Tests', () => {
  describe('Event Logging Operations', () => {
    it('should log all event categories and severities', async () => {
      const { AuditLogger } = await import('../../audit/audit-logger');

      const logger = new AuditLogger({ enabled: true });

      const categories = ['system', 'authentication', 'authorization', 'data', 'configuration', 'security'] as const;
      const severities = ['low', 'medium', 'high', 'critical'] as const;
      const actions = ['create', 'read', 'update', 'delete', 'login', 'logout', 'access_denied', 'error'];

      // Log events for all combinations
      for (const category of categories) {
        for (const severity of severities) {
          for (const action of actions) {
            logger.log(
              action,
              'test-resource',
              category,
              severity,
              'success',
              `user-${Math.random()}`,
              {},
              {
                category,
                severity,
                action,
                timestamp: Date.now()
              }
            );
          }
        }
      }

      // Verify events were logged
      const allEvents = logger.query({});
      expect(allEvents.length).toBeGreaterThan(0);

      const stats = logger.getStatistics();
      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.eventsByCategory).toBeDefined();
      expect(stats.eventsBySeverity).toBeDefined();
    });

    it('should log security events with various patterns', async () => {
      const { AuditLogger } = await import('../../audit/audit-logger');

      const logger = new AuditLogger({ enabled: true });

      const securityScenarios = [
        { category: 'authentication' as const, action: 'login_success', severity: 'low' as const },
        { category: 'authentication' as const, action: 'login_failed', severity: 'low' as const },
        { category: 'authentication' as const, action: 'password_reset', severity: 'medium' as const },
        { category: 'authorization' as const, action: 'access_granted', severity: 'low' as const },
        { category: 'authorization' as const, action: 'access_denied', severity: 'medium' as const },
        { category: 'authorization' as const, action: 'privilege_escalation', severity: 'high' as const },
        { category: 'security' as const, action: 'threat_detected', severity: 'critical' as const },
        { category: 'security' as const, action: 'rate_limit_exceeded', severity: 'medium' as const },
        { category: 'security' as const, action: 'invalid_token', severity: 'medium' as const }
      ];

      for (let i = 0; i < 10; i++) {
        for (const scenario of securityScenarios) {
          logger.log(
            scenario.action,
            'security-resource',
            scenario.category,
            scenario.severity,
            'success',
            `user-${i}`,
            {},
            {
              iteration: i,
              timestamp: Date.now(),
              ip: `192.168.1.${i}`
            }
          );
        }
      }

      // Query security events
      const authEvents = logger.query({ category: 'authentication' });
      expect(authEvents.length).toBeGreaterThan(0);

      const authzEvents = logger.query({ category: 'authorization' });
      expect(authzEvents.length).toBeGreaterThan(0);

      const securityEvents = logger.query({ category: 'security' });
      expect(securityEvents.length).toBeGreaterThan(0);
    });

    it('should log data access events for all operations', async () => {
      const { AuditLogger } = await import('../../audit/audit-logger');

      const logger = new AuditLogger({ enabled: true });

      const resources = ['weather-data', 'forecast-data', 'user-data', 'config-data', 'system-logs'];
      const actions: Array<'read' | 'write' | 'delete' | 'export'> = ['read', 'write', 'delete', 'export'];

      for (const resource of resources) {
        for (const action of actions) {
          for (let i = 0; i < 5; i++) {
            logger.logDataAccess(
              action,
              resource,
              'success',
              `user-${i}`,
              {
                resourceId: `${resource}-${i}`,
                resource,
                action,
                iteration: i,
                timestamp: Date.now()
              }
            );
          }
        }
      }

      // Query data access events
      const dataEvents = logger.query({ category: 'data' });
      expect(dataEvents.length).toBeGreaterThan(0);

      const stats = logger.getStatistics();
      expect(stats.eventsByCategory.data).toBeGreaterThan(0);
    });

    it('should query events with various filters', async () => {
      const { AuditLogger } = await import('../../audit/audit-logger');

      const logger = new AuditLogger({ enabled: true });

      // Log diverse events
      for (let i = 0; i < 50; i++) {
        logger.log(
          i % 3 === 0 ? 'create' : 'read',
          'test-resource',
          i % 2 === 0 ? 'system' : 'authentication',
          i % 5 === 0 ? 'high' : 'low',
          'success',
          `user-${i % 10}`,
          {},
          { index: i }
        );
      }

      // Query with different filters
      const systemEvents = logger.query({ category: 'system' });
      expect(systemEvents.length).toBeGreaterThan(0);

      const authEvents = logger.query({ category: 'authentication' });
      expect(authEvents.length).toBeGreaterThan(0);

      const limitedEvents = logger.query({ limit: 10 });
      expect(limitedEvents.length).toBeLessThanOrEqual(10);

      const userEvents = logger.query({ userId: 'user-1' });
      expect(Array.isArray(userEvents)).toBe(true);
    });

    it('should export events in all formats', async () => {
      const { AuditLogger } = await import('../../audit/audit-logger');

      const logger = new AuditLogger({ enabled: true });

      // Log some events
      for (let i = 0; i < 20; i++) {
        logger.log(
          'test',
          'test-resource',
          'system',
          'low',
          'success',
          `user-${i}`,
          {},
          { test: true, index: i }
        );
      }

      // Export in all formats
      const jsonExport = logger.export({}, 'json');
      expect(typeof jsonExport).toBe('string');
      expect(jsonExport.length).toBeGreaterThan(0);

      const csvExport = logger.export({}, 'csv');
      expect(typeof csvExport).toBe('string');
      expect(csvExport.length).toBeGreaterThan(0);

      const xmlExport = logger.export({}, 'xml');
      expect(typeof xmlExport).toBe('string');
      expect(xmlExport.length).toBeGreaterThan(0);

      // Export with filters
      const filteredJson = logger.export({ limit: 5 }, 'json');
      expect(typeof filteredJson).toBe('string');

      const filteredCsv = logger.export({ category: 'system' }, 'csv');
      expect(typeof filteredCsv).toBe('string');

      const filteredXml = logger.export({ userId: 'user-1' }, 'xml');
      expect(typeof filteredXml).toBe('string');
    });

    it('should handle statistics generation', async () => {
      const { AuditLogger } = await import('../../audit/audit-logger');

      const logger = new AuditLogger({ enabled: true });

      // Generate diverse events for stats
      const categories = ['system', 'authentication', 'data', 'security'] as const;
      const severities = ['low', 'medium', 'high', 'critical'] as const;

      for (let i = 0; i < 100; i++) {
        logger.log(
          `action-${i % 10}`,
          'test-resource',
          categories[i % categories.length],
          severities[i % severities.length],
          'success',
          `user-${i % 20}`,
          {},
          { index: i }
        );
      }

      // Get comprehensive stats
      const stats = logger.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalEvents).toBeGreaterThanOrEqual(100);
      expect(stats.eventsByCategory).toBeDefined();
      expect(stats.eventsBySeverity).toBeDefined();
      expect(stats.eventsByAction).toBeDefined();
      expect(stats.uniqueUsers).toBeDefined();

      // Verify category stats
      expect(stats.eventsByCategory.system).toBeGreaterThan(0);
      expect(stats.eventsByCategory.authentication).toBeGreaterThan(0);
      expect(stats.eventsByCategory.data).toBeGreaterThan(0);
      expect(stats.eventsByCategory.security).toBeGreaterThan(0);

      // Verify severity stats
      expect(stats.eventsBySeverity.low).toBeGreaterThan(0);
      expect(stats.eventsBySeverity.medium).toBeGreaterThan(0);
      expect(stats.eventsBySeverity.high).toBeGreaterThan(0);
      expect(stats.eventsBySeverity.critical).toBeGreaterThan(0);
    });

    it('should handle edge cases in logging', async () => {
      const { AuditLogger } = await import('../../audit/audit-logger');

      const logger = new AuditLogger({ enabled: true });

      // Log with minimal data
      logger.log(
        'test',
        'test-resource',
        'system',
        'low',
        'success',
        'test',
        {},
        {}
      );

      // Log with maximum data
      logger.log(
        'complex-test',
        'test-resource',
        'system',
        'critical',
        'success',
        'complex-user',
        {},
        {
          nested: {
            deeply: {
              nested: {
                data: 'value',
                array: [1, 2, 3],
                object: { key: 'value' }
              }
            }
          },
          largeString: 'x'.repeat(1000)
        }
      );

      // Log with special characters
      logger.log(
        'special-chars',
        'test-resource',
        'system',
        'low',
        'success',
        'user-!@#$%^&*()',
        {},
        {
          specialChars: '!@#$%^&*()',
          unicode: '你好世界🌍',
          newlines: 'line1\nline2\nline3'
        }
      );

      const stats = logger.getStatistics();
      expect(stats.totalEvents).toBeGreaterThanOrEqual(3);
    });
  });
});
