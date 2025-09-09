/**
 * Comprehensive tests for resilience patterns
 * Tests circuit breaker, bulkhead, rate limiter, and retry strategies
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '../resilience/circuit-breaker.js';
import { Bulkhead } from '../resilience/bulkhead.js';
import { RateLimiter, TokenBucketRateLimiter } from '../resilience/rate-limiter.js';
import { RetryStrategy } from '../resilience/retry-strategy.js';

// Mock logger to avoid console output during tests
vi.mock('../../logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Circuit Breaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker('test-circuit', 3, 5000);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should start in CLOSED state', () => {
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    expect(circuitBreaker.isHealthy()).toBe(true);
  });

  it('should remain CLOSED after successful operations', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');

    await circuitBreaker.execute(mockFn);
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should open after failure threshold is reached', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));

    // First two failures
    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Test error');
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Test error');
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

    // Third failure should open the circuit
    await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Test error');
    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
  });

  it('should reject requests when OPEN', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(mockFn);
      } catch (error) {
        // Expected
      }
    }

    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

    // Should reject without calling the function
    await expect(circuitBreaker.execute(vi.fn())).rejects.toThrow('Circuit breaker');
    expect(mockFn).toHaveBeenCalledTimes(3); // Only the original 3 calls
  });

  it('should transition to HALF_OPEN after recovery timeout', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(mockFn);
      } catch (error) {
        // Expected
      }
    }

    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

    // Fast-forward time
    vi.advanceTimersByTime(5000);

    // Next request should transition to HALF_OPEN
    const successFn = vi.fn().mockResolvedValue('success');
    const result = await circuitBreaker.execute(successFn);
    expect(result).toBe('success');
    expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should get correct statistics', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');

    await circuitBreaker.execute(mockFn);

    const stats = circuitBreaker.getStats();
    expect(stats.successes).toBe(1);
    expect(stats.failures).toBe(0);
    expect(stats.state).toBe(CircuitState.CLOSED);
  });
});

describe('Bulkhead', () => {
  let bulkhead: Bulkhead;

  beforeEach(() => {
    bulkhead = new Bulkhead('test-bulkhead', {
      maxConcurrent: 2,
      maxQueueSize: 3,
      queueTimeout: 1000,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should execute operations within concurrency limit', async () => {
    const mockFn = vi.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(() => resolve('success'), 100));
    });

    const promises = [
      bulkhead.execute(mockFn),
      bulkhead.execute(mockFn),
    ];

    const results = await Promise.all(promises);
    expect(results).toEqual(['success', 'success']);
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should queue operations when at concurrency limit', async () => {
    const mockFn = vi.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(() => resolve('success'), 200));
    });

    // Start two operations (at limit)
    const promise1 = bulkhead.execute(mockFn);
    const promise2 = bulkhead.execute(mockFn);

    // Queue a third operation
    const promise3 = bulkhead.execute(mockFn);

    // Advance time to complete first operation
    vi.advanceTimersByTime(100);

    // Wait for first operation to complete and third to start
    await Promise.resolve();
    vi.advanceTimersByTime(100);

    const results = await Promise.all([promise1, promise2, promise3]);
    expect(results).toEqual(['success', 'success', 'success']);
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should reject when queue is full', async () => {
    const slowFn = vi.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(() => resolve('success'), 1000));
    });

    // Fill concurrency limit
    const promise1 = bulkhead.execute(slowFn);
    const promise2 = bulkhead.execute(slowFn);

    // Fill queue
    const promise3 = bulkhead.execute(slowFn);
    const promise4 = bulkhead.execute(slowFn);
    const promise5 = bulkhead.execute(slowFn);

    // This should be rejected (queue full)
    await expect(bulkhead.execute(slowFn)).rejects.toThrow('queue is full');

    expect(slowFn).toHaveBeenCalledTimes(5);
  });

  it('should timeout queued operations', async () => {
    const slowFn = vi.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(() => resolve('success'), 500));
    });

    // Fill concurrency limit
    bulkhead.execute(slowFn);
    bulkhead.execute(slowFn);

    // Queue operation that will timeout
    const queuedPromise = bulkhead.execute(slowFn);

    // Advance time past queue timeout
    vi.advanceTimersByTime(1000);

    await expect(queuedPromise).rejects.toThrow('timed out in queue');
  });

  it('should get correct statistics', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');

    await bulkhead.execute(mockFn);

    const stats = bulkhead.getStats();
    expect(stats.totalOperations).toBe(1);
    expect(stats.activeOperations).toBe(0);
    expect(stats.queuedOperations).toBe(0);
  });

  it('should handle operation failures', async () => {
    const failingFn = vi.fn().mockRejectedValue(new Error('Operation failed'));

    await expect(bulkhead.execute(failingFn)).rejects.toThrow('Operation failed');

    const stats = bulkhead.getStats();
    expect(stats.totalOperations).toBe(1);
    expect(stats.activeOperations).toBe(0);
  });
});

describe('Rate Limiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter('test-limiter', {
      requests: 2,
      windowMs: 1000,
      burst: 1,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should allow requests within limit', () => {
    expect(rateLimiter.canMakeRequest()).toBe(true);
    rateLimiter.recordRequest();

    expect(rateLimiter.canMakeRequest()).toBe(true);
    rateLimiter.recordRequest();

    expect(rateLimiter.canMakeRequest()).toBe(true);
    rateLimiter.recordRequest();

    // Should be at burst limit now
    expect(rateLimiter.canMakeRequest()).toBe(false);
  });

  it('should reset after window expires', () => {
    // Use up the limit
    for (let i = 0; i < 3; i++) {
      rateLimiter.recordRequest();
    }

    expect(rateLimiter.canMakeRequest()).toBe(false);

    // Advance time past window
    vi.advanceTimersByTime(1000);

    expect(rateLimiter.canMakeRequest()).toBe(true);
  });

  it('should wait for slot when rate limited', async () => {
    // Use up the limit
    for (let i = 0; i < 3; i++) {
      rateLimiter.recordRequest();
    }

    const mockFn = vi.fn().mockResolvedValue('success');

    // This should wait and then execute
    const promise = rateLimiter.execute(mockFn);
    expect(mockFn).not.toHaveBeenCalled();

    // Advance time to make slot available
    vi.advanceTimersByTime(1000);

    const result = await promise;
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should get correct statistics', () => {
    rateLimiter.recordRequest();
    rateLimiter.recordRequest();

    const stats = rateLimiter.getStats();
    expect(stats.totalAllowed).toBe(2);
    expect(stats.currentRequests).toBe(2);
    expect(stats.remainingRequests).toBe(1);
  });
});

describe('Token Bucket Rate Limiter', () => {
  let tokenBucket: TokenBucketRateLimiter;

  beforeEach(() => {
    tokenBucket = new TokenBucketRateLimiter('test-bucket', 10, 2); // 10 tokens, 2 per second
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should allow consuming tokens within capacity', () => {
    expect(tokenBucket.tryConsume()).toBe(true);
    expect(tokenBucket.tryConsume()).toBe(true);

    const stats = tokenBucket.getStats();
    expect(stats.tokens).toBe(8);
    expect(stats.totalAllowed).toBe(2);
  });

  it('should reject when out of tokens', () => {
    // Consume all tokens
    for (let i = 0; i < 10; i++) {
      tokenBucket.tryConsume();
    }

    expect(tokenBucket.tryConsume()).toBe(false);

    const stats = tokenBucket.getStats();
    expect(stats.tokens).toBe(0);
    expect(stats.totalRejected).toBe(1);
  });

  it('should refill tokens over time', () => {
    // Consume all tokens
    for (let i = 0; i < 10; i++) {
      tokenBucket.tryConsume();
    }

    expect(tokenBucket.tryConsume()).toBe(false);

    // Advance time by 3 seconds (should add 6 tokens)
    vi.advanceTimersByTime(3000);

    expect(tokenBucket.tryConsume()).toBe(true);
    expect(tokenBucket.tryConsume()).toBe(true);

    const stats = tokenBucket.getStats();
    expect(stats.tokens).toBe(4); // 10 - 2 initial + 6 refill - 2 consumed = 12, capped at 10
  });

  it('should wait for token when consuming', async () => {
    // Consume all tokens
    for (let i = 0; i < 10; i++) {
      tokenBucket.tryConsume();
    }

    const mockFn = vi.fn().mockResolvedValue('success');

    // This should wait for token refill
    const promise = tokenBucket.execute(mockFn);

    // Advance time for token refill (0.5 seconds for 1 token at 2/sec)
    vi.advanceTimersByTime(500);

    const result = await promise;
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});

describe('Retry Strategy', () => {
  let retryStrategy: RetryStrategy;

  beforeEach(() => {
    retryStrategy = new RetryStrategy({
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 1000,
      jitterFactor: 0.1,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');

    const result = await retryStrategy.execute(mockFn);
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const mockFn = vi.fn()
      .mockRejectedValueOnce(new Error('Attempt 1 failed'))
      .mockRejectedValueOnce(new Error('Attempt 2 failed'))
      .mockResolvedValueOnce('success');

    const result = await retryStrategy.execute(mockFn);
    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should fail after max retries', async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('Persistent failure'));

    await expect(retryStrategy.execute(mockFn)).rejects.toThrow('Persistent failure');
    expect(mockFn).toHaveBeenCalledTimes(4); // Initial + 3 retries
  });

  it('should respect max delay cap', async () => {
    const highRetryStrategy = new RetryStrategy({
      maxRetries: 10,
      baseDelay: 1000,
      maxDelay: 2000,
      jitterFactor: 0.1,
    });

    const mockFn = vi.fn().mockRejectedValue(new Error('Failure'));

    const startTime = Date.now();
    await expect(highRetryStrategy.execute(mockFn)).rejects.toThrow();

    // Should not take excessively long due to max delay cap
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(10000); // Should be much less than naive exponential backoff
  });

  it('should apply jitter to delay', async () => {
    // Test that delays are not exactly exponential (due to jitter)
    const delays: number[] = [];
    let attemptCount = 0;

    const mockFn = vi.fn().mockImplementation(() => {
      attemptCount++;
      if (attemptCount < 4) {
        // Record the delay before failing
        const start = Date.now();
        return new Promise((_, reject) => {
          setTimeout(() => {
            delays.push(Date.now() - start);
            reject(new Error(`Attempt ${attemptCount} failed`));
          }, 100 * Math.pow(2, attemptCount - 1));
        });
      }
      return Promise.resolve('success');
    });

    await retryStrategy.execute(mockFn);

    // Should have some variation in delays due to jitter
    expect(delays.length).toBe(3);
    // The delays should not be exactly 100, 200, 400 due to jitter
    expect(delays[0]).not.toBe(100);
    expect(delays[1]).not.toBe(200);
    expect(delays[2]).not.toBe(400);
  });
});

describe('Integration Tests', () => {
  it('should handle complex failure scenarios', async () => {
    // Test circuit breaker + retry + bulkhead working together
    const circuitBreaker = new CircuitBreaker('integration-test', 2, 1000);
    const bulkhead = new Bulkhead('integration-bulkhead', {
      maxConcurrent: 1,
      maxQueueSize: 2,
      queueTimeout: 500,
    });

    let failureCount = 0;
    const unreliableFn = vi.fn().mockImplementation(() => {
      failureCount++;
      if (failureCount < 3) {
        return Promise.reject(new Error('Temporary failure'));
      }
      return Promise.resolve('success');
    });

    // This should eventually succeed through retries
    const resilientFn = async () => {
      return await bulkhead.execute(async () => {
        return await circuitBreaker.execute(unreliableFn);
      });
    };

    const result = await resilientFn();
    expect(result).toBe('success');
    expect(unreliableFn).toHaveBeenCalledTimes(3); // 2 failures + 1 success
  });

  it('should handle rate limiting with circuit breaker', async () => {
    const rateLimiter = new RateLimiter('integration-rate-limiter', {
      requests: 1,
      windowMs: 1000,
    });
    const circuitBreaker = new CircuitBreaker('integration-circuit', 3, 1000);

    const mockFn = vi.fn().mockRejectedValue(new Error('Rate limited'));

    // Simulate rate limiting triggering circuit breaker
    for (let i = 0; i < 3; i++) {
      try {
        await rateLimiter.execute(async () => {
          return await circuitBreaker.execute(mockFn);
        });
      } catch (error) {
        // Expected failures
      }
    }

    expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    expect(mockFn).toHaveBeenCalledTimes(3);
  });
});
