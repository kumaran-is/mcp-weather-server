/**
 * Retry strategy with exponential backoff and jitter
 * Implements intelligent retry logic to prevent thundering herd problems
 */

import { logger } from '../logger.js';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitterFactor: number;
}

export interface RetryAttempt {
  attempt: number;
  delay: number;
  totalDelay: number;
  error: Error;
}

export class RetryStrategy {
  constructor(private config: RetryConfig) {
    this.validateConfig();
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: Error | null = null;
    let totalDelay = 0;

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        if (attempt > 1) {
          logger.debug({
            attempt,
            maxRetries: this.config.maxRetries,
            context
          }, 'Retrying operation');
        }

        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt > this.config.maxRetries + 1) {
          break;
        }

        const delay = this.calculateDelay(attempt);
        totalDelay += delay;

        logger.warn({
          attempt,
          maxRetries: this.config.maxRetries,
          delay,
          totalDelay,
          error: lastError.message,
          context
        }, 'Operation failed, retrying');

        await this.sleep(delay);
      }
    }

    if (!lastError) {
      throw new Error('Unexpected error: no error captured during retries');
    }

    logger.error({
      attempts: this.config.maxRetries + 1,
      totalDelay,
      finalError: lastError.message,
      context
    }, 'All retry attempts exhausted');

    throw lastError;
  }

  /**
   * Calculate delay for exponential backoff with jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * 2^(attempt - 1)
    const exponentialDelay = this.config.baseDelay * Math.pow(2, attempt - 1);

    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * this.config.jitterFactor * Math.random();

    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate retry configuration
   */
  private validateConfig(): void {
    if (this.config.maxRetries < 0) {
      throw new Error('maxRetries cannot be negative');
    }
    if (this.config.baseDelay < 0) {
      throw new Error('baseDelay cannot be negative');
    }
    if (this.config.maxDelay < this.config.baseDelay) {
      throw new Error('maxDelay must be greater than or equal to baseDelay');
    }
    if (this.config.jitterFactor < 0 || this.config.jitterFactor > 1) {
      throw new Error('jitterFactor must be between 0 and 1');
    }
  }

  /**
   * Get retry configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Update retry configuration
   */
  updateConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.validateConfig();
  }
}

/**
 * Pre-configured retry strategies for different use cases
 */
export class RetryStrategies {
  /**
   * Aggressive retry strategy for fast-failing operations
   */
  static aggressive(): RetryStrategy {
    return new RetryStrategy({
      maxRetries: 5,
      baseDelay: 100,
      maxDelay: 2000,
      jitterFactor: 0.1,
    });
  }

  /**
   * Conservative retry strategy for slow operations
   */
  static conservative(): RetryStrategy {
    return new RetryStrategy({
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      jitterFactor: 0.2,
    });
  }

  /**
   * Network-specific retry strategy
   */
  static network(): RetryStrategy {
    return new RetryStrategy({
      maxRetries: 4,
      baseDelay: 500,
      maxDelay: 8000,
      jitterFactor: 0.15,
    });
  }

  /**
   * API-specific retry strategy
   */
  static api(): RetryStrategy {
    return new RetryStrategy({
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 15000,
      jitterFactor: 0.25,
    });
  }

  /**
   * Custom retry strategy
   */
  static custom(config: RetryConfig): RetryStrategy {
    return new RetryStrategy(config);
  }
}

/**
 * Utility function for simple retry with default strategy
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  context?: string
): Promise<T> {
  const strategy = new RetryStrategy({
    maxRetries,
    baseDelay: 1000,
    maxDelay: 10000,
    jitterFactor: 0.1,
  });

  return strategy.execute(fn, context);
}
