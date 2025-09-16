export interface WeatherData {
  location: string;
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
  pressure: number;
  timestamp?: string;
}

export interface ForecastData {
  location: string;
  forecasts: Array<{
    date: string;
    temperature: number;
    temperatureMin?: number;
    temperatureMax?: number;
    description: string;
    humidity: number;
    windSpeed?: number;
    precipitation?: number;
  }>;
}

export interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
}

export interface WeatherAPIResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current?: {
    time: string;
    interval: number;
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    weather_code: number;
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    relative_humidity_2m_mean: number[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
  };
}

export interface GeocodingAPIResponse {
  results?: Array<{
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    elevation: number;
    feature_code: string;
    country_code: string;
    admin1_id?: number;
    admin2_id?: number;
    admin3_id?: number;
    admin4_id?: number;
    timezone: string;
    population?: number;
    postcodes?: string[];
    country_id: number;
    country: string;
    admin1?: string;
    admin2?: string;
    admin3?: string;
    admin4?: string;
  }>;
  generationtime_ms: number;
}

export interface TransportConfig {
  type: 'stdio' | 'http';
  http?: {
    port: number;
    allowedOrigins: string[];
    sessionTimeout: number;
    maxSessions: number;
  };
}

export interface APIConfig {
  openMeteoBaseUrl: string;
  geocodingApiUrl: string;
  timeout: number;
  retries: number;
  retryDelay: number;
}

export interface LoggingConfig {
  level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  pretty: boolean;
  redact?: string[];
}

export interface AppConfig {
  env: string;
  transport: TransportConfig;
  api: APIConfig;
  logging: LoggingConfig;
  security: {
    allowedOrigins: string[];
  };
}
