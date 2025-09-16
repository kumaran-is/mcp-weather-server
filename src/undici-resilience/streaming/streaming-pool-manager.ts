/**
 * Streaming pool manager for optimized connection reuse in streaming scenarios
 * Integrates backpressure handling with connection pooling for high-performance streaming
 */

import { Pool } from 'undici';
import { logger } from '../../logger-pino';
import { BackpressureHandler, BackpressureConfig, backpressurePoolManager } from './backpressure-handler';
import { streamingMetricsCollector } from './streaming-metrics';

export interface StreamingPoolConfig {
  connections: number;
  pipelining: number;
  keepAliveTimeout: number;
  keepAliveMaxTimeout: number;
  connectTimeout: number;
  bodyTimeout: number;
  headersTimeout: number;
  backpressure: BackpressureConfig;
  maxConcurrentStreams: number;
  streamTimeout: number;
  enableMetrics: boolean;
}

export interface StreamRequest {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  signal?: AbortSignal;
  timeout?: number;
}

export interface StreamResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  latency: number;
}

export class StreamingPoolManager {
  private pools = new Map<string, Pool>();
  private poolUrls = new Map<string, string>();
  private streamHandlers = new Map<string, BackpressureHandler>();
  private activeStreams = new Map<string, AbortController>();

  constructor(private config: StreamingPoolConfig) {}

  /**
   * Create a streaming-optimized pool
   */
  createStreamingPool(name: string, origin: string, config?: Partial<StreamingPoolConfig>): Pool {
    const poolConfig = { ...this.config, ...config };

    // Create optimized pool for streaming
    const pool = new Pool(origin, {
      connections: poolConfig.connections,
      pipelining: poolConfig.pipelining,
      keepAliveTimeout: poolConfig.keepAliveTimeout,
      keepAliveMaxTimeout: poolConfig.keepAliveMaxTimeout,
      connectTimeout: poolConfig.connectTimeout,
      bodyTimeout: poolConfig.bodyTimeout,
      headersTimeout: poolConfig.headersTimeout,
    });

    // Store pool reference
    this.pools.set(name, pool);

    // Setup pool event handlers
    this.setupPoolEventHandlers(name, pool);

    logger.info('Streaming pool created', {
      pool: name,
      origin,
      connections: poolConfig.connections,
      maxConcurrentStreams: poolConfig.maxConcurrentStreams
    });

    return pool;
  }

  /**
   * Execute a streaming request with backpressure handling
   */
  async executeStreamRequest(
    poolName: string,
    request: StreamRequest,
    context?: string
  ): Promise<StreamResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Record connection attempt
      if (this.config.enableMetrics) {
        streamingMetricsCollector.recordConnectionEstablished();
      }

      // Get or create backpressure handler for this pool
      const handler = this.getBackpressureHandler(poolName);

      // Create abort controller for this request
      const abortController = new AbortController();
      this.activeStreams.set(requestId, abortController);

      // Merge signals if provided
      const signal = this.mergeSignals(request.signal, abortController.signal);

      // Execute request with backpressure handling
      await handler.handleChunk(Buffer.from(JSON.stringify({
        id: requestId,
        request,
        context
      })));

      // Make the actual HTTP request
      const responseBuffer = await this.makeHttpRequest(poolName, request);

      // Process the response
      const result = await this.processStreamResponse(poolName, request, responseBuffer, startTime);

      // Record successful request
      if (this.config.enableMetrics) {
        streamingMetricsCollector.recordDataReceived(result.body?.length || 0);
        streamingMetricsCollector.recordLatency(Date.now() - startTime);
      }

