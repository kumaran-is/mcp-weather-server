/**
 * Targeted tests for context-manager and audit-logger to boost coverage
 * Focus: Exercise core functionality without complex mocking
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Context Manager Targeted Coverage Tests', () => {
  describe('Context Manager Instance', () => {
    it('should import context manager', async () => {
      const { contextManager, ContextManager } = await import('../../context/context-manager');

      expect(ContextManager).toBeDefined();
      expect(contextManager).toBeDefined();
      expect(contextManager.createContext).toBeDefined();
      expect(contextManager.getContext).toBeDefined();
      expect(contextManager.deleteContext).toBeDefined();
    });

    it('should create and retrieve context', async () => {
      const { contextManager } = await import('../../context/context-manager');

      const sessionId = 'test-session-' + Date.now();
      const context = contextManager.createContext(sessionId);

      expect(context).toBeDefined();
      expect(context.sessionId).toBe(sessionId);
      expect(context.messages).toBeDefined();
      expect(Array.isArray(context.messages)).toBe(true);
    });

    it('should get existing context', async () => {
      const { contextManager } = await import('../../context/context-manager');

      const sessionId = 'test-session-get-' + Date.now();
      contextManager.createContext(sessionId);

      const retrieved = contextManager.getContext(sessionId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(sessionId);
    });

    it('should delete context', async () => {
      const { contextManager } = await import('../../context/context-manager');

      const sessionId = 'test-session-delete-' + Date.now();
      contextManager.createContext(sessionId);

      contextManager.deleteContext(sessionId);
      const retrieved = contextManager.getContext(sessionId);
      expect(retrieved).toBeUndefined();
    });

    it('should add messages to context', async () => {
      const { contextManager } = await import('../../context/context-manager');

      const sessionId = 'test-session-messages-' + Date.now();
      const context = contextManager.createContext(sessionId);

      contextManager.addMessage(sessionId, {
        role: 'user',
        content: 'Test message'
      });

      const updated = contextManager.getContext(sessionId);
      expect(updated?.messages).toHaveLength(1);
      expect(updated?.messages[0].content).toBe('Test message');
    });

    it('should clear context', async () => {
      const { contextManager } = await import('../../context/context-manager');

      const sessionId = 'test-session-clear-' + Date.now();
      const context = contextManager.createContext(sessionId);

      contextManager.addMessage(sessionId, {
        role: 'user',
        content: 'Message 1'
      });

      contextManager.clearContext(sessionId);
      const updated = contextManager.getContext(sessionId);
      expect(updated?.messages).toHaveLength(0);
    });

    it('should get all context IDs', async () => {
      const { contextManager } = await import('../../context/context-manager');

      const sessionId1 = 'test-all-1-' + Date.now();
      const sessionId2 = 'test-all-2-' + Date.now();

      contextManager.createContext(sessionId1);
      contextManager.createContext(sessionId2);

      const ids = contextManager.getAllContextIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids).toContain(sessionId1);
      expect(ids).toContain(sessionId2);
    });

    it('should get context stats', async () => {
      const { contextManager } = await import('../../context/context-manager');

      const sessionId = 'test-stats-' + Date.now();
      contextManager.createContext(sessionId);

      contextManager.addMessage(sessionId, {
        role: 'user',
        content: 'Test message for stats'
      });

      const stats = contextManager.getStats(sessionId);
      expect(stats).toBeDefined();
      expect(stats?.messageCount).toBeGreaterThan(0);
    });
  });
});

describe('Audit Logger Targeted Coverage Tests', () => {
  describe('Audit Logger Instance', () => {
    it('should import audit logger', async () => {
      const { AuditLogger } = await import('../../audit/audit-logger');

      expect(AuditLogger).toBeDefined();

      const logger = new AuditLogger();
      expect(logger).toBeDefined();
      expect(logger.logEvent).toBeDefined();
      expect(logger.logSecurityEvent).toBeDefined();
      expect(logger.logDataAccess).toBeDefined();
    });

    it('should log audit events', async () => {
      const { AuditLogger } = await import('../../audit/audit-logger');

      const logger = new AuditLogger();

      expect(() => {
        logger.logEvent({
          category: 'system',
          action: 'startup',
          severity: 'info',
          userId: 'system',
          metadata: { version: '1.0.0' }
        });
      }).not.toThrow();
    });

    it('should log security events', async () => {
      const { AuditLogger } = await import('../../audit/audit-logger');

      const logger = new AuditLogger();

      expect(() => {
        logger.logSecurityEvent({
          category: 'authentication',
          action: 'login',
          severity: 'info',
          userId: 'test-user',
          metadata: { ip: '127.0.0.1' }
        });
      }).not.toThrow();
    });

    it('should log data access events', async () => {
      const { AuditLogger } = await import('../../audit/audit-logger');

      const logger = new AuditLogger();

      expect(() => {
        logger.logDataAccess({
          userId: 'test-user',
          action: 'read',
          resource: 'weather-data',
          resourceId: 'london',
          metadata: {}
        });
      }).not.toThrow();
    });

    it('should get audit statistics', async () => {
      const { AuditLogger } = await import('../../audit/audit-logger');

      const logger = new AuditLogger();

      logger.logEvent({
        category: 'system',
        action: 'test',
        severity: 'info',
        userId: 'test',
        metadata: {}
      });

      const stats = logger.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalEvents).toBeDefined();
      expect(typeof stats.totalEvents).toBe('number');
    });

    it('should query events', async () => {
      const { AuditLogger } = await import('../../audit/audit-logger');

      const logger = new AuditLogger();

      logger.logEvent({
        category: 'system',
        action: 'query-test',
        severity: 'info',
        userId: 'test-user',
        metadata: {}
      });

      const events = logger.query({
        category: 'system',
        limit: 10
      });

      expect(Array.isArray(events)).toBe(true);
    });

    it('should export events', async () => {
      const { AuditLogger } = await import('../../audit/audit-logger');

      const logger = new AuditLogger();

      logger.logEvent({
        category: 'system',
        action: 'export-test',
        severity: 'info',
        userId: 'test',
        metadata: {}
      });

      const exported = logger.export({}, 'json');
      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
    });
  });
});
