# 🛡️ MCP Server Resilience Patterns - Complete Implementation Guide

**Version**: 1.0.0
**Last Updated**: 2025-01-23
**Target**: AI Code Assistants (Claude Code, Cline, etc.)
**Companion To**: mcp-code-generator-v3.md

---

## 📋 Overview

This guide provides **complete, production-ready implementations** of enterprise resilience patterns for MCP servers using Undici HTTP client. These patterns ensure your MCP server remains stable, performant, and fault-tolerant under real-world conditions.

### Core Resilience Stack

```
User Request
    ↓
Rate Limiter (prevent overload)
    ↓
Bulkhead (resource isolation)
    ↓
Circuit Breaker (failure detection)
    ↓
Retry Strategy (transient fault handling)
    ↓
Connection Pool (optimized HTTP)
    ↓
External API
```

---

## 🎯 Pattern 1: Connection Pool Manager

**Purpose**: Optimize HTTP connections, reduce latency, manage resources

### Complete Implementation

```typescript
// src/undici-resilience/http/pool-manager.ts

import { Pool, request, Client } from 'undici';
import type { Dispatcher } from 'undici';
import pino from 'pino';
import type { PoolConfig } from '../config/pool-config.js';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string | Buffer | Uint8Array;
  query?: Record<string, string>;
  signal?: AbortSignal;
}

export interface PoolStats {
  poolName: string;
  connected: number;
  free: number;
  pending: number;
  queued: number;
  running: number;
  size: number;
}

export class PoolManager {
  private pools: Map<string, Pool>;
  private logger: pino.Logger;
  private config: PoolConfig;
  private healthCheckIntervals: Map<string, NodeJS.Timeout>;

  constructor(config: PoolConfig, logger: pino.Logger) {
    this.pools = new Map();
    this.logger = logger;
    this.config = config;
    this.healthCheckIntervals = new Map();
  }

  /**
   * Get or create a connection pool for a base URL
   */
  getPool(baseUrl: string): Pool {
    const existing = this.pools.get(baseUrl);
    if (existing) {
      return existing;
    }

    const pool = new Pool(baseUrl, {
      connections: this.config.connections,
      pipelining: this.config.pipelining,
      keepAliveTimeout: this.config.keepAliveTimeout,
      keepAliveMaxTimeout: this.config.keepAliveMaxTimeout,
      bodyTimeout: this.config.bodyTimeout,
      headersTimeout: this.config.headersTimeout,
      maxCachedSessions: this.config.maxCachedSessions,
      connect: {
        timeout: this.config.connectTimeout,
        rejectUnauthorized: true,
      },
    });

    this.pools.set(baseUrl, pool);

    // Start health checks if enabled
    if (this.config.healthCheckInterval > 0) {
      this.startHealthCheck(baseUrl, pool);
    }

    this.logger.info({ baseUrl, config: this.config }, 'Created new connection pool');

    return pool;
  }

  /**
   * Make HTTP request with connection pooling
   */
  async request<T = any>(
    url: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const { origin, pathname, search } = new URL(url);
    const pool = this.getPool(origin);

    const queryString = options.query
      ? '?' + new URLSearchParams(options.query).toString()
      : search;

    const requestOptions: Dispatcher.RequestOptions = {
      path: pathname + queryString,
      method: options.method || 'GET',
      headers: {
        'user-agent': 'MCP-Weather-Server/1.0',
        'accept': 'application/json',
        ...options.headers,
      },
      body: options.body,
      signal: options.signal,
      bodyTimeout: this.config.bodyTimeout,
      headersTimeout: this.config.headersTimeout,
    };

    const startTime = Date.now();

    try {
      const response = await pool.request(requestOptions);

      const duration = Date.now() - startTime;

      this.logger.debug({
        url,
        method: options.method || 'GET',
        statusCode: response.statusCode,
        duration,
      }, 'HTTP request completed');

      if (response.statusCode >= 400) {
        const errorBody = await response.body.text();
        throw new Error(
          `HTTP ${response.statusCode}: ${errorBody.substring(0, 200)}`,
        );
      }

      const contentType = response.headers['content-type'] as string || '';

      if (contentType.includes('application/json')) {
        const text = await response.body.text();
        return JSON.parse(text) as T;
      }

      return await response.body.text() as T;

    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error({
        url,
        method: options.method || 'GET',
        duration,
        error: error instanceof Error ? error.message : String(error),
      }, 'HTTP request failed');

      throw error;
    }
  }

  /**
   * Start health check for a pool
   */
  private startHealthCheck(baseUrl: string, pool: Pool): void {
    const interval = setInterval(() => {
      const stats = pool.stats;

      this.logger.debug({
        baseUrl,
        connected: stats.connected,
        free: stats.free,
        pending: stats.pending,
        queued: stats.queued,
        running: stats.running,
        size: stats.size,
      }, 'Pool health check');

      // Warn if pool is saturated
      if (stats.queued > this.config.connections * 0.8) {
        this.logger.warn({
          baseUrl,
          queued: stats.queued,
          connections: this.config.connections,
        }, 'Connection pool is saturated');
      }

    }, this.config.healthCheckInterval);

    this.healthCheckIntervals.set(baseUrl, interval);
  }

  /**
   * Get statistics for all pools
   */
  getPoolStats(): PoolStats[] {
    const stats: PoolStats[] = [];

    for (const [poolName, pool] of this.pools.entries()) {
      const poolStats = pool.stats;
      stats.push({
        poolName,
        connected: poolStats.connected,
        free: poolStats.free,
        pending: poolStats.pending,
        queued: poolStats.queued,
        running: poolStats.running,
        size: poolStats.size,
      });
    }

    return stats;
  }

  /**
   * Close all connection pools
   */
  async close(): Promise<void> {
    // Clear health check intervals
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();

    // Close all pools
    const closePromises = Array.from(this.pools.values()).map(pool => pool.close());
    await Promise.all(closePromises);

    this.pools.clear();

    this.logger.info('All connection pools closed');
  }

  /**
   * Destroy all connection pools (immediate, ungraceful shutdown)
   */
  async destroy(): Promise<void> {
    // Clear health check intervals
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();

    // Destroy all pools
    const destroyPromises = Array.from(this.pools.values()).map(pool => pool.destroy());
    await Promise.all(destroyPromises);

    this.pools.clear();

    this.logger.info('All connection pools destroyed');
  }
}
```

