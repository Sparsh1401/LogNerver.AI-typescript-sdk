import { loadConfig, LogNerveConfig } from './config';
import { initializeLogger, getLogger } from './logger';
import { initializeTracing, trace, traceFunction } from './tracer';

export function init(customConfig?: Partial<LogNerveConfig>) {
  const defaultConfig: LogNerveConfig = loadConfig();
  const config: LogNerveConfig = { ...defaultConfig, ...customConfig };

  initializeTracing(config);

  initializeLogger(config);

  console.log('[LogNerve] Initialized successfully');

  // shutdownTracing()
}

// Export logger and tracer utilities
export { getLogger, trace, traceFunction };
export type { LogNerveConfig };
