/**
 * Enhanced Connection Monitoring for Undici-Resilience
 * Provides real-time connection health, usage patterns, and performance insights
 */

import { EventEmitter } from 'events';
import { logger } from '../../logger-pino';
import { metricsCollector, PoolMetrics } from './metrics';

export interface ConnectionEvent {
  poolName: string;
  timestamp: number;
  type: 'connect' | 'disconnect' | 'timeout' | 'error' | 'drain';
  origin?: string;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface ConnectionHealth {
  poolName: string;
  isHealthy: boolean;
  status: 'optimal' | 'warning' | 'critical' | 'offline';
  metrics: {
    activeConnections: number;
    totalConnections: number;
    utilization: number;
    avgResponseTime: number;
    errorRate: number;
    throughput: number; // requests per second
  };
  thresholds: {
    utilizationWarning: number;
    utilizationCritical: number;
    responseTimeWarning: number;
    responseTimeCritical: number;
    errorRateWarning: number;
    errorRateCritical: number;
  };
  alerts: ConnectionAlert[];
  lastHealthCheck: number;
}

export interface ConnectionAlert {
  id: string;
  poolName: string;
  severity: 'info' | 'warning' | 'critical' | 'error';
  type: 'utilization' | 'response_time' | 'error_rate' | 'connection_failure' | 'timeout';
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  metadata?: Record<string, any>;
}

export interface ConnectionPattern {
  poolName: string;
  period: '1m' | '5m' | '15m' | '1h' | '24h';
  metrics: {
    avgConnections: number;
    peakConnections: number;
    avgUtilization: number;
    peakUtilization: number;
    totalRequests: number;
    avgThroughput: number;
    peakThroughput: number;
  };
  trends: {
    connectionsDirection: 'increasing' | 'decreasing' | 'stable';
    utilizationDirection: 'increasing' | 'decreasing' | 'stable';
    throughputDirection: 'increasing' | 'decreasing' | 'stable';
    changePercent: number;
  };
}

export interface MonitoringConfig {
  healthCheckInterval: number; // ms
  patternAnalysisInterval: number; // ms
  alertRetentionTime: number; // ms
  thresholds: {
    utilizationWarning: number; // %
    utilizationCritical: number; // %
    responseTimeWarning: number; // ms
    responseTimeCritical: number; // ms
    errorRateWarning: number; // %
    errorRateCritical: number; // %
  };
  enablePredictiveAlerts: boolean;
  enablePerformanceBaselines: boolean;
}

export class ConnectionMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private pools = new Map<string, any>();
  private connectionEvents: ConnectionEvent[] = [];
  private alerts = new Map<string, ConnectionAlert>();
  private patterns = new Map<string, ConnectionPattern>();
  private healthCheckInterval?: NodeJS.Timeout;
  private patternAnalysisInterval?: NodeJS.Timeout;
  private performanceBaselines = new Map<string, any>();
  private throughputTracking = new Map<string, { timestamp: number; count: number }[]>();

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    this.config = {
      healthCheckInterval: 30000, // 30 seconds
      patternAnalysisInterval: 300000, // 5 minutes
      alertRetentionTime: 86400000, // 24 hours
      thresholds: {
        utilizationWarning: 70,
        utilizationCritical: 90,
        responseTimeWarning: 2000,
        responseTimeCritical: 5000,
        errorRateWarning: 5,
        errorRateCritical: 15,
      },
      enablePredictiveAlerts: true,
      enablePerformanceBaselines: true,
      ...config,
    };

