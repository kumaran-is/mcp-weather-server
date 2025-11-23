import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState } from './circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    circuitBreaker = new CircuitBreaker('test-service', 3, 10000, 5000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Constructor', () => {
    it('should create circuit breaker with valid config', () => {
      const cb = new CircuitBreaker('service', 3, 10000);
      expect(cb).toBeInstanceOf(CircuitBreaker);
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it('should throw error for invalid failure threshold', () => {
      expect(() => new CircuitBreaker('service', 0, 10000)).toThrow(
        'Failure threshold must be at least 1'
      );
    });

    it('should throw error for invalid recovery timeout', () => {
      expect(() => new CircuitBreaker('service', 3, 500)).toThrow(
        'Recovery timeout must be at least 1000ms'
      );
    });
  });

  describe('State management', () => {
    it('should start in closed state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
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

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should block requests when open', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Cause circuit to open
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Next request should be blocked
      await expect(circuitBreaker.execute(fn)).rejects.toThrow(
        "Circuit breaker 'test-service' is OPEN"
      );
    });

    it('should transition to half-open after timeout', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Cause circuit to open
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Advance time past recovery timeout
      vi.advanceTimersByTime(11000);

      // Should now allow retry and transition to half-open
      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn);

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should close on successful half-open request', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));

      // Cause circuit to open
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failFn);
        } catch (e) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Advance time to allow half-open transition
      vi.advanceTimersByTime(11000);

      // Success should close the circuit
      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn);

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should re-open on failed half-open request', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Cause circuit to open
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Advance time to allow half-open transition
      vi.advanceTimersByTime(11000);

      // Failure in half-open should re-open
      try {
        await circuitBreaker.execute(fn);
      } catch (e) {
        // Expected
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Statistics', () => {
    it('should track successful requests', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      await circuitBreaker.execute(fn);
      await circuitBreaker.execute(fn);

      const stats = circuitBreaker.getStats();
      expect(stats.successes).toBe(2);
    });

    it('should track failed requests', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

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

      const stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(2);
    });

    it('should track last failure time', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await circuitBreaker.execute(fn);
      } catch (e) {
        // Expected
      }

      const stats = circuitBreaker.getStats();
      expect(stats.lastFailureTime).toBeTruthy();
    });

    it('should track last success time', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      await circuitBreaker.execute(fn);

      const stats = circuitBreaker.getStats();
      expect(stats.lastSuccessTime).toBeTruthy();
    });
  });

  describe('Manual control', () => {
    it('should force open', () => {
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should force close', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Cause circuit to open
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      circuitBreaker.forceClose();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('getName', () => {
    it('should return circuit breaker name', () => {
      expect(circuitBreaker.getName()).toBe('test-service');
    });
  });

  describe('isHealthy', () => {
    it('should return true when closed', () => {
      expect(circuitBreaker.isHealthy()).toBe(true);
    });

    it('should return false when open', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Cause circuit to open
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }

      expect(circuitBreaker.isHealthy()).toBe(false);
    });

    it('should return true when half-open with successes', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));

      // Cause circuit to open
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failFn);
        } catch (e) {
          // Expected
        }
      }

      // Advance time to allow half-open
      vi.advanceTimersByTime(11000);

      // Execute to transition to half-open and succeed
      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn);

      // After success, it closes and should be healthy
      expect(circuitBreaker.isHealthy()).toBe(true);
    });
  });

  describe('Consecutive failures', () => {
    it('should track consecutive failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }

      // After 3 failures, circuit should be open
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(circuitBreaker['consecutiveFailures']).toBe(3);
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

  describe('Recovery timeout', () => {
    it('should calculate next attempt time', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      const startTime = Date.now();

      // Cause circuit to open
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }

      const stats = circuitBreaker.getStats();
      expect(stats.nextAttemptTime).toBe(startTime + 10000);
    });

    it('should not allow requests before recovery timeout', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Cause circuit to open
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Try to execute before timeout
      vi.advanceTimersByTime(5000);
      await expect(circuitBreaker.execute(fn)).rejects.toThrow();
    });

    it('should allow retry after recovery timeout', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Cause circuit to open
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }

      vi.advanceTimersByTime(11000);

      // Should now allow retry
      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });
});
