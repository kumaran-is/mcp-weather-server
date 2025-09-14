/**
 * Centralized configuration management for MCP Weather Server
 * Environment-based configuration with validation and type safety
 */

import { z } from 'zod';

// Environment variable schema
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MCP_TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
  MCP_HTTP_PORT: z.coerce.number().min(1024).max(65535).default(8080),

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
function parseEnvConfig(): z.infer<typeof envSchema> {
  try {
    const config = envSchema.parse(process.env);
    // Note: Using console here to avoid circular dependency with logger
    // Only log in non-test environments to reduce noise
    if (process.env.NODE_ENV !== 'test') {
      console.log('Configuration loaded successfully');
    }
    return config;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('FATAL: Configuration validation failed:', errorMessage);
    process.exit(1);
  }
}

// Initial parse to ensure valid config at startup
let envConfig = parseEnvConfig();

// Configuration interfaces
export interface ServerConfig {
  nodeEnv: string;
  transport: 'stdio' | 'http';
  httpPort: number;
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

// Build configuration object dynamically
function buildConfig(): AppConfig {
  // Re-parse env config in test environment to pick up changes
  if (process.env.NODE_ENV === 'test') {
    try {
      envConfig = envSchema.parse(process.env);
    } catch {
      envConfig = envSchema.parse({});
    }
  }

  return {
    server: {
      nodeEnv: envConfig.NODE_ENV,
      transport: envConfig.MCP_TRANSPORT,
      httpPort: envConfig.MCP_HTTP_PORT,
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
}

// Cache the config for non-test environments
let cachedConfig: AppConfig | null = null;
export const config: AppConfig = buildConfig();

// Export individual configuration getters for backward compatibility
export const getConfig = (): AppConfig => {
  // In test environment, always rebuild config to pick up env changes
  if (process.env.NODE_ENV === 'test') {
    return buildConfig();
  }

  // In production/development, cache the config
  if (!cachedConfig) {
    cachedConfig = buildConfig();
  }
  return cachedConfig;
};

export const getServerConfig = (): ServerConfig => getConfig().server;
export const getAPIConfig = (): APIConfig => getConfig().api;
export const getSecurityConfig = (): SecurityConfig => getConfig().security;
export const getLoggingConfig = (): LoggingConfig => getConfig().logging;
export const getPerformanceConfig = (): PerformanceConfig => getConfig().performance;
export const getResilienceConfig = (): ResilienceConfig => getConfig().resilience;
export const getStreamingConfig = (): StreamingConfig => getConfig().streaming;

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
    console.error('Configuration validation failed:', errorMessage);
    return false;
  }
};

// Configuration summary for logging
export const getConfigSummary = () => {
  const currentConfig = getConfig();
  return {
    environment: currentConfig.server.nodeEnv,
    transport: currentConfig.server.transport,
    port: currentConfig.server.httpPort,
    logLevel: currentConfig.logging.level,
    apiTimeout: currentConfig.performance.apiTimeout,
    circuitBreakerThreshold: currentConfig.resilience.circuitBreaker.threshold,
    maxRetries: currentConfig.resilience.retry.maxRetries,
  };
};

// Configuration summary available via getConfigSummary() function
