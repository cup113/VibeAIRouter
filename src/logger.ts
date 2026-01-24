import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

const isProduction = process.env.NODE_ENV === "production";

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  HTTP = "http",
  DEBUG = "debug",
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
  level: isProduction ? LogLevel.INFO : LogLevel.DEBUG,
  dirname: path.join(process.cwd(), "logs"),
  maxSize: "20m",
  maxFiles: "14d",
  datePattern: "YYYY-MM-DD",
  console: true,
  file: !isProduction, // 生产环境默认不写文件，交给 Docker 处理 stdout
};

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const devFormat = winston.format.combine(
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
        format: isProduction ? prodFormat : devFormat,
        level: finalConfig.level,
      }),
    );
  }

  if (finalConfig.file) {
    const fileBaseConfig = {
      dirname: finalConfig.dirname,
      datePattern: finalConfig.datePattern,
      maxSize: finalConfig.maxSize,
      maxFiles: finalConfig.maxFiles,
      format: prodFormat,
    };

    transports.push(
      new DailyRotateFile({
        ...fileBaseConfig,
        filename: "error-%DATE%.log",
        level: LogLevel.ERROR,
      }),
      new DailyRotateFile({
        ...fileBaseConfig,
        filename: "combined-%DATE%.log",
        level: finalConfig.level,
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
    exceptionHandlers: isProduction
      ? [new winston.transports.Console({ format: prodFormat })]
      : [
          new winston.transports.File({
            filename: path.join(finalConfig.dirname!, "exceptions.log"),
          }),
        ],
    rejectionHandlers: isProduction
      ? [new winston.transports.Console({ format: prodFormat })]
      : [
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
      };
      if (res.statusCode >= 500) Logger.error("Request failed", logData);
      else if (res.statusCode >= 400)
        Logger.warn("Request client error", logData);
      else Logger.info("Request completed", logData);
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
    const log = (d: number) =>
      Logger.debug(`Method ${propertyKey} executed in ${d}ms`);

    if (result instanceof Promise) {
      return result.then((res) => {
        log(Date.now() - startTime);
        return res;
      });
    }
    log(Date.now() - startTime);
    return result;
  };
  return descriptor;
}

export default logger;