      return result;

    } catch (error) {
      // Record error metrics
      if (this.config.enableMetrics) {
        streamingMetricsCollector.recordStreamError();
        streamingMetricsCollector.recordLatency(Date.now() - startTime);
      }

      logger.error('Streaming request failed', {
        error: (error as Error).message,
        pool: poolName,
        requestId,
        context,
        latency: Date.now() - startTime
      });

      throw error;
    } finally {
      // Clean up
      this.activeStreams.delete(requestId);
    }
  }

  /**
   * Execute multiple streaming requests in parallel with backpressure
   */
  async executeBatchRequests(
    poolName: string,
    requests: StreamRequest[],
    context?: string
  ): Promise<StreamResponse[]> {
    const batchStartTime = Date.now();
    const batchId = this.generateBatchId();

    logger.info('Starting batch streaming requests', {
      batchId,
      pool: poolName,
      requestCount: requests.length,
      context
    });

    try {
      // Get backpressure handler
      const handler = this.getBackpressureHandler(poolName);

      // Process requests with controlled concurrency
      const results = await this.processBatchWithConcurrency(
        requests,
        async (request, index) => {
          const requestStartTime = Date.now();

          try {
            const response = await this.executeStreamRequest(poolName, request, `${context}-batch-${index}`);
            return response;
          } catch (error) {
            logger.warn('Batch request failed', {
              error: (error as Error).message,
              batchId,
              requestIndex: index,
              latency: Date.now() - requestStartTime
            });

            throw error;
          }
        },
        this.config.maxConcurrentStreams
      );

      const totalLatency = Date.now() - batchStartTime;

      logger.info('Batch streaming requests completed', {
        batchId,
        pool: poolName,
        completed: results.length,
        totalLatency,
        averageLatency: totalLatency / results.length
      });

      return results;

    } catch (error) {
      logger.error('Batch streaming requests failed', {
        error: (error as Error).message,
        batchId,
        pool: poolName,
        context
      });

      throw error;
    }
  }

  /**
   * Cancel all active streams for a pool
   */
  cancelActiveStreams(poolName: string): void {
    const cancelledStreams: string[] = [];

    for (const [requestId, controller] of this.activeStreams) {
      if (requestId.startsWith(`${poolName}-`)) {
        controller.abort();
        cancelledStreams.push(requestId);
      }
    }

    // Remove cancelled streams
    cancelledStreams.forEach(id => this.activeStreams.delete(id));

    logger.info('Active streams cancelled', {
      pool: poolName,
      cancelledCount: cancelledStreams.length
    });
  }

  /**
   * Get streaming metrics for a pool
   */
  getStreamingMetrics(poolName: string) {
    const handler = this.streamHandlers.get(poolName);

    return {
      poolName,
      handlerMetrics: handler?.getMetrics() || null,
      activeStreams: Array.from(this.activeStreams.keys())
        .filter(id => id.startsWith(`${poolName}-`)).length,
    };
  }

  /**
   * Update streaming configuration
   */
  updateStreamingConfig(poolName: string, config: Partial<StreamingPoolConfig>): void {
    // Update pool configuration
    if (config.connections || config.pipelining) {
      const pool = this.pools.get(poolName);
      if (pool) {
        // Note: undici pools don't support runtime reconfiguration
        // This would require recreating the pool
        logger.warn('Pool reconfiguration requires restart', { pool: poolName });
      }
    }

    // Update backpressure configuration
    const handler = this.streamHandlers.get(poolName);
    if (handler && config.backpressure) {
      handler.updateConfig(config.backpressure);
    }

    logger.info('Streaming configuration updated', { pool: poolName, config });
  }

  /**
   * Shutdown streaming pool manager
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down streaming pool manager');

    // Cancel all active streams
    for (const poolName of this.pools.keys()) {
      this.cancelActiveStreams(poolName);
    }

    // Shutdown all backpressure handlers
    await backpressurePoolManager.shutdown();

    // Close all pools
    for (const [poolName, pool] of this.pools) {
      try {
        await pool.close();
        logger.debug('Pool closed', { pool: poolName });
      } catch (error) {
        logger.error('Error closing pool', { pool: poolName, error: (error as Error).message });
      }
    }

    // Clear all handlers
    this.streamHandlers.clear();
    this.activeStreams.clear();
    this.pools.clear();

    logger.info('Streaming pool manager shutdown complete');
  }

  /**
   * Get or create backpressure handler for a pool
   */
  private getBackpressureHandler(poolName: string): BackpressureHandler {
    if (!this.streamHandlers.has(poolName)) {
      const handler = backpressurePoolManager.getHandler(
        poolName,
        this.config.backpressure,
        async (chunk: Buffer) => {
          // Process the chunk by making the actual HTTP request
          const requestData = JSON.parse(chunk.toString());
          await this.makeHttpRequest(poolName, requestData.request);
          // Processor should return void
        }
      );

      this.streamHandlers.set(poolName, handler);

      // Setup handler event listeners
      handler.on('backpressure', (data) => {
        if (this.config.enableMetrics) {
          streamingMetricsCollector.recordBackpressureEvent();
        }

        logger.debug('Backpressure applied', { pool: poolName, ...data });
      });

      handler.on('resume', (data) => {
        logger.debug('Processing resumed', { pool: poolName, ...data });
      });

      handler.on('error', (error) => {
        logger.error('Backpressure handler error', { pool: poolName, error: (error as Error).message });
      });
    }

    return this.streamHandlers.get(poolName)!;
  }

  /**
   * Make the actual HTTP request
   */
  private async makeHttpRequest(poolName: string, request: StreamRequest): Promise<Buffer> {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool '${poolName}' not found`);
    }

    const startTime = Date.now();

    try {
      const response = await pool.request({
        method: (request.method || 'GET') as any, // Cast to any to avoid HttpMethod type issues
        path: request.path,
        headers: request.headers,
        body: request.body,
        signal: request.signal,
        bodyTimeout: request.timeout || this.config.streamTimeout,
        headersTimeout: this.config.headersTimeout,
      });

      // Read response body
      const chunks: Uint8Array[] = [];
      const body = response.body as any; // Cast to any to access body

      for await (const chunk of body) {
        chunks.push(chunk);
      }

      const responseBody = Buffer.concat(chunks as any);

      // Record metrics
      if (this.config.enableMetrics) {
        streamingMetricsCollector.recordDataSent(responseBody.length);
      }

      return responseBody;

    } catch (error) {
      // Record error metrics
      if (this.config.enableMetrics) {
        if ((error as any).code === 'UND_ERR_CONNECT_TIMEOUT') {
          streamingMetricsCollector.recordConnectionTimeout();
        } else {
          streamingMetricsCollector.recordConnectionError();
        }
      }

      throw error;
    }
  }

  /**
   * Process streaming response
   */
  private async processStreamResponse(
    poolName: string,
    request: StreamRequest,
    response: Buffer,
    startTime: number
  ): Promise<StreamResponse> {
    try {
      // Parse response (assuming JSON for now)
      const responseData = JSON.parse(response.toString());

      return {
        statusCode: responseData.statusCode || 200,
        headers: responseData.headers || {},
        body: responseData.body || responseData,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      // If not JSON, return raw response
      return {
        statusCode: 200,
        headers: {},
        body: response,
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * Process batch requests with controlled concurrency
   */
  private async processBatchWithConcurrency<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    concurrency: number
  ): Promise<R[]> {
    const results: R[] = [];
    const errors: Error[] = [];

    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchPromises = batch.map((item, batchIndex) =>
        processor(item, i + batchIndex).catch(error => {
          errors.push(error);
          return null as R;
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(result => result !== null));
    }

    if (errors.length > 0) {
      logger.warn('Some batch requests failed', { errorCount: errors.length });
    }

    return results;
  }

  /**
   * Merge abort signals
   */
  private mergeSignals(signal1?: AbortSignal, signal2?: AbortSignal): AbortSignal | undefined {
    if (!signal1 && !signal2) return undefined;
    if (signal1 && !signal2) return signal1;
    if (!signal1 && signal2) return signal2;

    // Create a new signal that aborts when either input signal aborts
    const mergedController = new AbortController();

    const abortHandler = () => {
      mergedController.abort();
      signal1?.removeEventListener('abort', abortHandler);
      signal2?.removeEventListener('abort', abortHandler);
    };

    signal1?.addEventListener('abort', abortHandler);
    signal2?.addEventListener('abort', abortHandler);

    return mergedController.signal;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup pool event handlers
   */
  private setupPoolEventHandlers(poolName: string, pool: Pool): void {
    // Note: undici Pool doesn't have event handlers in the current version
    // This is a placeholder for future versions or custom implementations
    logger.debug('Pool event handlers setup (placeholder)', { pool: poolName });
  }
}

// Export singleton instance
export const streamingPoolManagerInstance = new StreamingPoolManager({
  // Default streaming configuration
  connections: 50,
  pipelining: 10,
  keepAliveTimeout: 60000,
  keepAliveMaxTimeout: 600000,
  connectTimeout: 10000,
  bodyTimeout: 300000,
  headersTimeout: 30000,

  backpressure: {
    highWaterMark: 1024 * 1024, // 1MB
    lowWaterMark: 512 * 1024,   // 512KB
    maxBufferSize: 10 * 1024 * 1024, // 10MB
    timeout: 30000, // 30 seconds
    adaptive: true,
  },

  maxConcurrentStreams: 10,
  streamTimeout: 60000, // 1 minute
  enableMetrics: true,
});