### Pool Configuration

```typescript
// src/undici-resilience/config/pool-config.ts

export interface PoolConfig {
  // Connection pool size (max concurrent connections per origin)
  connections: number;

  // HTTP pipelining (requests per connection)
  pipelining: number;

  // Timeouts (milliseconds)
  connectTimeout: number;
  bodyTimeout: number;
  headersTimeout: number;
  keepAliveTimeout: number;
  keepAliveMaxTimeout: number;

  // TLS session caching
  maxCachedSessions: number;

  // Health monitoring
  healthCheckInterval: number;
}

export const defaultPoolConfig: PoolConfig = {
  connections: 10,
  pipelining: 1,
  connectTimeout: 10000,
  bodyTimeout: 30000,
  headersTimeout: 10000,
  keepAliveTimeout: 4000,
  keepAliveMaxTimeout: 600000,
  maxCachedSessions: 100,
  healthCheckInterval: 60000, // 1 minute
};

export function createPoolConfig(overrides: Partial<PoolConfig> = {}): PoolConfig {
  return { ...defaultPoolConfig, ...overrides };
}
```

---

## 🎯 Pattern 2: Circuit Breaker

**Purpose**: Stop cascading failures, fast-fail when service is down, automatic recovery

### State Machine

```
CLOSED (normal operation)
    ↓ (failures exceed threshold)
OPEN (fail fast)
    ↓ (after timeout)
HALF_OPEN (test recovery)
    ↓ (success) → CLOSED
    ↓ (failure) → OPEN
```

