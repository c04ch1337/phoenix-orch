import { RetryConfig, CircuitBreakerConfig } from '../types';

type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: CircuitBreakerState = 'CLOSED';

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.config.resetTimeout) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  private onSuccess(): void {
    this.failures = 0;
    // If in HALF_OPEN, close the circuit; otherwise keep it closed
    if (this.state === 'HALF_OPEN' || this.state === 'CLOSED') {
      this.state = 'CLOSED';
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    // If in HALF_OPEN state, immediately open on failure
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.failures = this.config.failureThreshold; // Set to threshold to keep it open
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  public getState(): CircuitBreakerState {
    return this.state;
  }

  public reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
  }
}

export class RetryWithBackoff {
  constructor(private config: RetryConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    let attempt = 0;
    let delay = this.config.initialDelay;

    while (attempt < this.config.maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        attempt++;
        
        if (attempt === this.config.maxAttempts) {
          break;
        }

        await this.wait(delay);
        delay *= this.config.backoffFactor;
      }
    }

    throw new Error(`Operation failed after ${attempt} attempts. Last error: ${lastError?.message}`);
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const createRetryableOperation = <T>(
  operation: () => Promise<T>,
  retryConfig: RetryConfig,
  circuitBreakerConfig: CircuitBreakerConfig
): () => Promise<T> => {
  const retry = new RetryWithBackoff(retryConfig);
  const circuitBreaker = new CircuitBreaker(circuitBreakerConfig);

  return async () => {
    return circuitBreaker.execute(() => retry.execute(operation));
  };
};

export const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  backoffFactor: 2,
  initialDelay: 1000
};

export const defaultCircuitBreakerConfig: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000
};

// Utility function to wrap API calls with retry and circuit breaker
export const withResilience = async <T>(
  operation: () => Promise<T>,
  retryConfig: Partial<RetryConfig> = {},
  circuitBreakerConfig: Partial<CircuitBreakerConfig> = {}
): Promise<T> => {
  const finalRetryConfig = { ...defaultRetryConfig, ...retryConfig };
  const finalCircuitBreakerConfig = { ...defaultCircuitBreakerConfig, ...circuitBreakerConfig };

  const resilientOperation = createRetryableOperation(
    operation,
    finalRetryConfig,
    finalCircuitBreakerConfig
  );

  return resilientOperation();
};