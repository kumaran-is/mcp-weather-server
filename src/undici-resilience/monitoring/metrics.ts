/**
 * Metrics collection and monitoring for HTTP pools and resilience patterns
 * Provides comprehensive observability for production deployments
 */

import { logger } from '../logger.js';

export interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  lastRequestTime: number | null;
}

export interface PoolMetrics {
  connected: number;
  pending: number;
  running: number;
  size: number;
  utilization: number;
  connectionsCreated: number;
  connectionsDestroyed: number;
}

export interface CircuitBreakerMetrics {
  state: string;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  nextAttemptTime: number | null;
}

export interface ResilienceMetrics {
  circuitBreaker: CircuitBreakerMetrics;
  retryAttempts: number;
  retrySuccesses: number;
  retryFailures: number;
  avgRetryDelay: number;
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  pools: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
  circuitBreakers: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
  lastHealthCheck: number;
  uptime: number;
}

export class MetricsCollector {
  private requestMetrics = new Map<string, RequestMetrics>();
  private poolMetrics = new Map<string, PoolMetrics>();
  private resilienceMetrics = new Map<string, ResilienceMetrics>();
  private responseTimes = new Map<string, number[]>();
  private startTime = Date.now();

  /**
   * Record a successful request
   */
  recordRequestSuccess(
    poolName: string,
    responseTime: number,
    context?: string
  ): void {
    const metrics = this.getOrCreateRequestMetrics(poolName);
    metrics.totalRequests++;
    metrics.successfulRequests++;
    metrics.lastRequestTime = Date.now();
    metrics.avgResponseTime = this.updateAverage(metrics.avgResponseTime, responseTime, metrics.totalRequests);

    // Update percentiles
    this.addResponseTime(poolName, responseTime);
    metrics.p95ResponseTime = this.calculatePercentile(this.responseTimes.get(poolName) || [], 95);
    metrics.p99ResponseTime = this.calculatePercentile(this.responseTimes.get(poolName) || [], 99);

    // Update error rate
    metrics.errorRate = (metrics.failedRequests / metrics.totalRequests) * 100;

    logger.debug({
      pool: poolName,
      responseTime,
      context,
      totalRequests: metrics.totalRequests
    }, 'Request success recorded');
  }

  /**
   * Record a failed request
   */
  recordRequestFailure(
    poolName: string,
    responseTime: number,
    error: Error,
    context?: string
  ): void {
    const metrics = this.getOrCreateRequestMetrics(poolName);
    metrics.totalRequests++;
    metrics.failedRequests++;
    metrics.lastRequestTime = Date.now();
    metrics.avgResponseTime = this.updateAverage(metrics.avgResponseTime, responseTime, metrics.totalRequests);

    // Update percentiles
    this.addResponseTime(poolName, responseTime);
    metrics.p95ResponseTime = this.calculatePercentile(this.responseTimes.get(poolName) || [], 95);
    metrics.p99ResponseTime = this.calculatePercentile(this.responseTimes.get(poolName) || [], 99);

    // Update error rate
    metrics.errorRate = (metrics.failedRequests / metrics.totalRequests) * 100;

    logger.warn({
      pool: poolName,
      responseTime,
      error: error.message,
      context,
      errorRate: metrics.errorRate
    }, 'Request failure recorded');
  }

  /**
   * Update pool metrics
   */
  updatePoolMetrics(
    poolName: string,
    stats: { connected: number; pending: number; running: number; size: number }
  ): void {
    const metrics = this.getOrCreatePoolMetrics(poolName);
    const oldConnected = metrics.connected;

    metrics.connected = stats.connected;
    metrics.pending = stats.pending;
    metrics.running = stats.running;
    metrics.size = stats.size;
    metrics.utilization = this.calculateUtilization(stats);

    // Track connection lifecycle
    if (stats.connected > oldConnected) {
      metrics.connectionsCreated += (stats.connected - oldConnected);
    } else if (stats.connected < oldConnected) {
      metrics.connectionsDestroyed += (oldConnected - stats.connected);
    }
  }

  /**
   * Update circuit breaker metrics
   */
  updateCircuitBreakerMetrics(
    poolName: string,
    stats: {
      state: string;
      failures: number;
      successes: number;
      lastFailureTime: number | null;
      lastSuccessTime: number | null;
      nextAttemptTime: number | null;
    }
  ): void {
    const metrics = this.getOrCreateResilienceMetrics(poolName);
    metrics.circuitBreaker = {
      ...stats,
      consecutiveFailures: this.calculateConsecutiveFailures(poolName),
    };
  }

  /**
   * Record retry attempt
   */
  recordRetryAttempt(
    poolName: string,
    attempt: number,
    delay: number,
    success: boolean
  ): void {
    const metrics = this.getOrCreateResilienceMetrics(poolName);
    metrics.retryAttempts++;

    if (success) {
      metrics.retrySuccesses++;
    } else {
      metrics.retryFailures++;
    }

    // Update average retry delay
    const totalRetries = metrics.retrySuccesses + metrics.retryFailures;
    metrics.avgRetryDelay = this.updateAverage(metrics.avgRetryDelay, delay, totalRetries);

    logger.debug({
      pool: poolName,
      attempt,
      delay,
      success,
      totalRetries: metrics.retryAttempts
    }, 'Retry attempt recorded');
  }

