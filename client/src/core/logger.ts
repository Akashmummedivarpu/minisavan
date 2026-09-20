type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private level: LogLevel = import.meta.env.MODE === 'production' ? 'info' : 'debug';

  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private format(level: LogLevel, message: string, context?: LogContext, error?: unknown) {
    const timestamp = new Date().toISOString();
    const logData: any = {
      timestamp,
      level,
      message,
      ...(context && { context })
    };

    if (error) {
      if (error instanceof Error) {
        logData.error = {
          message: error.message,
          name: error.name,
          stack: error.stack
        };
      } else {
        logData.error = String(error);
      }
    }

    // In production, we might want to send this to a backend log ingestor or Datadog
    // For now, we stringify it so it appears cleanly in the browser console as JSON
    // or as structured objects depending on the env.
    if (import.meta.env.MODE === 'production') {
      return JSON.stringify(logData);
    }
    
    return logData;
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog('debug')) {
      const data = this.format('debug', message, context);
      console.debug(import.meta.env.MODE === 'production' ? data : '[DEBUG]', data);
    }
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog('info')) {
      const data = this.format('info', message, context);
      console.info(import.meta.env.MODE === 'production' ? data : '[INFO]', data);
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog('warn')) {
      const data = this.format('warn', message, context);
      console.warn(import.meta.env.MODE === 'production' ? data : '[WARN]', data);
    }
  }

  error(message: string, error?: unknown, context?: LogContext) {
    if (this.shouldLog('error')) {
      const data = this.format('error', message, context, error);
      console.error(import.meta.env.MODE === 'production' ? data : '[ERROR]', data);
    }
  }
}

export const logger = new Logger();
