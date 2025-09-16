/**
 * @fileoverview Authentication configuration adapter
 * Provides backward-compatible config exports for middleware
 */

import { rawConfig } from './config';

// Simple config object for backward compatibility
export const config = {
  NODE_ENV: rawConfig.NODE_ENV,
  WEATHER_API_KEY: rawConfig.WEATHER_API_KEY,
  RATE_LIMIT_PER_CLIENT: rawConfig.RATE_LIMIT_PER_CLIENT,
  RATE_LIMIT_WINDOW_MS: rawConfig.RATE_LIMIT_WINDOW_MS,
};