  /**
   * Get comprehensive health status
   */
  getHealthStatus(): HealthStatus {
    const pools = this.getAllPoolHealth();
    const circuitBreakers = this.getAllCircuitBreakerHealth();

    const overallHealth = this.determineOverallHealth(pools, circuitBreakers);

    return {
      overall: overallHealth,
      pools,
      circuitBreakers,
      lastHealthCheck: Date.now(),
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get request metrics for a pool
   */
  getRequestMetrics(poolName: string): RequestMetrics | null {
    return this.requestMetrics.get(poolName) || null;
  }

  /**
   * Get pool metrics for a pool
   */
  getPoolMetrics(poolName: string): PoolMetrics | null {
    return this.poolMetrics.get(poolName) || null;
  }

  /**
   * Get resilience metrics for a pool
   */
  getResilienceMetrics(poolName: string): ResilienceMetrics | null {
    return this.resilienceMetrics.get(poolName) || null;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): {
    requests: Record<string, RequestMetrics>;
    pools: Record<string, PoolMetrics>;
    resilience: Record<string, ResilienceMetrics>;
  } {
    return {
      requests: Object.fromEntries(this.requestMetrics),
      pools: Object.fromEntries(this.poolMetrics),
      resilience: Object.fromEntries(this.resilienceMetrics),
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.requestMetrics.clear();
    this.poolMetrics.clear();
    this.resilienceMetrics.clear();
    this.responseTimes.clear();
    this.startTime = Date.now();

    logger.info('All metrics reset');
  }

  /**
   * Get or create request metrics for a pool
   */
  private getOrCreateRequestMetrics(poolName: string): RequestMetrics {
    if (!this.requestMetrics.has(poolName)) {
      this.requestMetrics.set(poolName, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        lastRequestTime: null,
      });
    }
    return this.requestMetrics.get(poolName)!;
  }

  /**
   * Get or create pool metrics for a pool
   */
  private getOrCreatePoolMetrics(poolName: string): PoolMetrics {
    if (!this.poolMetrics.has(poolName)) {
      this.poolMetrics.set(poolName, {
        connected: 0,
        pending: 0,
        running: 0,
        size: 0,
        utilization: 0,
        connectionsCreated: 0,
        connectionsDestroyed: 0,
      });
    }
    return this.poolMetrics.get(poolName)!;
  }

  /**
   * Get or create resilience metrics for a pool
   */
  private getOrCreateResilienceMetrics(poolName: string): ResilienceMetrics {
    if (!this.resilienceMetrics.has(poolName)) {
      this.resilienceMetrics.set(poolName, {
        circuitBreaker: {
          state: 'CLOSED',
          failures: 0,
          successes: 0,
          consecutiveFailures: 0,
          lastFailureTime: null,
          lastSuccessTime: null,
          nextAttemptTime: null,
        },
        retryAttempts: 0,
        retrySuccesses: 0,
        retryFailures: 0,
        avgRetryDelay: 0,
      });
    }
    return this.resilienceMetrics.get(poolName)!;
  }

  /**
   * Calculate utilization percentage
   */
  private calculateUtilization(stats: { connected: number; pending: number; running: number }): number {
    const total = stats.connected + stats.pending + stats.running;
    return total > 0 ? (stats.running / total) * 100 : 0;
  }

  /**
   * Calculate consecutive failures (simplified implementation)
   */
  private calculateConsecutiveFailures(poolName: string): number {
    // This is a simplified implementation
    // In a real system, you'd track this more accurately
    const metrics = this.resilienceMetrics.get(poolName);
    return metrics ? Math.min(metrics.circuitBreaker.failures, 10) : 0;
  }

  /**
   * Update running average
   */
  private updateAverage(currentAvg: number, newValue: number, count: number): number {
    return ((currentAvg * (count - 1)) + newValue) / count;
  }

  /**
   * Add response time for percentile calculation
   */
  private addResponseTime(poolName: string, responseTime: number): void {
    if (!this.responseTimes.has(poolName)) {
      this.responseTimes.set(poolName, []);
    }

    const times = this.responseTimes.get(poolName)!;
    times.push(responseTime);

    // Keep only last 1000 measurements to avoid memory issues
    if (times.length > 1000) {
      times.shift();
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const sorted = [...sortedArray].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sorted[lower];
    }

    return sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower]);
  }

  /**
   * Get health status for all pools
   */
  private getAllPoolHealth(): Record<string, 'healthy' | 'degraded' | 'unhealthy'> {
    const health: Record<string, 'healthy' | 'degraded' | 'unhealthy'> = {};

    for (const [poolName, metrics] of this.poolMetrics) {
      if (metrics.utilization > 90) {
        health[poolName] = 'unhealthy';
      } else if (metrics.utilization > 70) {
        health[poolName] = 'degraded';
      } else {
        health[poolName] = 'healthy';
      }
    }

    return health;
  }

  /**
   * Get health status for all circuit breakers
   */
  private getAllCircuitBreakerHealth(): Record<string, 'healthy' | 'degraded' | 'unhealthy'> {
    const health: Record<string, 'healthy' | 'degraded' | 'unhealthy'> = {};

    for (const [poolName, metrics] of this.resilienceMetrics) {
      const cb = metrics.circuitBreaker;
      if (cb.state === 'OPEN') {
        health[poolName] = 'unhealthy';
      } else if (cb.failures > 0 && cb.failures / (cb.failures + cb.successes) > 0.1) {
        health[poolName] = 'degraded';
      } else {
        health[poolName] = 'healthy';
      }
    }

    return health;
  }

  /**
   * Determine overall system health
   */
  private determineOverallHealth(
    pools: Record<string, 'healthy' | 'degraded' | 'unhealthy'>,
    circuitBreakers: Record<string, 'healthy' | 'degraded' | 'unhealthy'>
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const allComponents = { ...pools, ...circuitBreakers };
    const unhealthyCount = Object.values(allComponents).filter(status => status === 'unhealthy').length;
    const degradedCount = Object.values(allComponents).filter(status => status === 'degraded').length;

    if (unhealthyCount > 0) {
      return 'unhealthy';
    } else if (degradedCount > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();
