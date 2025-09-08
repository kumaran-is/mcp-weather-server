import { AppConfig, TransportConfig, APIConfig, LoggingConfig } from '../types.js';

/**
 * Centralized configuration management for the MCP Weather Server
 * Loads configuration from environment variables with sensible defaults
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): AppConfig {
    const env = process.env.NODE_ENV || 'development';

    return {
      env,
      transport: this.loadTransportConfig(),
      api: this.loadAPIConfig(),
      logging: this.loadLoggingConfig(),
      security: {
        allowedOrigins: this.parseAllowedOrigins()
      }
    };
  }

  private loadTransportConfig(): TransportConfig {
    const transportType = (process.env.MCP_TRANSPORT || 'stdio') as 'stdio' | 'http' | 'websocket';

    const baseConfig: TransportConfig = {
      type: transportType
    };

    if (transportType === 'http') {
      baseConfig.http = {
        port: parseInt(process.env.MCP_HTTP_PORT || '8080'),
        allowedOrigins: this.parseAllowedOrigins(),
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000'), // 1 hour
        maxSessions: parseInt(process.env.MAX_SESSIONS || '100')
      };
    }

    if (transportType === 'websocket') {
      baseConfig.websocket = {
        port: parseInt(process.env.MCP_WS_PORT || '8081'),
        secure: process.env.MCP_WS_SECURE === 'true'
      };
    }

    return baseConfig;
  }

  private loadAPIConfig(): APIConfig {
    return {
      openMeteoBaseUrl: process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com/v1',
      geocodingApiUrl: process.env.GEOCODING_API_URL || 'https://geocoding-api.open-meteo.com/v1',
      timeout: parseInt(process.env.API_TIMEOUT || '5000'),
      retries: parseInt(process.env.API_RETRIES || '3'),
      retryDelay: parseInt(process.env.API_RETRY_DELAY || '1000')
    };
  }

  private loadLoggingConfig(): LoggingConfig {
    const level = (process.env.LOG_LEVEL || (this.config?.env === 'production' ? 'info' : 'debug')) as
      'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

    return {
      level,
      pretty: this.config?.env !== 'production',
      redact: ['password', 'token', 'key', 'secret']
    };
  }

  private parseAllowedOrigins(): string[] {
    const origins = process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8080';
    return origins.split(',').map(origin => origin.trim());
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public getTransportConfig(): TransportConfig {
    return this.config.transport;
  }

  public getAPIConfig(): APIConfig {
    return this.config.api;
  }

  public getLoggingConfig(): LoggingConfig {
    return this.config.logging;
  }

  public isProduction(): boolean {
    return this.config.env === 'production';
  }

  public isDevelopment(): boolean {
    return this.config.env === 'development';
  }

  // Utility methods for common config checks
  public shouldUseStdio(): boolean {
    return this.config.transport.type === 'stdio';
  }

  public shouldUseHTTP(): boolean {
    return this.config.transport.type === 'http';
  }

  public shouldUseWebSocket(): boolean {
    return this.config.transport.type === 'websocket';
  }

  public getHTTPPort(): number {
    return this.config.transport.http?.port || 8080;
  }

  public getWebSocketPort(): number {
    return this.config.transport.websocket?.port || 8081;
  }

  public isOriginAllowed(origin: string): boolean {
    return this.config.security.allowedOrigins.includes(origin) || origin === '';
  }

  // Reload configuration (useful for testing or dynamic config updates)
  public reloadConfig(): void {
    this.config = this.loadConfig();
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance();

// Export convenience functions
export const getConfig = () => config.getConfig();
export const getTransportConfig = () => config.getTransportConfig();
export const getAPIConfig = () => config.getAPIConfig();
export const getLoggingConfig = () => config.getLoggingConfig();
