/**
 * Advanced streaming metrics and monitoring for high-performance AI agent workflows
 * Provides real-time insights into streaming performance, bottlenecks, and health
 */

import { logger } from '../../logger-pino.js';
import { EventEmitter } from 'events';

export interface StreamingMetrics {
  // Connection metrics
  activeConnections: number;
  totalConnections: number;
  connectionErrors: number;
  connectionTimeouts: number;

  // Data flow metrics
  bytesReceived: number;
  bytesSent: number;
  chunksReceived: number;
  chunksSent: number;
  averageChunkSize: number;

  // Performance metrics
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number; // bytes per second

  // Error metrics
  streamErrors: number;
  backpressureEvents: number;
  droppedChunks: number;

  // Resource metrics
  memoryUsage: number;
  bufferSize: number;
  queueLength: number;

  // Time-based metrics
  uptime: number;
  lastActivity: number;
  peakConcurrentStreams: number;
}

export interface StreamHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  connections: 'healthy' | 'degraded' | 'unhealthy';
  performance: 'healthy' | 'degraded' | 'unhealthy';
  errors: 'healthy' | 'degraded' | 'unhealthy';
  resources: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
}

export interface AlertConfig {
  enabled: boolean;
  errorRateThreshold: number; // errors per minute
  latencyThreshold: number; // milliseconds
  memoryThreshold: number; // percentage
  connectionThreshold: number; // max connections
  backpressureThreshold: number; // events per minute
}

export class StreamingMetricsCollector extends EventEmitter {
  private metrics: StreamingMetrics = {
    activeConnections: 0,
    totalConnections: 0,
    connectionErrors: 0,
    connectionTimeouts: 0,
    bytesReceived: 0,
    bytesSent: 0,
    chunksReceived: 0,
    chunksSent: 0,
    averageChunkSize: 0,
    averageLatency: 0,
    p95Latency: 0,
    p99Latency: 0,
    throughput: 0,
    streamErrors: 0,
    backpressureEvents: 0,
    droppedChunks: 0,
    memoryUsage: 0,
    bufferSize: 0,
    queueLength: 0,
    uptime: 0,
    lastActivity: Date.now(),
    peakConcurrentStreams: 0,
  };

  private latencies: number[] = [];
  private startTime = Date.now();
  private alertConfig: AlertConfig;
  private lastAlertTime = 0;
  private alertCooldown = 60000; // 1 minute
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(alertConfig: AlertConfig = {
    enabled: true,
    errorRateThreshold: 10,
    latencyThreshold: 5000,
    memoryThreshold: 80,
    connectionThreshold: 1000,
    backpressureThreshold: 50,
  }) {
    super();
    this.alertConfig = alertConfig;
    this.startMetricsCollection();
  }

  /**
   * Record connection established
   */
  recordConnectionEstablished(): void {
    this.metrics.activeConnections++;
    this.metrics.totalConnections++;
    this.metrics.lastActivity = Date.now();
    this.metrics.peakConcurrentStreams = Math.max(
      this.metrics.peakConcurrentStreams,
      this.metrics.activeConnections
    );

    this.checkAlerts();
  }

  /**
   * Record connection closed
   */
  recordConnectionClosed(): void {
    this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
    this.metrics.lastActivity = Date.now();
  }

  /**
   * Record connection error
   */
  recordConnectionError(): void {
    this.metrics.connectionErrors++;
    this.metrics.lastActivity = Date.now();
    this.checkAlerts();
  }

  /**
   * Record connection timeout
   */
  recordConnectionTimeout(): void {
    this.metrics.connectionTimeouts++;
    this.metrics.lastActivity = Date.now();
    this.checkAlerts();
  }

  /**
   * Record data received
   */
  recordDataReceived(bytes: number, chunks: number = 1): void {
    this.metrics.bytesReceived += bytes;
    this.metrics.chunksReceived += chunks;
    this.metrics.averageChunkSize = this.metrics.bytesReceived / Math.max(1, this.metrics.chunksReceived);
    this.metrics.lastActivity = Date.now();
  }

  /**
   * Record data sent
   */
  recordDataSent(bytes: number, chunks: number = 1): void {
    this.metrics.bytesSent += bytes;
    this.metrics.chunksSent += chunks;
    this.metrics.lastActivity = Date.now();
  }

  /**
   * Record request latency
   */
  recordLatency(latency: number): void {
    this.latencies.push(latency);

    // Keep only last 1000 measurements for percentile calculations
    if (this.latencies.length > 1000) {
      this.latencies.shift();
    }

    // Update average latency
    this.metrics.averageLatency = this.latencies.reduce((sum, lat) => sum + lat, 0) / this.latencies.length;

    // Update percentiles
    this.updatePercentiles();

    this.checkAlerts();
  }

  /**
   * Record stream error
   */
  recordStreamError(): void {
    this.metrics.streamErrors++;
    this.metrics.lastActivity = Date.now();
    this.checkAlerts();
  }

  /**
   * Record backpressure event
   */
  recordBackpressureEvent(): void {
    this.metrics.backpressureEvents++;
    this.metrics.lastActivity = Date.now();
    this.checkAlerts();
  }

