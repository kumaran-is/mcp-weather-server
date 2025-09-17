/**
 * Centralized configuration management for MCP Weather Server
 * Environment-based configuration with validation and type safety
 */

import * as z from 'zod';

// Helper function to parse boolean from string
const parseBoolean = (value: string | undefined): boolean => {
  if (value === undefined) return false;
  return value.toLowerCase() === 'true';
};

// Environment variable schema
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MCP_TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
  MCP_HTTP_PORT: z.coerce.number().min(1024).max(65535).default(8080),

  // Open-Meteo API Configuration
  OPEN_METEO_BASE_URL: z.string().url().default('https://api.open-meteo.com/v1'),
  GEOCODING_API_URL: z.string().url().default('https://geocoding-api.open-meteo.com/v1'),

  // Basic Security Configuration
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:8080'),
  WEATHER_API_KEY: z.string().optional(),
  ADDITIONAL_API_KEYS: z.string().optional(),

  // Enhanced Security Configuration from .env.security
  SECURITY_MONITORING_ENABLED: z.string().default('true').transform(parseBoolean),
  AUDIT_LOGGING_ENABLED: z.string().default('true').transform(parseBoolean),
  AUDIT_LOG_FILE: z.string().default('true').transform(parseBoolean),
  AUDIT_LOG_SYSLOG: z.string().default('false').transform(parseBoolean),
  AUDIT_LOG_WEBHOOK_URL: z.string().optional(),

  // Rate Limiting Configuration
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.coerce.number().min(1).max(10000).default(100),
  RATE_LIMIT_BURST_LIMIT: z.coerce.number().min(1).max(1000).default(20),
  RATE_LIMIT_BLOCK_DURATION: z.coerce.number().min(1000).max(3600000).default(300000),
  WEATHER_RATE_LIMIT_PER_MINUTE: z.coerce.number().min(1).max(1000).default(60),
  GEOCODING_RATE_LIMIT_PER_MINUTE: z.coerce.number().min(1).max(1000).default(30),

  // Audit Configuration
  AUDIT_RETENTION_DAYS: z.coerce.number().min(1).max(365).default(90),
  AUDIT_MAX_EVENTS: z.coerce.number().min(100).max(100000).default(10000),
  AUDIT_MINIMUM_SEVERITY: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  AUDIT_ENABLED_CATEGORIES: z.string().default('authentication,authorization,data_access,security,api_usage,configuration'),

  // Brute Force Protection
  BRUTE_FORCE_MAX_ATTEMPTS: z.coerce.number().min(1).max(100).default(5),
  BRUTE_FORCE_TIME_WINDOW: z.coerce.number().min(1000).max(3600000).default(300000),
  BRUTE_FORCE_BLOCK_DURATION: z.coerce.number().min(1000).max(86400000).default(900000),

  // Threat Detection
  THREAT_DETECTION_SQL_INJECTION: z.string().default('true').transform(parseBoolean),
  THREAT_DETECTION_XSS: z.string().default('true').transform(parseBoolean),
  THREAT_DETECTION_PATH_TRAVERSAL: z.string().default('true').transform(parseBoolean),
  THREAT_DETECTION_COMMAND_INJECTION: z.string().default('true').transform(parseBoolean),

  // IP Blocking Configuration
  IP_BLOCKING_ENABLED: z.string().default('true').transform(parseBoolean),
  IP_BLOCKING_AUTO_BLOCK: z.string().default('true').transform(parseBoolean),
  IP_WHITELIST: z.string().default('127.0.0.1,::1'),
  IP_BLACKLIST: z.string().default(''),

  // Data Protection
  SENSITIVE_DATA_MASKING_ENABLED: z.string().default('true').transform(parseBoolean),
  MASK_API_KEYS: z.string().default('true').transform(parseBoolean),
  MASK_PASSWORDS: z.string().default('true').transform(parseBoolean),
  MASK_PERSONAL_DATA: z.string().default('true').transform(parseBoolean),
  CUSTOM_MASK_PATTERNS: z.string().default('secret,token,key'),

  // Alerting Configuration
  SECURITY_ALERTING_ENABLED: z.string().default('true').transform(parseBoolean),
  CRITICAL_THREAT_THRESHOLD: z.coerce.number().min(1).max(1000).default(10),
  ALERT_WEBHOOK_URL: z.string().optional(),
  ALERT_EMAIL_RECIPIENTS: z.string().default(''),

  // Compliance Settings
  SOC2_COMPLIANCE_MODE: z.string().default('false').transform(parseBoolean),
  GDPR_COMPLIANCE_MODE: z.string().default('false').transform(parseBoolean),
  PCI_COMPLIANCE_MODE: z.string().default('false').transform(parseBoolean),

  // Security Headers
  CSP_DEFAULT_SRC: z.string().default("'self'"),
  CSP_SCRIPT_SRC: z.string().default("'self'"),
  CSP_STYLE_SRC: z.string().default("'self' 'unsafe-inline'"),
  HSTS_MAX_AGE: z.coerce.number().min(1).max(31536000).default(31536000),
  REFERRER_POLICY: z.string().default('strict-origin-when-cross-origin'),

  // Input Validation
  MAX_CITY_NAME_LENGTH: z.coerce.number().min(1).max(1000).default(100),
  MAX_QUERY_LENGTH: z.coerce.number().min(1).max(10000).default(1000),
  MAX_REQUEST_SIZE: z.coerce.number().min(1024).max(10485760).default(1048576),

  // Session Security
  SESSION_TIMEOUT: z.coerce.number().min(60000).max(86400000).default(3600000),
  MAX_SESSIONS_PER_IP: z.coerce.number().min(1).max(1000).default(10),

  // Logging Configuration
  SECURITY_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  STRUCTURED_LOGGING_ENABLED: z.string().default('true').transform(parseBoolean),
  AUDIT_LOG_FORMAT: z.enum(['json', 'structured', 'cef']).default('json'),

  // Development/Testing
  SECURITY_DISABLED: z.string().default('false').transform(parseBoolean),
  SECURITY_TESTING_MODE: z.string().default('false').transform(parseBoolean),
  MOCK_SECURITY_RESPONSES: z.string().default('false').transform(parseBoolean),

  // Rate Limiting Configuration
  RATE_LIMIT_PER_CLIENT: z.coerce.number().min(1).max(10000).default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).max(3600000).default(60000),

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
  monitoring: {
    enabled: boolean;
    auditLogging: boolean;
    auditLogFile: boolean;
    auditLogSyslog: boolean;
    auditWebhookUrl?: string;
  };
  rateLimiting: {
    requestsPerMinute: number;
    burstLimit: number;
    blockDuration: number;
    weatherRateLimit: number;
    geocodingRateLimit: number;
  };
  audit: {
    retentionDays: number;
    maxEvents: number;
    minimumSeverity: 'low' | 'medium' | 'high' | 'critical';
    enabledCategories: string[];
  };
  bruteForceProtection: {
    maxAttempts: number;
    timeWindow: number;
    blockDuration: number;
  };
  threatDetection: {
    sqlInjection: boolean;
    xss: boolean;
    pathTraversal: boolean;
    commandInjection: boolean;
  };
  ipBlocking: {
    enabled: boolean;
    autoBlock: boolean;
    whitelist: string[];
    blacklist: string[];
  };
  dataProtection: {
    maskingEnabled: boolean;
    maskApiKeys: boolean;
    maskPasswords: boolean;
    maskPersonalData: boolean;
    customMaskPatterns: string[];
  };
  alerting: {
    enabled: boolean;
    criticalThreshold: number;
    webhookUrl?: string;
    emailRecipients: string[];
  };
  compliance: {
    soc2Mode: boolean;
    gdprMode: boolean;
    pciMode: boolean;
  };
  headers: {
    cspDefaultSrc: string;
    cspScriptSrc: string;
    cspStyleSrc: string;
    hstsMaxAge: number;
    referrerPolicy: string;
  };
  inputValidation: {
    maxCityNameLength: number;
    maxQueryLength: number;
    maxRequestSize: number;
  };
  session: {
    timeout: number;
    maxSessionsPerIP: number;
  };
  logging: {
    securityLogLevel: string;
    structuredLogging: boolean;
    auditLogFormat: 'json' | 'structured' | 'cef';
  };
  testing: {
    securityDisabled: boolean;
    testingMode: boolean;
    mockResponses: boolean;
  };
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
      monitoring: {
        enabled: envConfig.SECURITY_MONITORING_ENABLED,
        auditLogging: envConfig.AUDIT_LOGGING_ENABLED,
        auditLogFile: envConfig.AUDIT_LOG_FILE,
        auditLogSyslog: envConfig.AUDIT_LOG_SYSLOG,
        auditWebhookUrl: envConfig.AUDIT_LOG_WEBHOOK_URL,
      },
      rateLimiting: {
        requestsPerMinute: envConfig.RATE_LIMIT_REQUESTS_PER_MINUTE,
        burstLimit: envConfig.RATE_LIMIT_BURST_LIMIT,
        blockDuration: envConfig.RATE_LIMIT_BLOCK_DURATION,
        weatherRateLimit: envConfig.WEATHER_RATE_LIMIT_PER_MINUTE,
        geocodingRateLimit: envConfig.GEOCODING_RATE_LIMIT_PER_MINUTE,
      },
      audit: {
        retentionDays: envConfig.AUDIT_RETENTION_DAYS,
        maxEvents: envConfig.AUDIT_MAX_EVENTS,
        minimumSeverity: envConfig.AUDIT_MINIMUM_SEVERITY,
        enabledCategories: envConfig.AUDIT_ENABLED_CATEGORIES.split(',').map(cat => cat.trim()),
      },
      bruteForceProtection: {
        maxAttempts: envConfig.BRUTE_FORCE_MAX_ATTEMPTS,
        timeWindow: envConfig.BRUTE_FORCE_TIME_WINDOW,
        blockDuration: envConfig.BRUTE_FORCE_BLOCK_DURATION,
      },
      threatDetection: {
        sqlInjection: envConfig.THREAT_DETECTION_SQL_INJECTION,
        xss: envConfig.THREAT_DETECTION_XSS,
        pathTraversal: envConfig.THREAT_DETECTION_PATH_TRAVERSAL,
        commandInjection: envConfig.THREAT_DETECTION_COMMAND_INJECTION,
      },
      ipBlocking: {
        enabled: envConfig.IP_BLOCKING_ENABLED,
        autoBlock: envConfig.IP_BLOCKING_AUTO_BLOCK,
        whitelist: envConfig.IP_WHITELIST.split(',').map(ip => ip.trim()).filter(ip => ip),
        blacklist: envConfig.IP_BLACKLIST.split(',').map(ip => ip.trim()).filter(ip => ip),
      },
      dataProtection: {
        maskingEnabled: envConfig.SENSITIVE_DATA_MASKING_ENABLED,
        maskApiKeys: envConfig.MASK_API_KEYS,
        maskPasswords: envConfig.MASK_PASSWORDS,
        maskPersonalData: envConfig.MASK_PERSONAL_DATA,
        customMaskPatterns: envConfig.CUSTOM_MASK_PATTERNS.split(',').map(pattern => pattern.trim()),
      },
      alerting: {
        enabled: envConfig.SECURITY_ALERTING_ENABLED,
        criticalThreshold: envConfig.CRITICAL_THREAT_THRESHOLD,
        webhookUrl: envConfig.ALERT_WEBHOOK_URL,
        emailRecipients: envConfig.ALERT_EMAIL_RECIPIENTS.split(',').map(email => email.trim()).filter(email => email),
      },
      compliance: {
        soc2Mode: envConfig.SOC2_COMPLIANCE_MODE,
        gdprMode: envConfig.GDPR_COMPLIANCE_MODE,
        pciMode: envConfig.PCI_COMPLIANCE_MODE,
      },
      headers: {
        cspDefaultSrc: envConfig.CSP_DEFAULT_SRC,
        cspScriptSrc: envConfig.CSP_SCRIPT_SRC,
        cspStyleSrc: envConfig.CSP_STYLE_SRC,
        hstsMaxAge: envConfig.HSTS_MAX_AGE,
        referrerPolicy: envConfig.REFERRER_POLICY,
      },
      inputValidation: {
        maxCityNameLength: envConfig.MAX_CITY_NAME_LENGTH,
        maxQueryLength: envConfig.MAX_QUERY_LENGTH,
        maxRequestSize: envConfig.MAX_REQUEST_SIZE,
      },
      session: {
        timeout: envConfig.SESSION_TIMEOUT,
        maxSessionsPerIP: envConfig.MAX_SESSIONS_PER_IP,
      },
      logging: {
        securityLogLevel: envConfig.SECURITY_LOG_LEVEL,
        structuredLogging: envConfig.STRUCTURED_LOGGING_ENABLED,
        auditLogFormat: envConfig.AUDIT_LOG_FORMAT,
      },
      testing: {
        securityDisabled: envConfig.SECURITY_DISABLED,
        testingMode: envConfig.SECURITY_TESTING_MODE,
        mockResponses: envConfig.MOCK_SECURITY_RESPONSES,
      },
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
