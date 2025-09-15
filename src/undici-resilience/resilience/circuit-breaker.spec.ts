import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    circuitBreaker = new CircuitBreaker({
      threshold: 3,
      timeout: 10000,
      errorThresholdPercentage: 50
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Constructor', () => {
    it('should create circuit breaker with default config', () => {
      const cb = new CircuitBreaker();
      expect(cb).toBeInstanceOf(CircuitBreaker);
      expect(cb['state']).toBe('closed');
    });

    it('should create circuit breaker with custom config', () => {
      const cb = new CircuitBreaker({
        threshold: 5,
        timeout: 20000,
        errorThresholdPercentage: 60
      });
      expect(cb).toBeInstanceOf(CircuitBreaker);
      expect(cb['threshold']).toBe(5);
      expect(cb['timeout']).toBe(20000);
      expect(cb['errorThresholdPercentage']).toBe(60);
    });
  });

  describe('State management', () => {
    it('should start in closed state', () => {
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('should allow requests in closed state', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
    });

    it('should open after threshold failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected to fail
        }
      }
      
      expect(circuitBreaker.getState()).toBe('open');
    });

    it('should reject requests when open', async () => {
      // Force open state
      circuitBreaker['state'] = 'open';
      circuitBreaker['nextAttempt'] = Date.now() + 10000;
      
      const fn = vi.fn().mockResolvedValue('success');
      
      await expect(circuitBreaker.execute(fn))
        .rejects.toThrow('Circuit breaker is OPEN');
      
      expect(fn).not.toHaveBeenCalled();
    });

    it('should transition to half-open after timeout', async () => {
      // Force open state
      circuitBreaker['state'] = 'open';
      circuitBreaker['nextAttempt'] = Date.now() + 10000;
      
      // Advance time past timeout
      vi.advanceTimersByTime(11000);
      
      const fn = vi.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(fn);
      
      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('should close from half-open on success', async () => {
      circuitBreaker['state'] = 'half-open';
      
      const fn = vi.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(fn);
      
      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('should reopen from half-open on failure', async () => {
      circuitBreaker['state'] = 'half-open';
      
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      
      try {
        await circuitBreaker.execute(fn);
      } catch (e) {
        // Expected to fail
      }
      
      expect(circuitBreaker.getState()).toBe('open');
    });
  });

  describe('Error threshold percentage', () => {
    it('should calculate error percentage correctly', () => {
      circuitBreaker['successCount'] = 5;
      circuitBreaker['failureCount'] = 5;
      
      const percentage = circuitBreaker['getErrorPercentage']();
      expect(percentage).toBe(50);
    });

    it('should not open if below error threshold', async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success')
        .mockResolvedValueOnce('success');
      
      // 1 failure out of 4 = 25% < 50% threshold
      for (let i = 0; i < 4; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Ignore failures
        }
      }
      
      expect(circuitBreaker.getState()).toBe('closed');
    });
  });

  describe('Metrics', () => {
    it('should track success count', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      await circuitBreaker.execute(fn);
      await circuitBreaker.execute(fn);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successCount).toBe(2);
    });

    it('should track failure count', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(2);
    });

    it('should provide comprehensive metrics', () => {
      circuitBreaker['successCount'] = 10;
      circuitBreaker['failureCount'] = 5;
      circuitBreaker['state'] = 'open';
      
      const metrics = circuitBreaker.getMetrics();
      
      expect(metrics).toEqual({
        state: 'open',
        successCount: 10,
        failureCount: 5,
        errorPercentage: 33.33,
        nextAttempt: expect.any(Number)
      });
    });
  });

  describe('Reset functionality', () => {
    it('should reset all counters and state', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      
      // Generate some failures
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }
      
      expect(circuitBreaker.getState()).toBe('open');
      
      circuitBreaker.reset();
      
      expect(circuitBreaker.getState()).toBe('closed');
      expect(circuitBreaker.getMetrics().successCount).toBe(0);
      expect(circuitBreaker.getMetrics().failureCount).toBe(0);
    });
  });

  describe('Force state changes', () => {
    it('should force open state', () => {
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getState()).toBe('open');
    });

    it('should force closed state', () => {
      circuitBreaker['state'] = 'open';
      circuitBreaker.forceClosed();
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('should force half-open state', () => {
      circuitBreaker.forceHalfOpen();
      expect(circuitBreaker.getState()).toBe('half-open');
    });
  });

  describe('Async function execution', () => {
    it('should handle async functions correctly', async () => {
      const fn = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('delayed'), 100))
      );
      
      vi.useRealTimers(); // Use real timers for async
      const result = await circuitBreaker.execute(fn);
      
      expect(result).toBe('delayed');
      expect(fn).toHaveBeenCalled();
    });

    it('should handle sync functions wrapped in promise', async () => {
      const fn = vi.fn().mockImplementation(() => 'sync-result');
      
      const result = await circuitBreaker.execute(fn);
      
      expect(result).toBe('sync-result');
      expect(fn).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should propagate errors from failed executions', async () => {
      const error = new Error('Custom error');
      const fn = vi.fn().mockRejectedValue(error);
      
      await expect(circuitBreaker.execute(fn)).rejects.toThrow('Custom error');
    });

    it('should handle different error types', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new TypeError('Type error'))
        .mockRejectedValueOnce(new RangeError('Range error'))
        .mockRejectedValueOnce('String error');
      
      await expect(circuitBreaker.execute(fn)).rejects.toThrow('Type error');
      await expect(circuitBreaker.execute(fn)).rejects.toThrow('Range error');
      await expect(circuitBreaker.execute(fn)).rejects.toBe('String error');
    });
  });

  describe('Timeout behavior', () => {
    it('should use custom timeout value', () => {
      const cb = new CircuitBreaker({ timeout: 30000 });
      cb['state'] = 'open';
      cb['nextAttempt'] = Date.now() + 30000;
      
      vi.advanceTimersByTime(29000);
      expect(cb.getState()).toBe('open');
      
      vi.advanceTimersByTime(2000);
      // Should now allow retry
      const fn = vi.fn().mockResolvedValue('success');
      cb.execute(fn);
      expect(cb.getState()).toBe('half-open');
    });
  });

  describe('Consecutive failures', () => {
    it('should track consecutive failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }
      
      expect(circuitBreaker['consecutiveFailures']).toBe(3); // Opens at 3
    });

    it('should reset consecutive failures on success', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');
      
      try {
        await circuitBreaker.execute(fn);
      } catch (e) {
        // Expected
      }
      
      try {
        await circuitBreaker.execute(fn);
      } catch (e) {
        // Expected
      }
      
      await circuitBreaker.execute(fn);
      
      expect(circuitBreaker['consecutiveFailures']).toBe(0);
    });
  });
});