/**
 * Centralized configuration management for MCP Weather Server
 * Environment-based configuration with validation and type safety
 */

import { z } from 'zod';
import { logger } from '../logger-pino.js';

// Environment variable schema
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MCP_TRANSPORT: z.enum(['stdio', 'http', 'sse']).default('stdio'),
  MCP_HTTP_PORT: z.coerce.number().min(1024).max(65535).default(8080),
  MCP_SSE_PORT: z.coerce.number().min(1024).max(65535).default(8081),

  // Open-Meteo API Configuration
  OPEN_METEO_BASE_URL: z.string().url().default('https://api.open-meteo.com/v1'),
  GEOCODING_API_URL: z.string().url().default('https://geocoding-api.open-meteo.com/v1'),

  // Security Configuration
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:8080'),

  // Logging Configuration
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Performance Configuration
  API_TIMEOUT: z.coerce.number().min(1000).max(60000).default(5000),
  HTTP_TIMEOUT: z.coerce.number().min(5000).max(300000).default(30000),
  REQUEST_TIMEOUT: z.coerce.number().min(5000).max(300000).default(60000),

  // Resilience Configuration
  CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().min(1).max(20).default(5),
  CIRCUIT_BREAKER_TIMEOUT: z.coerce.number().min(10000).max(300000).default(60000),
  MAX_RETRIES: z.coerce.number().min(0).max(10).default(3),
  BASE_RETRY_DELAY: z.coerce.number().min(100).max(10000).default(1000),

  // Streaming Configuration
  MAX_CONCURRENT_STREAMS: z.coerce.number().min(1).max(100).default(10),
  STREAM_TIMEOUT: z.coerce.number().min(10000).max(300000).default(60000),
  BACKPRESSURE_HIGH_WATER_MARK: z.coerce.number().min(1024).max(10485760).default(1048576),
  BACKPRESSURE_LOW_WATER_MARK: z.coerce.number().min(512).max(5242880).default(524288),
});

// Parse and validate environment variables
let envConfig: z.infer<typeof envSchema>;

try {
  envConfig = envSchema.parse(process.env);
  logger.info('Configuration loaded successfully', envConfig);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.fatal('Configuration validation failed', { error: errorMessage });
  throw new Error(`Configuration validation failed: ${errorMessage}`);
}

// Configuration interfaces
export interface ServerConfig {
  nodeEnv: string;
  transport: 'stdio' | 'http' | 'sse';
  httpPort: number;
  ssePort: number;
}

export interface APIConfig {
  baseUrl: string;
  geocodingUrl: string;
  timeout: number;
  retries: number;
  retryDelay: number;
}

export interface SecurityConfig {
  allowedOrigins: string[];
}

export interface LoggingConfig {
  level: string;
}

export interface PerformanceConfig {
  apiTimeout: number;
  httpTimeout: number;
  requestTimeout: number;
}

export interface ResilienceConfig {
  circuitBreaker: {
    threshold: number;
    timeout: number;
  };
  retry: {
    maxRetries: number;
    baseDelay: number;
  };
}

export interface StreamingConfig {
  maxConcurrentStreams: number;
  streamTimeout: number;
  backpressure: {
    highWaterMark: number;
    lowWaterMark: number;
  };
}

export interface AppConfig {
  server: ServerConfig;
  api: APIConfig;
  security: SecurityConfig;
  logging: LoggingConfig;
  performance: PerformanceConfig;
  resilience: ResilienceConfig;
  streaming: StreamingConfig;
}

// Build configuration object
export const config: AppConfig = {
  server: {
    nodeEnv: envConfig.NODE_ENV,
    transport: envConfig.MCP_TRANSPORT,
    httpPort: envConfig.MCP_HTTP_PORT,
    ssePort: envConfig.MCP_SSE_PORT,
  },
  api: {
    baseUrl: envConfig.OPEN_METEO_BASE_URL,
    geocodingUrl: envConfig.GEOCODING_API_URL,
    timeout: envConfig.API_TIMEOUT,
    retries: envConfig.MAX_RETRIES,
    retryDelay: envConfig.BASE_RETRY_DELAY,
  },
  security: {
    allowedOrigins: envConfig.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()),
  },
  logging: {
    level: envConfig.LOG_LEVEL,
  },
  performance: {
    apiTimeout: envConfig.API_TIMEOUT,
    httpTimeout: envConfig.HTTP_TIMEOUT,
    requestTimeout: envConfig.REQUEST_TIMEOUT,
  },
  resilience: {
    circuitBreaker: {
      threshold: envConfig.CIRCUIT_BREAKER_THRESHOLD,
      timeout: envConfig.CIRCUIT_BREAKER_TIMEOUT,
    },
    retry: {
      maxRetries: envConfig.MAX_RETRIES,
      baseDelay: envConfig.BASE_RETRY_DELAY,
    },
  },
  streaming: {
    maxConcurrentStreams: envConfig.MAX_CONCURRENT_STREAMS,
    streamTimeout: envConfig.STREAM_TIMEOUT,
    backpressure: {
      highWaterMark: envConfig.BACKPRESSURE_HIGH_WATER_MARK,
      lowWaterMark: envConfig.BACKPRESSURE_LOW_WATER_MARK,
    },
  },
};

// Export individual configuration getters for backward compatibility
export const getConfig = (): AppConfig => config;

export const getServerConfig = (): ServerConfig => config.server;
export const getAPIConfig = (): APIConfig => config.api;
export const getSecurityConfig = (): SecurityConfig => config.security;
export const getLoggingConfig = (): LoggingConfig => config.logging;
export const getPerformanceConfig = (): PerformanceConfig => config.performance;
export const getResilienceConfig = (): ResilienceConfig => config.resilience;
export const getStreamingConfig = (): StreamingConfig => config.streaming;

// Transport-specific configuration
export const getTransportConfig = () => ({
  type: config.server.transport,
  port: config.server.httpPort,
  allowedOrigins: config.security.allowedOrigins,
});

// Health check configuration
export const getHealthConfig = () => ({
  checks: {
    api: {
      url: config.api.baseUrl,
      timeout: config.performance.apiTimeout,
    },
    database: false, // No database in this implementation
  },
  thresholds: {
    errorRate: 0.05, // 5% error rate threshold
    responseTime: 5000, // 5 second response time threshold
  },
});

// Export raw environment config for advanced use cases
export { envConfig as rawConfig };

// Configuration validation
export const validateConfig = (): boolean => {
  try {
    envSchema.parse(process.env);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Configuration validation failed', { error: errorMessage });
    return false;
  }
};

// Configuration summary for logging
export const getConfigSummary = () => ({
  environment: config.server.nodeEnv,
  transport: config.server.transport,
  port: config.server.httpPort,
  logLevel: config.logging.level,
  apiTimeout: config.performance.apiTimeout,
  circuitBreakerThreshold: config.resilience.circuitBreaker.threshold,
  maxRetries: config.resilience.retry.maxRetries,
});

logger.info('Configuration summary', getConfigSummary());
