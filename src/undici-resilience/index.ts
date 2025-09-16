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
export { OptimizedPoolManager, poolManager } from './http/pool-manager';
export { MetricsCollector, metricsCollector } from './monitoring/metrics';

// Configuration
export * from './config/pool-config';

// Resilience patterns
export * from './resilience/circuit-breaker';
export * from './resilience/retry-strategy';
export * from './resilience/bulkhead';
export * from './resilience/rate-limiter';

// Streaming components
export * from './streaming/backpressure-handler';
export * from './streaming/streaming-metrics';
export * from './streaming/streaming-pool-manager';

// Type definitions
export type {
  PoolConfiguration,
  CircuitBreakerConfig,
  RetryConfig,
  ResilienceConfig,
} from './config/pool-config';

export type {
  PoolStats,
  PoolHealth,
} from './http/pool-manager';

export type {
  RequestMetrics,
  PoolMetrics,
  CircuitBreakerMetrics,
  ResilienceMetrics,
  HealthStatus,
} from './monitoring/metrics';

export type {
  CircuitState,
  CircuitBreakerStats,
} from './resilience/circuit-breaker';

export type {
  RetryAttempt,
} from './resilience/retry-strategy';

// Re-export commonly used classes
export { CircuitBreaker } from './resilience/circuit-breaker';
export { RetryStrategy, RetryStrategies } from './resilience/retry-strategy';

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