### Complete Implementation

```typescript
// src/undici-resilience/resilience/circuit-breaker.ts

import pino from 'pino';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Failures before opening (e.g., 5)
  successThreshold: number;       // Successes in HALF_OPEN to close (e.g., 2)
  timeout: number;                // Time in OPEN before HALF_OPEN (ms)
  monitoringPeriod: number;       // Rolling window for failure count (ms)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveSuccesses: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextRetryTime?: Date;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private successes: number = 0;
  private consecutiveSuccesses: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextRetryTime?: Date;
  private failureTimestamps: number[] = [];

  private config: CircuitBreakerConfig;
  private logger: pino.Logger;
  private name: string;

  constructor(
    name: string,
    config: CircuitBreakerConfig,
    logger: pino.Logger,
  ) {
    this.name = name;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === 'OPEN') {
      if (this.nextRetryTime && Date.now() < this.nextRetryTime.getTime()) {
        throw new Error(
          `Circuit breaker '${this.name}' is OPEN. Retry after ${this.nextRetryTime.toISOString()}`,
        );
      }

      // Transition to HALF_OPEN
      this.transitionTo('HALF_OPEN');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;

    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successes++;
    this.consecutiveSuccesses++;
    this.lastSuccessTime = new Date();

    if (this.state === 'HALF_OPEN') {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
      }
    }

    this.logger.debug({
      circuitBreaker: this.name,
      state: this.state,
      consecutiveSuccesses: this.consecutiveSuccesses,
    }, 'Circuit breaker success');
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = new Date();

    const now = Date.now();
    this.failureTimestamps.push(now);

    // Remove old failures outside monitoring period
    this.failureTimestamps = this.failureTimestamps.filter(
      timestamp => now - timestamp < this.config.monitoringPeriod,
    );

    this.logger.warn({
      circuitBreaker: this.name,
      state: this.state,
      recentFailures: this.failureTimestamps.length,
      failureThreshold: this.config.failureThreshold,
    }, 'Circuit breaker failure');

    if (this.state === 'HALF_OPEN') {
      this.transitionTo('OPEN');
      return;
    }

    if (
      this.state === 'CLOSED' &&
      this.failureTimestamps.length >= this.config.failureThreshold
    ) {
      this.transitionTo('OPEN');
    }
  }

  /**
   * Transition between states
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'OPEN') {
      this.nextRetryTime = new Date(Date.now() + this.config.timeout);

      this.logger.warn({
        circuitBreaker: this.name,
        transition: `${oldState} → ${newState}`,
        failures: this.failures,
        nextRetryTime: this.nextRetryTime,
      }, 'Circuit breaker opened');

    } else if (newState === 'HALF_OPEN') {
      this.consecutiveSuccesses = 0;

      this.logger.info({
        circuitBreaker: this.name,
        transition: `${oldState} → ${newState}`,
      }, 'Circuit breaker half-open (testing recovery)');

    } else if (newState === 'CLOSED') {
      this.failures = 0;
      this.consecutiveSuccesses = 0;
      this.failureTimestamps = [];
      this.nextRetryTime = undefined;

      this.logger.info({
        circuitBreaker: this.name,
        transition: `${oldState} → ${newState}`,
      }, 'Circuit breaker closed (recovered)');
    }
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextRetryTime: this.nextRetryTime,
    };
  }

  /**
   * Force reset to CLOSED state
   */
  reset(): void {
    this.logger.info({ circuitBreaker: this.name }, 'Circuit breaker manually reset');
    this.transitionTo('CLOSED');
  }

  /**
   * Force transition to OPEN state
   */
  forceOpen(): void {
    this.logger.warn({ circuitBreaker: this.name }, 'Circuit breaker manually opened');
    this.transitionTo('OPEN');
  }
}
```

---

## 🎯 Pattern 3: Bulkhead

