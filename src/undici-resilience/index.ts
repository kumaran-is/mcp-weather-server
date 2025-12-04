/**
 * Undici Resilience Package
 * A comprehensive HTTP client library with resilience patterns for Node.js
 *
 * Features:
 * - Ultra-low latency connection pooling
 * - Circuit breaker pattern
 * - Exponential backoff with jitter
 * - Comprehensive monitoring and metrics
 * - Production-ready error handling
 *
 * @packageDocumentation
 */

// Core exports
export { OptimizedPoolManager, poolManager } from './http/pool-manager.js';
export { MetricsCollector, metricsCollector } from './monitoring/metrics.js';

// Configuration
export * from './config/pool-config.js';

// Resilience patterns
export * from './resilience/circuit-breaker.js';
export * from './resilience/retry-strategy.js';
export * from './resilience/bulkhead.js';
export * from './resilience/rate-limiter.js';

// Streaming components
export * from './streaming/backpressure-handler.js';
export * from './streaming/streaming-metrics.js';
export * from './streaming/streaming-pool-manager.js';

// Type definitions
export type {
  PoolConfiguration,
  CircuitBreakerConfig,
  RetryConfig,
  ResilienceConfig,
} from './config/pool-config.js';

export type {
  PoolStats,
  PoolHealth,
} from './http/pool-manager.js';

export type {
  RequestMetrics,
  PoolMetrics,
  CircuitBreakerMetrics,
  ResilienceMetrics,
  HealthStatus,
} from './monitoring/metrics.js';

export type {
  CircuitState,
  CircuitBreakerStats,
} from './resilience/circuit-breaker.js';

export type {
  RetryAttempt,
} from './resilience/retry-strategy.js';

// Re-export commonly used classes
export { CircuitBreaker } from './resilience/circuit-breaker.js';
export { RetryStrategy, RetryStrategies } from './resilience/retry-strategy.js';

/**
 * Quick start example:
 *
 * ```typescript
 * import { poolManager, CircuitBreaker, RetryStrategies } from 'undici-resilience';
 *
 * // Create a pool
 * const pool = poolManager.createPool('api', 'https://api.example.com', config);
 *
 * // Make resilient requests
 * const data = await poolManager.request('api', {
 *   path: '/data',
 *   method: 'GET'
 * });
 * ```
 */