  /**
   * Record dropped chunk
   */
  recordDroppedChunk(): void {
    this.metrics.droppedChunks++;
    this.metrics.lastActivity = Date.now();
  }

  /**
   * Update resource metrics
   */
  updateResourceMetrics(memoryUsage: number, bufferSize: number, queueLength: number): void {
    this.metrics.memoryUsage = memoryUsage;
    this.metrics.bufferSize = bufferSize;
    this.metrics.queueLength = queueLength;
    this.checkAlerts();
  }

  /**
   * Get current metrics
   */
  getMetrics(): StreamingMetrics & {
    uptimeFormatted: string;
    throughputFormatted: string;
    healthStatus: StreamHealthStatus;
  } {
    const uptime = Date.now() - this.startTime;
    this.metrics.uptime = uptime;

    // Calculate throughput (bytes per second)
    const uptimeSeconds = uptime / 1000;
    this.metrics.throughput = uptimeSeconds > 0 ? this.metrics.bytesReceived / uptimeSeconds : 0;

    return {
      ...this.metrics,
      uptimeFormatted: this.formatUptime(uptime),
      throughputFormatted: this.formatThroughput(this.metrics.throughput),
      healthStatus: this.getHealthStatus(),
    };
  }

  /**
   * Get health status
   */
  getHealthStatus(): StreamHealthStatus {
    // Get current metrics without calling getMetrics() to avoid circular dependency
    const currentMetrics = { ...this.metrics };
    currentMetrics.uptime = Date.now() - this.startTime;
    const uptimeSeconds = currentMetrics.uptime / 1000;
    currentMetrics.throughput = uptimeSeconds > 0 ? currentMetrics.bytesReceived / uptimeSeconds : 0;

    const details: Record<string, any> = {};

    // Check connections
    const connectionHealth = this.checkConnectionHealth(currentMetrics);
    details.connections = connectionHealth.details;

    // Check performance
    const performanceHealth = this.checkPerformanceHealth(currentMetrics);
    details.performance = performanceHealth.details;

    // Check errors
    const errorHealth = this.checkErrorHealth(currentMetrics);
    details.errors = errorHealth.details;

    // Check resources
    const resourceHealth = this.checkResourceHealth(currentMetrics);
    details.resources = resourceHealth.details;

    // Determine overall health
    const healthScores = [connectionHealth.score, performanceHealth.score, errorHealth.score, resourceHealth.score];
    const averageScore = healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length;

    let overall: StreamHealthStatus['overall'];
    if (averageScore >= 0.8) overall = 'healthy';
    else if (averageScore >= 0.6) overall = 'degraded';
    else if (averageScore >= 0.3) overall = 'unhealthy';
    else overall = 'critical';

    return {
      overall,
      connections: connectionHealth.status as StreamHealthStatus['connections'],
      performance: performanceHealth.status as StreamHealthStatus['performance'],
      errors: errorHealth.status as StreamHealthStatus['errors'],
      resources: resourceHealth.status as StreamHealthStatus['resources'],
      details,
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      activeConnections: this.metrics.activeConnections, // Keep active connections
      totalConnections: 0,
      connectionErrors: 0,
      connectionTimeouts: 0,
      bytesReceived: 0,
      bytesSent: 0,
      chunksReceived: 0,
      chunksSent: 0,
      averageChunkSize: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      throughput: 0,
      streamErrors: 0,
      backpressureEvents: 0,
      droppedChunks: 0,
      memoryUsage: this.metrics.memoryUsage,
      bufferSize: this.metrics.bufferSize,
      queueLength: this.metrics.queueLength,
      uptime: 0,
      lastActivity: Date.now(),
      peakConcurrentStreams: this.metrics.peakConcurrentStreams,
    };

    this.latencies = [];
    this.startTime = Date.now();

    logger.info('Streaming metrics reset');
  }

  /**
   * Update alert configuration
   */
  updateAlertConfig(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
    logger.info('Alert configuration updated', { config: this.alertConfig });
  }

  /**
   * Check and trigger alerts
   */
  private checkAlerts(): void {
    if (!this.alertConfig.enabled) return;

    const now = Date.now();
    if (now - this.lastAlertTime < this.alertCooldown) return;

    const metrics = this.getMetrics();
    const alerts: string[] = [];

    // Error rate alert
    const errorRate = (metrics.streamErrors / Math.max(1, metrics.uptime / 60000)); // errors per minute
    if (errorRate > this.alertConfig.errorRateThreshold) {
      alerts.push(`High error rate: ${errorRate.toFixed(2)} errors/min`);
    }

    // Latency alert
    if (metrics.p95Latency > this.alertConfig.latencyThreshold) {
      alerts.push(`High latency: P95 ${metrics.p95Latency.toFixed(0)}ms`);
    }

    // Memory alert
    if (metrics.memoryUsage > this.alertConfig.memoryThreshold) {
      alerts.push(`High memory usage: ${metrics.memoryUsage.toFixed(1)}%`);
    }

    // Connection alert
    if (metrics.activeConnections > this.alertConfig.connectionThreshold) {
      alerts.push(`High connection count: ${metrics.activeConnections}`);
    }

    // Backpressure alert
    const backpressureRate = (metrics.backpressureEvents / Math.max(1, metrics.uptime / 60000));
    if (backpressureRate > this.alertConfig.backpressureThreshold) {
      alerts.push(`High backpressure: ${backpressureRate.toFixed(2)} events/min`);
    }

    if (alerts.length > 0) {
      this.lastAlertTime = now;
      this.emit('alert', {
        timestamp: now,
        alerts,
        metrics: this.getMetrics(),
      });

      logger.warn('Streaming alerts triggered', { alerts });
    }
  }