**Purpose**: Resource isolation, prevent resource exhaustion, limit concurrent operations

### Complete Implementation

```typescript
// src/undici-resilience/resilience/bulkhead.ts

import pino from 'pino';

export interface BulkheadConfig {
  maxConcurrent: number;      // Max concurrent executions (e.g., 10)
  maxQueue: number;           // Max queued requests (e.g., 20)
  queueTimeout: number;       // Max wait time in queue (ms)
}

export interface BulkheadStats {
  running: number;
  queued: number;
  rejected: number;
  completed: number;
  maxConcurrent: number;
  maxQueue: number;
}

interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  queuedAt: number;
}

export class Bulkhead {
  private running: number = 0;
  private queue: QueuedRequest<any>[] = [];
  private rejected: number = 0;
  private completed: number = 0;

  private config: BulkheadConfig;
  private logger: pino.Logger;
  private name: string;

  constructor(
    name: string,
    config: BulkheadConfig,
    logger: pino.Logger,
  ) {
    this.name = name;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Execute function with bulkhead protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we can execute immediately
    if (this.running < this.config.maxConcurrent) {
      return this.executeNow(fn);
    }

    // Check if queue is full
    if (this.queue.length >= this.config.maxQueue) {
      this.rejected++;

      this.logger.warn({
        bulkhead: this.name,
        running: this.running,
        queued: this.queue.length,
        maxConcurrent: this.config.maxConcurrent,
        maxQueue: this.config.maxQueue,
      }, 'Bulkhead queue full - request rejected');

      throw new Error(
        `Bulkhead '${this.name}' queue is full (${this.queue.length}/${this.config.maxQueue})`,
      );
    }

    // Add to queue
    return this.enqueue(fn);
  }

  /**
   * Execute function immediately
   */
  private async executeNow<T>(fn: () => Promise<T>): Promise<T> {
    this.running++;

    this.logger.debug({
      bulkhead: this.name,
      running: this.running,
      queued: this.queue.length,
    }, 'Bulkhead executing request');

    try {
      const result = await fn();
      return result;

    } finally {
      this.running--;
      this.completed++;

      // Process next queued request
      this.processQueue();
    }
  }

  /**
   * Add function to queue
   */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest<T> = {
        fn,
        resolve,
        reject,
        queuedAt: Date.now(),
      };

      this.queue.push(queuedRequest);

      this.logger.debug({
        bulkhead: this.name,
        running: this.running,
        queued: this.queue.length,
      }, 'Bulkhead request queued');

      // Set timeout for queued request
      setTimeout(() => {
        this.checkQueueTimeout(queuedRequest);
      }, this.config.queueTimeout);
    });
  }

  /**
   * Check if queued request has timed out
   */
  private checkQueueTimeout<T>(queuedRequest: QueuedRequest<T>): void {
    const index = this.queue.indexOf(queuedRequest);

    if (index === -1) {
      return; // Already processed
    }

    const waitTime = Date.now() - queuedRequest.queuedAt;

    if (waitTime >= this.config.queueTimeout) {
      // Remove from queue
      this.queue.splice(index, 1);
      this.rejected++;

      this.logger.warn({
        bulkhead: this.name,
        waitTime,
        queueTimeout: this.config.queueTimeout,
      }, 'Bulkhead request timeout in queue');

      queuedRequest.reject(
        new Error(
          `Bulkhead '${this.name}' queue timeout after ${waitTime}ms`,
        ),
      );
    }
  }

  /**
   * Process next request in queue
   */
  private processQueue(): void {
    if (this.queue.length === 0 || this.running >= this.config.maxConcurrent) {
      return;
    }

    const queuedRequest = this.queue.shift();

    if (!queuedRequest) {
      return;
    }

    const waitTime = Date.now() - queuedRequest.queuedAt;

    this.logger.debug({
      bulkhead: this.name,
      waitTime,
      running: this.running,
      queued: this.queue.length,
    }, 'Bulkhead processing queued request');

    // Execute the queued function
    this.executeNow(queuedRequest.fn)
      .then(queuedRequest.resolve)
      .catch(queuedRequest.reject);
  }

  /**
   * Get current statistics
   */
  getStats(): BulkheadStats {
    return {
      running: this.running,
      queued: this.queue.length,
      rejected: this.rejected,
      completed: this.completed,
      maxConcurrent: this.config.maxConcurrent,
      maxQueue: this.config.maxQueue,
    };
  }

  /**
   * Clear all queued requests
   */
  clearQueue(): void {
    const cleared = this.queue.length;

    for (const request of this.queue) {
      request.reject(new Error(`Bulkhead '${this.name}' queue cleared`));
    }

    this.queue = [];
    this.rejected += cleared;

    this.logger.warn({
      bulkhead: this.name,
      cleared,
    }, 'Bulkhead queue cleared');
  }
}
```

