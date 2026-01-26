import { trace as otelTrace } from '@opentelemetry/api';
import {
    BatchSpanProcessor,
    SimpleSpanProcessor,
    ConsoleSpanExporter,
    NodeTracerProvider,
} from '@opentelemetry/sdk-trace-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { LogNerveConfig } from './config';

export class TracerConfig implements LogNerveConfig {
    public serviceName: string;
    public serviceVersion?: string | undefined;
    public environment?: string | undefined;
    public exporter?:
    | {
        type: 'console' | 'jaeger' | 'otlp' | 'aws-xray';
        endpoint?: string;
        headers?: Record<string, string>;
    }
    | undefined;
    public batchProcessor?: boolean | undefined;

    constructor(config: LogNerveConfig) {
        this.serviceName = config.serviceName;
        this.serviceVersion = config.serviceVersion;
        this.environment = config.environment;
        this.exporter = config.exporter;
        this.batchProcessor = config.batchProcessor;
    }
}

function generateSpanName(fn: Function, thisArgs?: any): string {
    if (fn.name && fn.name !== '') {
        let spanName = fn.name;

        if (thisArgs && thisArgs.constructor && thisArgs.constructor.name !== 'Object') {
            spanName = `${thisArgs.constructor.name}.${fn.name}`;
        }

        if (spanName.includes('bound ')) {
            spanName = spanName.replace('bound ', '');
        }

        return spanName;
    }

    const fnString = fn.toString();

    if (fnString.includes('class ')) {
        const classMatch = fnString.match(/class\s+(\w+)/);
        if (classMatch) return `${classMatch[1]}.constructor`;
    }

    if (fnString.includes('async ')) {
        return 'async-function';
    }

    const stackTrace = new Error().stack;
    if (stackTrace) {
        const lines = stackTrace.split('\n');
        for (let i = 2; i < Math.min(5, lines.length); i++) {
            const line = lines[i];
            if (line) {
                const match = line.match(/at\s+(.+?)\s+\(/);
                if (match && match[1] && match[1] !== '__traceFunction' && match[1] !== 'Function.value') {
                    return match[1].split('.').pop() || 'anonymous';
                }
            }
        }
    }

    return 'anonymous';
}

let __tracing: NodeTracerProvider | null = null;
// let __isLive = false;

export function initializeTracing(
    config: TracerConfig = new TracerConfig({ serviceName: 'lognerve-app' })
): NodeTracerProvider {
    if (__tracing) {
        console.log('[LogNerve] Tracer already initialized for this project ');
        return __tracing;
    }

    const exporter = new ConsoleSpanExporter();

    const processor =
        config.batchProcessor !== false
            ? new BatchSpanProcessor(exporter)
            : new SimpleSpanProcessor(exporter);

    const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: config.serviceName,
        ...(config.serviceVersion && { [ATTR_SERVICE_VERSION]: config.serviceVersion }),
    });

    __tracing = new NodeTracerProvider({
        resource,
        spanProcessors: [processor],
    });

    __tracing.register();
    // __isLive = true;

    return __tracing;
}

export function shutdownTracing() {
    if (__tracing) {
        __tracing.shutdown();
        // __isLive = false;
        console.log('[LogNerve] Tracer shutdown successfully');
    } else {
        console.log('[LogNerve] Tracer not initialized');
    }
}

// this is a decorator for wrapping method
export function trace(target: any, propertyName: string | symbol, description: PropertyDescriptor) {
    const original = description.value;
    // add github context from options
    description.value = function (...args: any) {
        return __traceFunction(original, this, args);
    };
}

function __traceFunction(fn: Function, thisArgs: any, args: any[]): any {
    if (__tracing == null) {
        return fn.apply(thisArgs, args);
    }

    const tracer = otelTrace.getTracer('lognerve');
    const spanName = generateSpanName(fn, thisArgs);
    const span = tracer.startSpan(spanName);

    try {
        const result = fn.apply(thisArgs, args);
        if (result instanceof Promise) {
            return result.finally(() => span.end());
        }
        span.end();
        return result;
    } catch (error) {
        span.recordException(error as Error);
        span.end();
        throw error;
    }
}

// Wrapper function for tracing standalone functions
export function traceFunction<T extends (...args: any[]) => any>(
    fn: T,
    spanName?: string
): T {
    return ((...args: any[]) => {
        if (__tracing == null) {
            return fn(...args);
        }

        const tracer = otelTrace.getTracer('lognerve');
        const name = spanName || fn.name || 'anonymous-function';
        const span = tracer.startSpan(name);

        try {
            const result = fn(...args);
            if (result instanceof Promise) {
                return result.finally(() => span.end());
            }
            span.end();
            return result;
        } catch (error) {
            span.recordException(error as Error);
            span.end();
            throw error;
        }
    }) as T;
}