  /**
   * Update latency percentiles
   */
  private updatePercentiles(): void {
    if (this.latencies.length === 0) return;

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    this.metrics.p95Latency = sorted[p95Index] || 0;
    this.metrics.p99Latency = sorted[p99Index] || 0;
  }

  /**
   * Check connection health
   */
  private checkConnectionHealth(metrics: any): { status: string; score: number; details: any } {
    const errorRate = metrics.connectionErrors / Math.max(1, metrics.totalConnections);
    const timeoutRate = metrics.connectionTimeouts / Math.max(1, metrics.totalConnections);

    let status: string;
    let score: number;

    if (errorRate < 0.01 && timeoutRate < 0.05) {
      status = 'healthy';
      score = 1.0;
    } else if (errorRate < 0.05 && timeoutRate < 0.1) {
      status = 'degraded';
      score = 0.7;
    } else if (errorRate < 0.1 && timeoutRate < 0.2) {
      status = 'unhealthy';
      score = 0.4;
    } else {
      status = 'unhealthy';
      score = 0.1;
    }

    return {
      status,
      score,
      details: { errorRate, timeoutRate, activeConnections: metrics.activeConnections }
    };
  }

  /**
   * Check performance health
   */
  private checkPerformanceHealth(metrics: any): { status: string; score: number; details: any } {
    const highLatency = metrics.p95Latency > 2000;
    const lowThroughput = metrics.throughput < 1000; // Less than 1KB/s

    let status: string;
    let score: number;

    if (!highLatency && !lowThroughput) {
      status = 'healthy';
      score = 1.0;
    } else if (!highLatency || !lowThroughput) {
      status = 'degraded';
      score = 0.7;
    } else {
      status = 'unhealthy';
      score = 0.4;
    }

    return {
      status,
      score,
      details: {
        p95Latency: metrics.p95Latency,
        throughput: metrics.throughput,
        averageLatency: metrics.averageLatency
      }
    };
  }

  /**
   * Check error health
   */
  private checkErrorHealth(metrics: any): { status: string; score: number; details: any } {
    const errorRate = metrics.streamErrors / Math.max(1, metrics.chunksReceived);
    const backpressureRate = metrics.backpressureEvents / Math.max(1, metrics.chunksReceived);

    let status: string;
    let score: number;

    if (errorRate < 0.001 && backpressureRate < 0.01) {
      status = 'healthy';
      score = 1.0;
    } else if (errorRate < 0.01 && backpressureRate < 0.05) {
      status = 'degraded';
      score = 0.7;
    } else if (errorRate < 0.05 && backpressureRate < 0.1) {
      status = 'unhealthy';
      score = 0.4;
    } else {
      status = 'unhealthy';
      score = 0.1;
    }

    return {
      status,
      score,
      details: { errorRate, backpressureRate, droppedChunks: metrics.droppedChunks }
    };
  }

  /**
   * Check resource health
   */
  private checkResourceHealth(metrics: any): { status: string; score: number; details: any } {
    const highMemory = metrics.memoryUsage > 80;
    const highBuffer = metrics.bufferSize > 100 * 1024 * 1024; // 100MB
    const longQueue = metrics.queueLength > 1000;

    let status: string;
    let score: number;

    if (!highMemory && !highBuffer && !longQueue) {
      status = 'healthy';
      score = 1.0;
    } else if ([highMemory, highBuffer, longQueue].filter(Boolean).length === 1) {
      status = 'degraded';
      score = 0.7;
    } else {
      status = 'unhealthy';
      score = 0.4;
    }

    return {
      status,
      score,
      details: {
        memoryUsage: metrics.memoryUsage,
        bufferSize: metrics.bufferSize,
        queueLength: metrics.queueLength
      }
    };
  }

  /**
   * Format uptime duration
   */
  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Format throughput
   */
  private formatThroughput(bytesPerSecond: number): string {
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let value = bytesPerSecond;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      this.updateResourceMetrics(
        (memUsage.heapUsed / memUsage.heapTotal) * 100,
        0, // Buffer size would come from streaming handlers
        0  // Queue length would come from streaming handlers
      );
    }, 30000); // Update every 30 seconds
  }

  /**
   * Stop metrics collection and cleanup
   */
  public cleanup(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    this.removeAllListeners();
  }
}

// Export singleton instance
export const streamingMetricsCollector = new StreamingMetricsCollector();