---

## 🎯 Pattern 4: Rate Limiter

**Purpose**: Control request rate, prevent API quota exhaustion, smooth traffic

### Algorithms

1. **Token Bucket**: Smooth burst handling, refill at constant rate
2. **Sliding Window**: Precise rate limiting, recent request history

### Complete Implementation

```typescript
// src/undici-resilience/resilience/rate-limiter.ts

import pino from 'pino';

export type RateLimiterAlgorithm = 'token-bucket' | 'sliding-window';

export interface RateLimiterConfig {
  algorithm: RateLimiterAlgorithm;
  maxRequests: number;        // Max requests per window
  windowMs: number;           // Time window (ms)
  burstSize?: number;         // Token bucket burst size (default: maxRequests)
}

export interface RateLimiterStats {
  algorithm: RateLimiterAlgorithm;
  allowed: number;
  rejected: number;
  currentTokens?: number;     // Token bucket only
  requestsInWindow?: number;  // Sliding window only
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private allowed: number = 0;
  private rejected: number = 0;

  // Token bucket state
  private tokens: number;
  private lastRefillTime: number;

  // Sliding window state
  private requestTimestamps: number[] = [];

  private config: RateLimiterConfig;
  private logger: pino.Logger;
  private name: string;

  constructor(
    name: string,
    config: RateLimiterConfig,
    logger: pino.Logger,
  ) {
    this.name = name;
    this.config = config;
    this.logger = logger;

    // Initialize token bucket
    this.tokens = config.burstSize || config.maxRequests;
    this.lastRefillTime = Date.now();
  }

  /**
   * Execute function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const canProceed = this.config.algorithm === 'token-bucket'
      ? this.checkTokenBucket()
      : this.checkSlidingWindow();

    if (!canProceed) {
      this.rejected++;

      const retryAfter = this.config.algorithm === 'token-bucket'
        ? this.getTokenBucketRetryAfter()
        : this.getSlidingWindowRetryAfter();

      this.logger.warn({
        rateLimiter: this.name,
        algorithm: this.config.algorithm,
        retryAfter,
        stats: this.getStats(),
      }, 'Rate limit exceeded');

      throw new Error(
        `Rate limit exceeded for '${this.name}'. Retry after ${retryAfter}ms`,
      );
    }

    this.allowed++;

    try {
      return await fn();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check token bucket algorithm
   */
  private checkTokenBucket(): boolean {
    const now = Date.now();
    const timePassed = now - this.lastRefillTime;

    // Refill tokens based on time passed
    const refillAmount = (timePassed / this.config.windowMs) * this.config.maxRequests;
    const burstSize = this.config.burstSize || this.config.maxRequests;

    this.tokens = Math.min(burstSize, this.tokens + refillAmount);
    this.lastRefillTime = now;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Check sliding window algorithm
   */
  private checkSlidingWindow(): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Remove old requests outside window
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => timestamp > windowStart,
    );

    if (this.requestTimestamps.length < this.config.maxRequests) {
      this.requestTimestamps.push(now);
      return true;
    }

    return false;
  }

  /**
   * Get retry-after time for token bucket
   */
  private getTokenBucketRetryAfter(): number {
    const refillRate = this.config.windowMs / this.config.maxRequests;
    return Math.ceil(refillRate * (1 - this.tokens));
  }

  /**
   * Get retry-after time for sliding window
   */
  private getSlidingWindowRetryAfter(): number {
    if (this.requestTimestamps.length === 0) {
      return 0;
    }

    const oldestRequest = this.requestTimestamps[0];
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    return Math.max(0, oldestRequest - windowStart);
  }

  /**
   * Get current statistics
   */
  getStats(): RateLimiterStats {
    const stats: RateLimiterStats = {
      algorithm: this.config.algorithm,
      allowed: this.allowed,
      rejected: this.rejected,
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs,
    };

    if (this.config.algorithm === 'token-bucket') {
      // Ensure tokens are up to date
      this.checkTokenBucket();
      stats.currentTokens = Math.floor(this.tokens);
    } else {
      // Clean up old timestamps
      const now = Date.now();
      const windowStart = now - this.config.windowMs;
      this.requestTimestamps = this.requestTimestamps.filter(
        timestamp => timestamp > windowStart,
      );
      stats.requestsInWindow = this.requestTimestamps.length;
    }

    return stats;
  }

  /**
   * Reset rate limiter state
   */
  reset(): void {
    this.allowed = 0;
    this.rejected = 0;
    this.tokens = this.config.burstSize || this.config.maxRequests;
    this.lastRefillTime = Date.now();
    this.requestTimestamps = [];

    this.logger.info({ rateLimiter: this.name }, 'Rate limiter reset');
  }
}
```

