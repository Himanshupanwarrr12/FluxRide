/**
 * Lightweight logger helper for Kafka operations in user-service.
 */

type LogLevel = "INFO" | "WARN" | "ERROR";

const formatMessage = (level: LogLevel, message: string, context?: Record<string, unknown>): string => {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level}] [KafkaService] ${message}${contextStr}`;
};

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => {
    console.log(formatMessage("INFO", message, context));
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    console.warn(formatMessage("WARN", message, context));
  },
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => {
    const errDetails = error instanceof Error ? { message: error.message, stack: error.stack } : { error };
    const mergedContext = context ? { ...context, ...errDetails } : errDetails;
    console.error(formatMessage("ERROR", message, mergedContext));
  },
};