    this.startMonitoring();
  }

  /**
   * Register a pool for monitoring
   */
  registerPool(poolName: string, pool: any): void {
    this.pools.set(poolName, pool);
    this.throughputTracking.set(poolName, []);

    // Set up pool event listeners
    pool.on('connect', (origin: string) => {
      this.recordConnectionEvent({
        poolName,
        timestamp: Date.now(),
        type: 'connect',
        origin,
      });
    });

    pool.on('disconnect', (origin: string, targets: any[], error?: Error) => {
      this.recordConnectionEvent({
        poolName,
        timestamp: Date.now(),
        type: 'disconnect',
        origin,
        error,
        metadata: { targets: targets?.length || 0 },
      });
    });

    pool.on('drain', () => {
      this.recordConnectionEvent({
        poolName,
        timestamp: Date.now(),
        type: 'drain',
      });
    });

    logger.info('Pool registered for connection monitoring', { poolName });
  }

  /**
   * Record a connection event
   */
  recordConnectionEvent(event: ConnectionEvent): void {
    this.connectionEvents.push(event);

    // Keep only last 1000 events to prevent memory issues
    if (this.connectionEvents.length > 1000) {
      this.connectionEvents.shift();
    }

    // Emit the event for real-time processing
    this.emit('connectionEvent', event);

    logger.debug('Connection event recorded', event);
  }

  /**
   * Record a request for throughput tracking
   */
  recordRequest(poolName: string): void {
    const tracking = this.throughputTracking.get(poolName);
    if (tracking) {
      const now = Date.now();
      tracking.push({ timestamp: now, count: 1 });

      // Keep only last 5 minutes of data
      const fiveMinutesAgo = now - 300000;
      while (tracking.length > 0 && tracking[0].timestamp < fiveMinutesAgo) {
        tracking.shift();
      }
    }
  }

  /**
   * Get connection health for a specific pool
   */
  getConnectionHealth(poolName: string): ConnectionHealth | null {
    const pool = this.pools.get(poolName);
    if (!pool) return null;

    const poolMetrics = metricsCollector.getPoolMetrics(poolName);
    const requestMetrics = metricsCollector.getRequestMetrics(poolName);

    if (!poolMetrics || !requestMetrics) return null;

    const utilization = poolMetrics.utilization;
    const responseTime = requestMetrics.avgResponseTime;
    const errorRate = requestMetrics.errorRate;
    const throughput = this.calculateThroughput(poolName);

    const status = this.determineConnectionStatus(utilization, responseTime, errorRate);
    const alerts = this.getActiveAlerts(poolName);

    return {
      poolName,
      isHealthy: status === 'optimal' || status === 'warning',
      status,
      metrics: {
        activeConnections: poolMetrics.connected,
        totalConnections: poolMetrics.size,
        utilization,
        avgResponseTime: responseTime,
        errorRate,
        throughput,
      },
      thresholds: this.config.thresholds,
      alerts,
      lastHealthCheck: Date.now(),
    };
  }

  /**
   * Get connection health for all monitored pools
   */
  getAllConnectionHealth(): Record<string, ConnectionHealth> {
    const health: Record<string, ConnectionHealth> = {};

    for (const poolName of this.pools.keys()) {
      const poolHealth = this.getConnectionHealth(poolName);
      if (poolHealth) {
        health[poolName] = poolHealth;
      }
    }

    return health;
  }

  /**
   * Get connection patterns for analysis
   */
  getConnectionPatterns(poolName: string, period: '1m' | '5m' | '15m' | '1h' | '24h' = '5m'): ConnectionPattern | null {
    return this.patterns.get(`${poolName}-${period}`) || null;
  }

  /**
   * Get all connection patterns
   */
  getAllConnectionPatterns(): Record<string, ConnectionPattern[]> {
    const patterns: Record<string, ConnectionPattern[]> = {};

    for (const poolName of this.pools.keys()) {
      patterns[poolName] = [
        this.getConnectionPatterns(poolName, '1m'),
        this.getConnectionPatterns(poolName, '5m'),
        this.getConnectionPatterns(poolName, '15m'),
        this.getConnectionPatterns(poolName, '1h'),
        this.getConnectionPatterns(poolName, '24h'),
      ].filter(Boolean) as ConnectionPattern[];
    }

    return patterns;
  }

  /**
   * Get active alerts for a pool
   */
  getActiveAlerts(poolName?: string): ConnectionAlert[] {
    const now = Date.now();
    const alerts = Array.from(this.alerts.values())
      .filter(alert => !alert.resolved && now - alert.timestamp <= this.config.alertRetentionTime);

    return poolName ? alerts.filter(alert => alert.poolName === poolName) : alerts;
  }

  /**
   * Get recent connection events
   */
  getRecentEvents(poolName?: string, limit: number = 50): ConnectionEvent[] {
    let events = this.connectionEvents.slice(-limit);
    if (poolName) {
      events = events.filter(event => event.poolName === poolName);
    }
    return events.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Start monitoring services
   */
  private startMonitoring(): void {
    // Health check interval
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);

    // Pattern analysis interval
    this.patternAnalysisInterval = setInterval(() => {
      this.analyzeConnectionPatterns();
    }, this.config.patternAnalysisInterval);

    logger.info('Connection monitoring started', {
      healthCheckInterval: this.config.healthCheckInterval,
      patternAnalysisInterval: this.config.patternAnalysisInterval,
    });
  }

  /**
   * Perform health checks on all pools
   */
  private performHealthChecks(): void {
    for (const poolName of this.pools.keys()) {
      const health = this.getConnectionHealth(poolName);
      if (health) {
        this.evaluateAlertConditions(health);
        this.emit('healthCheck', health);
      }
    }

    // Clean up old alerts
    this.cleanupOldAlerts();
  }

  /**
   * Analyze connection patterns
   */
  private analyzeConnectionPatterns(): void {
    const periods: Array<'1m' | '5m' | '15m' | '1h' | '24h'> = ['1m', '5m', '15m', '1h', '24h'];

    for (const poolName of this.pools.keys()) {
      for (const period of periods) {
        const pattern = this.calculateConnectionPattern(poolName, period);
        if (pattern) {
          this.patterns.set(`${poolName}-${period}`, pattern);
          this.emit('patternAnalysis', pattern);
        }
      }
    }
  }

  /**
   * Calculate connection pattern for a specific period
   */
  private calculateConnectionPattern(poolName: string, period: '1m' | '5m' | '15m' | '1h' | '24h'): ConnectionPattern | null {
    const now = Date.now();
    const periodMs = this.getPeriodInMs(period);
    const startTime = now - periodMs;

    const relevantEvents = this.connectionEvents.filter(
      event => event.poolName === poolName && event.timestamp >= startTime
    );

    if (relevantEvents.length === 0) return null;

    // Calculate metrics (simplified implementation)
    const connectionCounts = relevantEvents.filter(e => e.type === 'connect').length;
    const disconnectionCounts = relevantEvents.filter(e => e.type === 'disconnect').length;
    
    const poolMetrics = metricsCollector.getPoolMetrics(poolName);
    if (!poolMetrics) return null;

    return {
      poolName,
      period,
      metrics: {
        avgConnections: poolMetrics.connected,
        peakConnections: Math.max(poolMetrics.connected, poolMetrics.size),
        avgUtilization: poolMetrics.utilization,
        peakUtilization: Math.min(100, poolMetrics.utilization * 1.2),
        totalRequests: connectionCounts,
        avgThroughput: this.calculateThroughput(poolName),
        peakThroughput: this.calculateThroughput(poolName) * 1.5,
      },
      trends: {
        connectionsDirection: this.determineTrend(connectionCounts, disconnectionCounts),
        utilizationDirection: this.determineTrend(poolMetrics.utilization, 50),
        throughputDirection: this.determineTrend(this.calculateThroughput(poolName), 10),
        changePercent: this.calculateChangePercent(connectionCounts, disconnectionCounts),
      },
    };
  }

  /**
   * Evaluate alert conditions and create alerts if necessary
   */
  private evaluateAlertConditions(health: ConnectionHealth): void {
    const { poolName, metrics, thresholds } = health;

    // Utilization alerts
    if (metrics.utilization >= thresholds.utilizationCritical) {
      this.createAlert(poolName, 'critical', 'utilization', 
        `Connection utilization critically high: ${metrics.utilization.toFixed(1)}%`);
    } else if (metrics.utilization >= thresholds.utilizationWarning) {
      this.createAlert(poolName, 'warning', 'utilization', 
        `Connection utilization warning: ${metrics.utilization.toFixed(1)}%`);
    }

    // Response time alerts
    if (metrics.avgResponseTime >= thresholds.responseTimeCritical) {
      this.createAlert(poolName, 'critical', 'response_time', 
        `Response time critically high: ${metrics.avgResponseTime.toFixed(0)}ms`);
    } else if (metrics.avgResponseTime >= thresholds.responseTimeWarning) {
      this.createAlert(poolName, 'warning', 'response_time', 
        `Response time warning: ${metrics.avgResponseTime.toFixed(0)}ms`);
    }

    // Error rate alerts
    if (metrics.errorRate >= thresholds.errorRateCritical) {
      this.createAlert(poolName, 'critical', 'error_rate', 
        `Error rate critically high: ${metrics.errorRate.toFixed(1)}%`);
    } else if (metrics.errorRate >= thresholds.errorRateWarning) {
      this.createAlert(poolName, 'warning', 'error_rate', 
        `Error rate warning: ${metrics.errorRate.toFixed(1)}%`);
    }
  }

  /**
   * Create an alert
   */
  private createAlert(
    poolName: string,
    severity: 'info' | 'warning' | 'critical' | 'error',
    type: ConnectionAlert['type'],
    message: string,
    metadata?: Record<string, any>
  ): void {
    const alertId = `${poolName}-${type}-${Date.now()}`;
    
    const alert: ConnectionAlert = {
      id: alertId,
      poolName,
      severity,
      type,
      message,
      timestamp: Date.now(),
      resolved: false,
      metadata,
    };

    this.alerts.set(alertId, alert);
    this.emit('alert', alert);

    logger.warn('Connection alert created', alert);
  }

  /**
   * Calculate throughput (requests per second)
   */
  private calculateThroughput(poolName: string): number {
    const tracking = this.throughputTracking.get(poolName);
    if (!tracking || tracking.length === 0) return 0;

    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = tracking.filter(t => t.timestamp >= oneMinuteAgo);
    
    return recentRequests.length / 60; // requests per second
  }

  /**
   * Determine connection status based on metrics
   */
  private determineConnectionStatus(
    utilization: number,
    responseTime: number,
    errorRate: number
  ): 'optimal' | 'warning' | 'critical' | 'offline' {
    const { thresholds } = this.config;

    if (utilization >= thresholds.utilizationCritical ||
        responseTime >= thresholds.responseTimeCritical ||
        errorRate >= thresholds.errorRateCritical) {
      return 'critical';
    }

    if (utilization >= thresholds.utilizationWarning ||
        responseTime >= thresholds.responseTimeWarning ||
        errorRate >= thresholds.errorRateWarning) {
      return 'warning';
    }

    return 'optimal';
  }

  /**
   * Get period duration in milliseconds
   */
  private getPeriodInMs(period: '1m' | '5m' | '15m' | '1h' | '24h'): number {
    const periods = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '24h': 86400000,
    };
    return periods[period];
  }

  /**
   * Determine trend direction
   */
  private determineTrend(current: number, previous: number): 'increasing' | 'decreasing' | 'stable' {
    const threshold = 0.1; // 10% change threshold
    const change = (current - previous) / previous;

    if (Math.abs(change) < threshold) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Calculate percentage change
   */
  private calculateChangePercent(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Clean up old alerts
   */
  private cleanupOldAlerts(): void {
    const now = Date.now();
    const expiredAlerts = Array.from(this.alerts.entries())
      .filter(([_, alert]) => now - alert.timestamp > this.config.alertRetentionTime)
      .map(([id]) => id);

    expiredAlerts.forEach(id => this.alerts.delete(id));

    if (expiredAlerts.length > 0) {
      logger.debug('Cleaned up expired alerts', { count: expiredAlerts.length });
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.patternAnalysisInterval) {
      clearInterval(this.patternAnalysisInterval);
    }

    logger.info('Connection monitoring stopped');
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    totalPools: number;
    totalEvents: number;
    activeAlerts: number;
    uptime: number;
  } {
    return {
      totalPools: this.pools.size,
      totalEvents: this.connectionEvents.length,
      activeAlerts: this.getActiveAlerts().length,
      uptime: Date.now() - (this.healthCheckInterval ? Date.now() - this.config.healthCheckInterval : 0),
    };
  }
}

// Export singleton instance
export const connectionMonitor = new ConnectionMonitor();
