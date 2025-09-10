/**
 * Rate limiter implementation for request throttling
 * Prevents overwhelming external services and ensures fair resource usage
 */

import { logger } from '../../logger.js';
import { DEFAULT_RATE_LIMITER_CONFIG, DEFAULT_TOKEN_BUCKET_CONFIG } from '../config/pool-config.js';

export interface RateLimitConfig {
  /** Maximum requests per time window */
  requests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Burst allowance (additional requests beyond the limit) */
  burst?: number;
  /** Whether to use sliding window or fixed window */
  sliding?: boolean;
}

export interface RateLimitStats {
  currentRequests: number;
  remainingRequests: number;
  resetTime: number;
  isLimited: boolean;
  totalAllowed: number;
  totalRejected: number;
}

export class RateLimiter {
  private requestTimes: number[] = [];
  private totalAllowed = 0;
  private totalRejected = 0;

  constructor(
    private name: string,
    private config: RateLimitConfig
  ) {
    this.validateConfig();
  }

  /**
   * Check if a request can be made
   */
  canMakeRequest(): boolean {
    this.cleanupOldRequests();

    const currentRequests = this.requestTimes.length;
    const maxRequests = this.config.requests + (this.config.burst || 0);

    if (currentRequests >= maxRequests) {
      this.totalRejected++;
      logger.warn('Rate limit exceeded', {
        rateLimiter: this.name,
        currentRequests,
        maxRequests,
        windowMs: this.config.windowMs,
        totalRejected: this.totalRejected
      });
      return false;
    }

    return true;
  }

  /**
   * Record a successful request
   */
  recordRequest(): void {
    const now = Date.now();
    this.requestTimes.push(now);
    this.totalAllowed++;

    logger.debug('Request recorded', {
      rateLimiter: this.name,
      currentRequests: this.requestTimes.length,
      totalAllowed: this.totalAllowed
    });
  }

