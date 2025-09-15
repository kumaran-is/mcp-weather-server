/**
 * Advanced backpressure handling for streaming responses
 * Ensures optimal performance and prevents memory issues during high-throughput streaming
 */

import { logger } from '../../logger-pino';
import { EventEmitter } from 'events';

export interface BackpressureConfig {
  /** High water mark for buffer size */
  highWaterMark: number;
  /** Low water mark for resuming flow */
  lowWaterMark: number;
  /** Maximum buffer size before dropping data */
  maxBufferSize: number;
  /** Backpressure timeout in milliseconds */
  timeout: number;
  /** Enable adaptive backpressure */
  adaptive: boolean;
}

export interface StreamMetrics {
  bytesProcessed: number;
  chunksProcessed: number;
  backpressureEvents: number;
  droppedChunks: number;
  averageChunkSize: number;
  peakBufferSize: number;
  totalProcessingTime: number;
}

export class BackpressureHandler extends EventEmitter {
  private buffer: Buffer[] = [];
  private isPaused = false;
  private metrics: StreamMetrics = {
    bytesProcessed: 0,
    chunksProcessed: 0,
    backpressureEvents: 0,
    droppedChunks: 0,
    averageChunkSize: 0,
    peakBufferSize: 0,
    totalProcessingTime: 0,
  };

  private processingStartTime = 0;
  private adaptiveThreshold = 0.8; // 80% of high water mark

  constructor(
    private config: BackpressureConfig,
    private processor: (chunk: Buffer) => Promise<void>
  ) {
    super();
    this.setupEventHandlers();
  }

  /**
   * Handle incoming data chunk with backpressure management
   */
  async handleChunk(chunk: Buffer): Promise<void> {
    const startTime = Date.now();

    // Update metrics
    this.metrics.chunksProcessed++;
    this.metrics.bytesProcessed += chunk.length;
    this.metrics.averageChunkSize = this.metrics.bytesProcessed / this.metrics.chunksProcessed;

    // Check if we need to apply backpressure
    if (this.shouldApplyBackpressure()) {
      await this.applyBackpressure();
    }

    // Add chunk to buffer
    this.buffer.push(chunk);
    this.metrics.peakBufferSize = Math.max(this.metrics.peakBufferSize, this.getBufferSize());

    // Process buffer if not paused
    if (!this.isPaused) {
      await this.processBuffer();
    }

    this.metrics.totalProcessingTime += Date.now() - startTime;
  }

  /**
   * Process buffered chunks
   */
  private async processBuffer(): Promise<void> {
    while (this.buffer.length > 0 && !this.isPaused) {
      const chunk = this.buffer.shift()!;

      try {
        this.processingStartTime = Date.now();
        await this.processor(chunk);
      } catch (error) {
        logger.error('Error processing chunk', {
          error: (error as Error).message,
          chunkSize: chunk.length,
          bufferSize: this.buffer.length
        });

        this.emit('error', error);
      }
    }

    // Check if we can resume flow
    if (this.isPaused && this.getBufferSize() <= this.config.lowWaterMark) {
      this.resume();
    }
  }