---

## 🎯 Pattern 5: Retry Strategy

**Purpose**: Handle transient failures, exponential backoff, jitter to prevent thundering herd

### Complete Implementation

```typescript
// src/undici-resilience/resilience/retry-strategy.ts

import pino from 'pino';

export interface RetryConfig {
  maxAttempts: number;        // Max retry attempts (e.g., 3)
  initialDelay: number;       // Initial delay (ms, e.g., 100)
  maxDelay: number;           // Max delay cap (ms, e.g., 5000)
  backoffMultiplier: number;  // Exponential multiplier (e.g., 2)
  jitterFactor: number;       // Jitter randomness (0-1, e.g., 0.1)
  retryableErrors?: RegExp[]; // Errors to retry (e.g., /timeout/i)
}

export interface RetryStats {
  attempts: number;
  successes: number;
  failures: number;
  totalRetries: number;
  lastError?: string;
}

export class RetryStrategy {
  private attempts: number = 0;
  private successes: number = 0;
  private failures: number = 0;
  private totalRetries: number = 0;
  private lastError?: string;

  private config: RetryConfig;
  private logger: pino.Logger;
  private name: string;

  constructor(
    name: string,
    config: RetryConfig,
    logger: pino.Logger,
  ) {
    this.name = name;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      this.attempts++;

      try {
        const result = await fn();

        if (attempt > 1) {
          this.logger.info({
            retryStrategy: this.name,
            attempt,
            totalAttempts: this.config.maxAttempts,
          }, 'Retry succeeded');
        }

        this.successes++;
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.lastError = lastError.message;

        const isRetryable = this.isRetryableError(lastError);
        const isLastAttempt = attempt === this.config.maxAttempts;

        if (!isRetryable || isLastAttempt) {
          this.failures++;

          this.logger.error({
            retryStrategy: this.name,
            attempt,
            totalAttempts: this.config.maxAttempts,
            error: lastError.message,
            retryable: isRetryable,
          }, isLastAttempt ? 'All retry attempts exhausted' : 'Non-retryable error');

          throw lastError;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);

        this.totalRetries++;

        this.logger.warn({
          retryStrategy: this.name,
          attempt,
          totalAttempts: this.config.maxAttempts,
          delay,
          error: lastError.message,
        }, 'Retrying after failure');

        await this.sleep(delay);
      }
    }

    // This should never be reached due to throw in loop
    throw lastError || new Error('Retry failed');
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    if (!this.config.retryableErrors || this.config.retryableErrors.length === 0) {
      // Retry all errors by default
      return true;
    }

    return this.config.retryableErrors.some(pattern => pattern.test(error.message));
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff: initialDelay * (backoffMultiplier ^ (attempt - 1))
    const exponentialDelay = this.config.initialDelay *
      Math.pow(this.config.backoffMultiplier, attempt - 1);

    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    // Add jitter: randomness to prevent thundering herd
    const jitter = cappedDelay * this.config.jitterFactor * (Math.random() - 0.5) * 2;

    return Math.max(0, Math.round(cappedDelay + jitter));
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current statistics
   */
  getStats(): RetryStats {
    return {
      attempts: this.attempts,
      successes: this.successes,
      failures: this.failures,
      totalRetries: this.totalRetries,
      lastError: this.lastError,
    };
  }

  /**
   * Reset retry statistics
   */
  reset(): void {
    this.attempts = 0;
    this.successes = 0;
    this.failures = 0;
    this.totalRetries = 0;
    this.lastError = undefined;

    this.logger.info({ retryStrategy: this.name }, 'Retry strategy reset');
  }
}
```