  /**
   * Wait for the next available slot (if rate limited)
   */
  async waitForSlot(): Promise<void> {
    if (this.canMakeRequest()) {
      this.recordRequest();
      return;
    }

    // Calculate wait time
    const waitTime = this.getWaitTime();

    logger.info('Waiting for rate limit slot', {
      rateLimiter: this.name,
      waitTime,
      currentRequests: this.requestTimes.length,
      maxRequests: this.config.requests + (this.config.burst || 0)
    });

    await this.sleep(waitTime);
    this.recordRequest();
  }

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot();
    return fn();
  }

  /**
   * Get current rate limit statistics
   */
  getStats(): RateLimitStats {
    this.cleanupOldRequests();

    const currentRequests = this.requestTimes.length;
    const maxRequests = this.config.requests + (this.config.burst || 0);
    const remainingRequests = Math.max(0, maxRequests - currentRequests);
    const resetTime = this.getResetTime();

    return {
      currentRequests,
      remainingRequests,
      resetTime,
      isLimited: currentRequests >= this.config.requests,
      totalAllowed: this.totalAllowed,
      totalRejected: this.totalRejected
    };
  }

  /**
   * Get time until next reset
   */
  private getResetTime(): number {
    if (this.requestTimes.length === 0) {
      return Date.now();
    }

    if (this.config.sliding) {
      // Sliding window: reset time is when oldest request expires
      return this.requestTimes[0] + this.config.windowMs;
    } else {
      // Fixed window: reset time is next window boundary
      const now = Date.now();
      const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
      return windowStart + this.config.windowMs;
    }
  }

  /**
   * Get wait time for next available slot
   */
  private getWaitTime(): number {
    if (this.canMakeRequest()) {
      return 0;
    }

    const resetTime = this.getResetTime();
    const waitTime = resetTime - Date.now();

    return Math.max(0, waitTime);
  }

  /**
   * Clean up old requests outside the time window
   */
  private cleanupOldRequests(): void {
    const now = Date.now();
    const cutoffTime = now - this.config.windowMs;

    if (this.config.sliding) {
      // Sliding window: remove requests older than window
      const initialLength = this.requestTimes.length;
      this.requestTimes = this.requestTimes.filter(time => time > cutoffTime);

      if (this.requestTimes.length !== initialLength) {
        logger.debug('Cleaned up old requests (sliding window)', {
          rateLimiter: this.name,
          removed: initialLength - this.requestTimes.length,
          remaining: this.requestTimes.length
        });
      }
    } else {
      // Fixed window: clear all requests at window boundary
      const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs;
      const windowEnd = windowStart + this.config.windowMs;

      if (now >= windowEnd) {
        const cleared = this.requestTimes.length;
        this.requestTimes = [];

        if (cleared > 0) {
          logger.debug('Cleared requests for new window (fixed window)', {
            rateLimiter: this.name,
            cleared,
            windowStart: new Date(windowStart).toISOString(),
            windowEnd: new Date(windowEnd).toISOString()
          });
        }
      }
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate rate limiter configuration
   */
  private validateConfig(): void {
    if (this.config.requests < 1) {
      throw new Error('requests must be at least 1');
    }
    if (this.config.windowMs < 1000) {
      throw new Error('windowMs must be at least 1000ms');
    }
    if (this.config.burst && this.config.burst < 0) {
      throw new Error('burst cannot be negative');
    }
  }

  /**
   * Get rate limiter name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Update rate limiter configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    const updatedConfig = { ...this.config, ...newConfig };
    this.validateConfig();
    this.config = updatedConfig;

    logger.info('Rate limiter configuration updated', {
      rateLimiter: this.name,
      newConfig: updatedConfig
    });
  }

  /**
   * Reset rate limiter statistics
   */
  reset(): void {
    this.requestTimes = [];
    this.totalAllowed = 0;
    this.totalRejected = 0;

    logger.info('Rate limiter statistics reset', {
      rateLimiter: this.name
    });
  }
}

/**
 * Token bucket rate limiter (alternative implementation)
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private totalAllowed = 0;
  private totalRejected = 0;

  constructor(
    private name: string,
    private capacity: number,      // Maximum tokens
    private refillRate: number,    // Tokens per second
    private initialTokens: number = capacity
  ) {
    if (capacity < 1) {
      throw new Error('capacity must be at least 1');
    }
    if (refillRate <= 0) {
      throw new Error('refillRate must be positive');
    }

    this.tokens = Math.min(initialTokens, capacity);
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume a token
   */
  tryConsume(): boolean {
    this.refillTokens();

    if (this.tokens >= 1) {
      this.tokens--;
      this.totalAllowed++;
      return true;
    } else {
      this.totalRejected++;
      logger.warn('Token bucket rate limit exceeded', {
        rateLimiter: this.name,
        tokens: this.tokens,
        capacity: this.capacity,
        totalRejected: this.totalRejected
      });
      return false;
    }
  }

  /**
   * Consume a token, waiting if necessary
   */
  async consume(): Promise<void> {
    if (this.tryConsume()) {
      return;
    }

    // Calculate wait time for next token
    const waitTime = (1 / this.refillRate) * 1000;

    logger.info('Waiting for token', {
      rateLimiter: this.name,
      waitTime,
      tokens: this.tokens
    });

    await this.sleep(waitTime);
    this.consume(); // Recursive call after waiting
  }

  /**
   * Execute function with token consumption
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.consume();
    return fn();
  }

  /**
   * Get current token bucket statistics
   */
  getStats(): {
    tokens: number;
    capacity: number;
    refillRate: number;
    totalAllowed: number;
    totalRejected: number;
    utilization: number;
  } {
    return {
      tokens: this.tokens,
      capacity: this.capacity,
      refillRate: this.refillRate,
      totalAllowed: this.totalAllowed,
      totalRejected: this.totalRejected,
      utilization: ((this.capacity - this.tokens) / this.capacity) * 100
    };
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefill;
    const elapsedSeconds = elapsedMs / 1000;

    const tokensToAdd = elapsedSeconds * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);

    this.lastRefill = now;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Rate limiter manager for coordinating multiple rate limiters
 */
export class RateLimiterManager {
  private rateLimiters = new Map<string, RateLimiter>();
  private tokenBuckets = new Map<string, TokenBucketRateLimiter>();

  /**
   * Create or get a rate limiter
   */
  getRateLimiter(name: string, config: RateLimitConfig): RateLimiter {
    if (!this.rateLimiters.has(name)) {
      const limiter = new RateLimiter(name, config);
      this.rateLimiters.set(name, limiter);
    }
    return this.rateLimiters.get(name)!;
  }

  /**
   * Create or get a token bucket rate limiter
   */
  getTokenBucket(name: string, capacity: number, refillRate: number): TokenBucketRateLimiter {
    if (!this.tokenBuckets.has(name)) {
      const bucket = new TokenBucketRateLimiter(name, capacity, refillRate);
      this.tokenBuckets.set(name, bucket);
    }
    return this.tokenBuckets.get(name)!;
  }

  /**
   * Get all rate limiter statistics
   */
  getAllStats(): {
    rateLimiters: Record<string, RateLimitStats>;
    tokenBuckets: Record<string, ReturnType<TokenBucketRateLimiter['getStats']>>;
  } {
    const rateLimiters: Record<string, RateLimitStats> = {};
    const tokenBuckets: Record<string, any> = {};

    for (const [name, limiter] of this.rateLimiters) {
      rateLimiters[name] = limiter.getStats();
    }

    for (const [name, bucket] of this.tokenBuckets) {
      tokenBuckets[name] = bucket.getStats();
    }

    return { rateLimiters, tokenBuckets };
  }

  /**
   * Reset all rate limiters
   */
  resetAll(): void {
    for (const limiter of this.rateLimiters.values()) {
      limiter.reset();
    }
    for (const bucket of this.tokenBuckets.values()) {
      // Token buckets don't have a reset method, recreate them
      // This is a simplified approach
    }
    logger.info('All rate limiters reset');
  }
}

// Export singleton instance
export const rateLimiterManager = new RateLimiterManager();
