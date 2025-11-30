'use client';

interface EndpointConfig {
  // ws removed - using SSE only
  api: string;
  metrics: string;
}

interface SecurityConfig {
  encryptSensitiveData: boolean;
  requireAuth: boolean;
  sessionTimeout: number;
}

interface MonitoringConfig {
  performanceThresholds: {
    LCP: number;    // Largest Contentful Paint (ms)
    FID: number;    // First Input Delay (ms)
    CLS: number;    // Cumulative Layout Shift
    TTFB: number;   // Time to First Byte (ms)
    FCP: number;    // First Contentful Paint (ms)
  };
  memoryThreshold: number;  // Memory usage threshold in bytes
  metricsInterval: number;  // Metrics collection interval in ms
}

interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

interface CryptoConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
}

export interface AppConfig {
  env: 'development' | 'staging' | 'production';
  endpoints: EndpointConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  retry: RetryConfig;
  crypto: CryptoConfig;
}

const developmentConfig: AppConfig = {
  env: 'development',
  endpoints: {
    // WebSocket removed - using SSE only
    api: 'http://127.0.0.1:5001/api',
    metrics: 'http://127.0.0.1:5001/metrics',
  },
  security: {
    encryptSensitiveData: true,
    requireAuth: false,
    sessionTimeout: 3600000, // 1 hour
  },
  monitoring: {
    performanceThresholds: {
      LCP: 2500,
      FID: 100,
      CLS: 0.1,
      TTFB: 600,
      FCP: 1800,
    },
    memoryThreshold: 100 * 1024 * 1024, // 100MB in bytes
    metricsInterval: 5000, // 5 seconds
  },
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
  },
  crypto: {
    algorithm: 'AES-GCM',
    keyLength: 256,
    ivLength: 12
  }
};

const stagingConfig: AppConfig = {
  ...developmentConfig,
  env: 'staging',
  endpoints: {
    // WebSocket removed - using SSE only
    api: 'https://staging.phoenix-orch.io/api',
    metrics: 'https://staging.phoenix-orch.io/metrics',
  },
  security: {
    ...developmentConfig.security,
    requireAuth: true,
  },
};

const productionConfig: AppConfig = {
  ...stagingConfig,
  env: 'production',
  endpoints: {
    // WebSocket removed - using SSE only
    api: 'https://phoenix-orch.io/api',
    metrics: 'https://phoenix-orch.io/metrics',
  },
  monitoring: {
    ...stagingConfig.monitoring,
    metricsInterval: 5000, // Less frequent in production
  },
};

function getConfig(): AppConfig {
  // Use Next.js environment variables pattern
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV || 'development';
  
  switch (appEnv) {
    case 'production':
      return productionConfig;
    case 'staging':
      return stagingConfig;
    default:
      return developmentConfig;
  }
}

export const config = getConfig();