---

## 🔗 Complete Integration Example

### Combining All Patterns

```typescript
// src/weather-service.ts (excerpt showing full resilience stack)

import { PoolManager } from './undici-resilience/http/pool-manager.js';
import { CircuitBreaker } from './undici-resilience/resilience/circuit-breaker.js';
import { Bulkhead } from './undici-resilience/resilience/bulkhead.js';
import { RateLimiter } from './undici-resilience/resilience/rate-limiter.js';
import { RetryStrategy } from './undici-resilience/resilience/retry-strategy.js';

export class WeatherService {
  private poolManager: PoolManager;

  // Resilience components
  private weatherCircuitBreaker: CircuitBreaker;
  private weatherBulkhead: Bulkhead;
  private weatherRateLimiter: RateLimiter;
  private retryStrategy: RetryStrategy;

  constructor(config: AppConfig, logger: pino.Logger) {
    // Initialize pool manager
    this.poolManager = new PoolManager(config.poolConfig, logger);

    // Initialize resilience components
    this.weatherCircuitBreaker = new CircuitBreaker(
      'weather-api',
      {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000,
        monitoringPeriod: 120000,
      },
      logger,
    );

    this.weatherBulkhead = new Bulkhead(
      'weather-api',
      {
        maxConcurrent: 10,
        maxQueue: 20,
        queueTimeout: 5000,
      },
      logger,
    );

    this.weatherRateLimiter = new RateLimiter(
      'weather-api',
      {
        algorithm: 'token-bucket',
        maxRequests: 50,
        windowMs: 60000,
        burstSize: 60,
      },
      logger,
    );

    this.retryStrategy = new RetryStrategy(
      'weather-api',
      {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 5000,
        backoffMultiplier: 2,
        jitterFactor: 0.1,
        retryableErrors: [/timeout/i, /ECONNRESET/i, /ETIMEDOUT/i],
      },
      logger,
    );
  }

  /**
   * Get weather with full resilience stack
   */
  async getCurrentWeather(city: string): Promise<WeatherData> {
    // Full resilience stack: Rate Limiter → Bulkhead → Circuit Breaker → Retry → Pool
    return await this.weatherRateLimiter.execute(async () => {
      return await this.weatherBulkhead.execute(async () => {
        return await this.weatherCircuitBreaker.execute(async () => {
          return await this.retryStrategy.execute(async () => {
            // Make HTTP request with connection pool
            const response = await this.poolManager.request<WeatherAPIResponse>(
              `https://api.open-meteo.com/v1/forecast`,
              {
                method: 'GET',
                query: {
                  latitude: String(latitude),
                  longitude: String(longitude),
                  current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
                },
              },
            );

            return this.transformWeatherData(response, city);
          });
        });
      });
    });
  }
}
```

---

## 📊 Monitoring & Observability

### Health Check Endpoint

```typescript
// src/server.ts (excerpt)

