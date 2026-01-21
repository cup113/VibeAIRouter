import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  HTTP = "http",
  DEBUG = "debug",
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: any;
}

export interface LoggerConfig {
  level?: LogLevel;
  dirname?: string;
  maxSize?: string;
  maxFiles?: string;
  datePattern?: string;
  console?: boolean;
  file?: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG,
  dirname: path.join(process.cwd(), "logs"),
  maxSize: "20m",
  maxFiles: "14d",
  datePattern: "YYYY-MM-DD",
  console: true,
  file: true,
};

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss.SSS" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }),
);

export function createLogger(config: LoggerConfig = {}): winston.Logger {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const transports: winston.transport[] = [];

  if (finalConfig.console) {
    transports.push(
      new winston.transports.Console({
        format: consoleFormat,
        level: finalConfig.level,
      }),
    );
  }

  if (finalConfig.file) {
    transports.push(
      new DailyRotateFile({
        dirname: finalConfig.dirname,
        filename: "error-%DATE%.log",
        datePattern: finalConfig.datePattern,
        maxSize: finalConfig.maxSize,
        maxFiles: finalConfig.maxFiles,
        level: LogLevel.ERROR,
        format: customFormat,
      }),
    );

    transports.push(
      new DailyRotateFile({
        dirname: finalConfig.dirname,
        filename: "combined-%DATE%.log",
        datePattern: finalConfig.datePattern,
        maxSize: finalConfig.maxSize,
        maxFiles: finalConfig.maxFiles,
        level: finalConfig.level,
        format: customFormat,
      }),
    );
  }

  return winston.createLogger({
    level: finalConfig.level,
    levels: {
      [LogLevel.ERROR]: 0,
      [LogLevel.WARN]: 1,
      [LogLevel.INFO]: 2,
      [LogLevel.HTTP]: 3,
      [LogLevel.DEBUG]: 4,
    },
    transports,
    exceptionHandlers: [
      new winston.transports.File({
        filename: path.join(finalConfig.dirname!, "exceptions.log"),
      }),
    ],
    rejectionHandlers: [
      new winston.transports.File({
        filename: path.join(finalConfig.dirname!, "rejections.log"),
      }),
    ],
    exitOnError: false,
  });
}

export const logger = createLogger();

export class Logger {
  private static instance: winston.Logger = logger;

  static configure(config: LoggerConfig): void {
    this.instance = createLogger(config);
  }

  static error(message: string, meta?: any): void {
    this.instance.error(message, meta);
  }

  static warn(message: string, meta?: any): void {
    this.instance.warn(message, meta);
  }

  static info(message: string, meta?: any): void {
    this.instance.info(message, meta);
  }

  static http(message: string, meta?: any): void {
    this.instance.http(message, meta);
  }

  static debug(message: string, meta?: any): void {
    this.instance.debug(message, meta);
  }

  static log(level: LogLevel, message: string, meta?: any): void {
    this.instance.log(level, message, meta);
  }

  static getWinstonLogger(): winston.Logger {
    return this.instance;
  }
}

export function requestLogger() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const logData = {
        method: req.method,
        url: req.originalUrl || req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      };

      if (res.statusCode >= 500) {
        logger.error("Request failed", logData);
      } else if (res.statusCode >= 400) {
        logger.warn("Request client error", logData);
      } else {
        logger.info("Request completed", logData);
      }
    });

    next();
  };
}

export function logPerformance(
  propertyKey: string,
  descriptor: PropertyDescriptor,
) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    const startTime = Date.now();
    const result = originalMethod.apply(this, args);

    if (result && typeof result.then === "function") {
      return result.then((res: any) => {
        const duration = Date.now() - startTime;
        logger.debug(`Async method ${propertyKey} executed in ${duration}ms`);
        return res;
      });
    } else {
      const duration = Date.now() - startTime;
      logger.debug(`Method ${propertyKey} executed in ${duration}ms`);
      return result;
    }
  };

  return descriptor;
}

export default logger;