  /**
   * Apply backpressure by pausing processing
   */
  private async applyBackpressure(): Promise<void> {
    if (this.isPaused) return;

    this.isPaused = true;
    this.metrics.backpressureEvents++;

    logger.warn('Applying backpressure - pausing processing', {
      bufferSize: this.getBufferSize(),
      highWaterMark: this.config.highWaterMark,
      chunksInBuffer: this.buffer.length
    });

    this.emit('backpressure', {
      bufferSize: this.getBufferSize(),
      highWaterMark: this.config.highWaterMark,
      timestamp: Date.now()
    });

    // Wait for buffer to drain or timeout
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        logger.warn('Backpressure timeout - forcing resume');
        this.resume();
        resolve();
      }, this.config.timeout);
    });

    const drainPromise = new Promise<void>((resolve) => {
      this.once('drain', resolve);
    });

    await Promise.race([timeoutPromise, drainPromise]);
  }

  /**
   * Resume processing after backpressure
   */
  private resume(): void {
    if (!this.isPaused) return;

    this.isPaused = false;

    logger.info('Resuming processing after backpressure', {
      bufferSize: this.getBufferSize(),
      lowWaterMark: this.config.lowWaterMark
    });

    this.emit('resume', {
      bufferSize: this.getBufferSize(),
      timestamp: Date.now()
    });

    // Process remaining buffer
    this.processBuffer().catch(error => {
      logger.error('Error processing buffer after resume', { error: error.message });
      this.emit('error', error);
    });
  }

  /**
   * Check if backpressure should be applied
   */
  private shouldApplyBackpressure(): boolean {
    const bufferSize = this.getBufferSize();

    if (this.config.adaptive) {
      // Adaptive backpressure based on processing speed
      const processingRate = this.calculateProcessingRate();
      const adaptiveThreshold = this.config.highWaterMark * this.adaptiveThreshold;

      return bufferSize > adaptiveThreshold || processingRate < 0.5; // Processing too slow
    }

    return bufferSize > this.config.highWaterMark;
  }

  /**
   * Calculate processing rate (chunks per second)
   */
  private calculateProcessingRate(): number {
    if (this.metrics.chunksProcessed === 0) return 1;

    const elapsed = Date.now() - this.processingStartTime;
    if (elapsed === 0) return 1;

    return (this.metrics.chunksProcessed / elapsed) * 1000;
  }

  /**
   * Get current buffer size in bytes
   */
  private getBufferSize(): number {
    return this.buffer.reduce((total, chunk) => total + chunk.length, 0);
  }

  /**
   * Force drain buffer (for emergency cleanup)
   */
  forceDrain(): void {
    const drainedChunks = this.buffer.length;
    const drainedBytes = this.getBufferSize();

    this.buffer = [];
    this.isPaused = false;

    logger.warn('Force draining buffer', {
      drainedChunks,
      drainedBytes
    });

    this.emit('force-drain', {
      drainedChunks,
      drainedBytes,
      timestamp: Date.now()
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): StreamMetrics & {
    currentBufferSize: number;
    isPaused: boolean;
    processingRate: number;
  } {
    return {
      ...this.metrics,
      currentBufferSize: this.getBufferSize(),
      isPaused: this.isPaused,
      processingRate: this.calculateProcessingRate()
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BackpressureConfig>): void {
    this.config = { ...this.config, ...newConfig };

    logger.info('Backpressure configuration updated', {
      newConfig: this.config
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('error', (error) => {
      logger.error('Backpressure handler error', { error: error.message });
    });

    this.on('backpressure', (data) => {
      logger.debug('Backpressure applied', data);
    });

    this.on('resume', (data) => {
      logger.debug('Processing resumed', data);
    });

    this.on('drain', () => {
      logger.debug('Buffer drained');
    });
  }

  /**
   * Clean shutdown
   */
  async shutdown(): Promise<void> {
    this.forceDrain();
    this.removeAllListeners();

    logger.info('Backpressure handler shut down');
  }
}

/**
 * Backpressure pool manager for managing multiple backpressure handlers
 */
export class BackpressurePoolManager {
  private handlers = new Map<string, BackpressureHandler>();
  private poolMetrics = new Map<string, StreamMetrics>();

  /**
   * Create or get a backpressure handler for a stream
   */
  getHandler(
    streamId: string,
    config: BackpressureConfig,
    processor: (chunk: Buffer) => Promise<void>
  ): BackpressureHandler {
    if (!this.handlers.has(streamId)) {
      const handler = new BackpressureHandler(config, processor);
      this.handlers.set(streamId, handler);

      // Track metrics
      handler.on('backpressure', () => this.updatePoolMetrics());
      handler.on('resume', () => this.updatePoolMetrics());
      handler.on('error', () => this.updatePoolMetrics());
    }

    return this.handlers.get(streamId)!;
  }

  /**
   * Remove a handler
   */
  removeHandler(streamId: string): void {
    const handler = this.handlers.get(streamId);
    if (handler) {
      handler.shutdown().catch(error => {
        logger.error('Error shutting down handler', { error: error.message, streamId });
      });
      this.handlers.delete(streamId);
      this.poolMetrics.delete(streamId);
    }
  }

  /**
   * Get pool-wide metrics
   */
  getPoolMetrics(): {
    totalStreams: number;
    activeStreams: number;
    totalBytesProcessed: number;
    totalBackpressureEvents: number;
    averageProcessingRate: number;
    streams: Record<string, StreamMetrics>;
  } {
    const streams = Object.fromEntries(this.poolMetrics);
    const totalStreams = this.handlers.size;
    const activeStreams = Array.from(this.handlers.values())
      .filter(h => !h.getMetrics().isPaused).length;

    const totals = Array.from(this.poolMetrics.values())
      .reduce((acc, metrics) => ({
        bytesProcessed: acc.bytesProcessed + metrics.bytesProcessed,
        backpressureEvents: acc.backpressureEvents + metrics.backpressureEvents,
        processingRate: acc.processingRate + (metrics.totalProcessingTime > 0 ?
          metrics.chunksProcessed / (metrics.totalProcessingTime / 1000) : 0)
      }), { bytesProcessed: 0, backpressureEvents: 0, processingRate: 0 });

    return {
      totalStreams,
      activeStreams,
      totalBytesProcessed: totals.bytesProcessed,
      totalBackpressureEvents: totals.backpressureEvents,
      averageProcessingRate: totals.processingRate / Math.max(totalStreams, 1),
      streams
    };
  }

  /**
   * Update pool metrics
   */
  private updatePoolMetrics(): void {
    for (const [streamId, handler] of this.handlers) {
      this.poolMetrics.set(streamId, handler.getMetrics());
    }
  }

  /**
   * Shutdown all handlers
   */
  async shutdown(): Promise<void> {
    const shutdownPromises = Array.from(this.handlers.entries())
      .map(async ([streamId, handler]) => {
        try {
          await handler.shutdown();
        } catch (error) {
          logger.error('Error shutting down handler', { error: (error as Error).message, streamId });
        }
      });

    await Promise.all(shutdownPromises);
    this.handlers.clear();
    this.poolMetrics.clear();

    logger.info('Streaming pool manager shut down');
  }
}

// Export singleton instance
export const backpressurePoolManager = new BackpressurePoolManager();