fastify.get('/health/resilience', async (request, reply) => {
  const weatherService = container.resolve<WeatherService>('weatherService');

  return {
    timestamp: new Date().toISOString(),
    pools: poolManager.getPoolStats(),
    circuitBreakers: {
      weather: weatherService.weatherCircuitBreaker.getStats(),
      geocoding: weatherService.geocodingCircuitBreaker.getStats(),
    },
    bulkheads: {
      weather: weatherService.weatherBulkhead.getStats(),
      geocoding: weatherService.geocodingBulkhead.getStats(),
    },
    rateLimiters: {
      weather: weatherService.weatherRateLimiter.getStats(),
      geocoding: weatherService.geocodingRateLimiter.getStats(),
    },
    retries: weatherService.retryStrategy.getStats(),
  };
});
```

---

## 🧪 Testing Resilience Patterns

### Circuit Breaker Test

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

  it('should remain CLOSED on success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    await circuitBreaker.execute(fn);

    const stats = circuitBreaker.getStats();
    expect(stats.state).toBe('CLOSED');
    expect(stats.successes).toBe(1);
  });

  it('should open after threshold failures', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('failure'));

    // Trigger failures
    for (let i = 0; i < 3; i++) {
      await expect(circuitBreaker.execute(fn)).rejects.toThrow();
    }

    const stats = circuitBreaker.getStats();
    expect(stats.state).toBe('OPEN');
  });

  it('should transition to HALF_OPEN after timeout', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('failure'));

    // Open circuit
    for (let i = 0; i < 3; i++) {
      await expect(circuitBreaker.execute(fn)).rejects.toThrow();
    }

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Next call should transition to HALF_OPEN
    fn.mockResolvedValue('success');
    await circuitBreaker.execute(fn);

    const stats = circuitBreaker.getStats();
    expect(stats.state).toBe('HALF_OPEN');
  });
});
```

---

## 📈 Configuration Best Practices

### Production Settings

```typescript
export const productionResilienceConfig = {
  // Connection Pool
  pool: {
    connections: 10,
    pipelining: 1,
    connectTimeout: 10000,
    bodyTimeout: 30000,
    headersTimeout: 10000,
    keepAliveTimeout: 4000,
    keepAliveMaxTimeout: 600000,
  },

  // Circuit Breaker
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,
    monitoringPeriod: 120000,
  },

  // Bulkhead
  bulkhead: {
    maxConcurrent: 10,
    maxQueue: 20,
    queueTimeout: 5000,
  },

  // Rate Limiter
  rateLimiter: {
    algorithm: 'token-bucket' as const,
    maxRequests: 50,
    windowMs: 60000,
    burstSize: 60,
  },

  // Retry Strategy
  retry: {
    maxAttempts: 3,
    initialDelay: 100,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    retryableErrors: [
      /timeout/i,
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /ENOTFOUND/i,
      /503/i,
      /502/i,
    ],
  },
};
```

---

## ✅ Validation Checklist

- [ ] All resilience patterns implemented (Circuit Breaker, Bulkhead, Rate Limiter, Retry, Pool)
- [ ] Connection pooling configured with appropriate timeouts
- [ ] Circuit breaker thresholds tuned for your API
- [ ] Bulkhead limits prevent resource exhaustion
- [ ] Rate limiting prevents quota exhaustion
- [ ] Retry strategy handles transient failures
- [ ] Health endpoints expose resilience metrics
- [ ] Comprehensive unit tests for all patterns
- [ ] Integration tests simulate failures
- [ ] Logging captures all resilience events
- [ ] Monitoring dashboards track metrics

---

**Next**: See `mcp-security-architecture.md` for security implementation guide.
