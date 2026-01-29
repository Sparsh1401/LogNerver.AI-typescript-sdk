export interface LogNerveConfig {
  serviceName: string;
  serviceVersion?: string | undefined;
  environment?: string | undefined;
  exporter?:
    | {
        type: 'console' | 'jaeger' | 'otlp' | 'aws-xray';
        endpoint?: string;
        headers?: Record<string, string>;
      }
    | undefined;
  batchProcessor?: boolean | undefined;
}

export function loadConfig(): LogNerveConfig {
  const config: LogNerveConfig = {
    serviceName: 'demo-app',
    serviceVersion: '1.0',
    environment: 'development',
    exporter: {
      type: 'console',
      endpoint: '0.0.0.0',
    },
    batchProcessor: false,
  };
  return config;
}
