import { trace as otelTrace } from '@opentelemetry/api';
import { TracerConfig } from '@opentelemetry/sdk-trace-node';
import winston from 'winston';
import WinstonCloudWatch from 'winston-cloudwatch';
import { LogNerveConfig } from './config';

/* using a hybrid appoach of correlating tracing,logs and spans this will be used as logs so logs are printed with spanContext*/
const traceCorrelationFormatter = winston.format((info: any) => {
    const span = otelTrace.getActiveSpan();
    if (span) {
        const spanContext = span.spanContext();
        info.traceId = spanContext.traceId;
        info.spanId = spanContext.spanId;
        info.traceFlags = spanContext.traceFlags;

        span.addEvent(info);
    }
    return info;
});

let logger: winston.Logger;

export function initializeLogger(config : LogNerveConfig) {
    const transports: winston.transport[] = [];

    // type local so console is transport or jaeger(if setup) 
    if(config.environment === "local"){
        transports.push(new winston.transports.Console());
    }


    logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp(),
            traceCorrelationFormatter(),
            winston.format.json()
        ),
        transports,
    });

    return logger;
}

export function getLogger(): winston.Logger {
    if (!logger) {
        throw new Error('[LogNerve] Logger not initialized. Call init() first.');
    }
    return logger;
}
