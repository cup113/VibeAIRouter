import express, { Application, Request, Response, NextFunction } from "express";
import bodyParser from "body-parser";
import timeout from "connect-timeout";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import cors from "cors";
import "express-async-errors";
import path from "path";
import fs from "fs";

import { Logger, requestLogger } from "./logger";

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const HOST = process.env.HOST || "0.0.0.0";

class App {
  private app: Application;
  private server: any;

  private activeConnections = new Set<any>();
  private connectionCounter = 0;

  constructor() {
    this.app = express();
    this.configure();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Initializes connection tracking for graceful shutdown.
   */
  private initConnectionTracking(): void {
    if (this.server) {
      this.server.on("connection", (connection: any) => {
        const connectionId = ++this.connectionCounter;
        this.activeConnections.add(connection);

        connection.on("close", () => {
          this.activeConnections.delete(connection);
        });

        Logger.debug(
          `New connection established, ID: ${connectionId}, active connections: ${this.activeConnections.size}`,
        );
      });
    }
  }

  /**
   * Returns the current number of active connections.
   */
  private getActiveConnectionsCount(): number {
    return this.activeConnections.size;
  }

  /**
   * Forcefully closes all active connections.
   */
  private closeAllActiveConnections(): void {
    Logger.info(`Closing ${this.activeConnections.size} active connections...`);

    this.activeConnections.forEach((connection: any) => {
      try {
        if (connection.end) {
          connection.end();
        }

        if (connection.destroy) {
          connection.destroy();
        }
      } catch (error) {
        // Ignore connection close errors
      }
    });

    this.activeConnections.clear();
    Logger.info("All active connections closed");
  }

  /**
   * Configures application middleware.
   */
  private configure(): void {
    Logger.info("Configuring application middleware...");

    this.app.set("trust proxy", 1);
    Logger.info(`Trust proxy configuration: ${this.app.get("trust proxy")}`);

    this.app.use(timeout("10s"));
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      if (!req.timedout) next();
    });

    const corsOptions = {
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin) return callback(null, true);

        const allowedOrigins = process.env.ALLOWED_ORIGINS
          ? process.env.ALLOWED_ORIGINS.split(",")
          : NODE_ENV === "production"
            ? []
            : [
                "http://localhost:3000",
                "http://localhost:3001",
                "http://localhost:8080",
                "http://localhost:5173",
                "http://127.0.0.1:3000",
              ];

        if (allowedOrigins.includes("*") && NODE_ENV !== "production") {
          Logger.warn("CORS set to allow all origins (development only)");
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        } else {
          Logger.warn(`CORS blocked request from ${origin}`);
          return callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      maxAge: 86400,
    };

    this.app.use(cors(corsOptions));
    this.app.options("*", cors(corsOptions));

    this.app.use(bodyParser.json({ limit: "10mb" }));
    this.app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

    this.app.use(requestLogger());

    this.app.use((req: Request, res: Response, next: NextFunction) => {
      if (this.app.get("serverClosing")) {
        Logger.warn("Server is shutting down, rejecting new request", {
          path: req.path,
          method: req.method,
          ip: req.ip,
        });

        return res.status(503).json({
          error: "Service temporarily unavailable",
          message:
            "Server is undergoing maintenance or restart, please try again later",
          code: 503,
          retryAfter: 30,
        });
      }
      next();
      return;
    });

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: "Too many requests, please try again later.",
        code: 429,
      },
      keyGenerator: (req: Request) => {
        return ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown");
      },
      skip: (req: Request) => {
        if (req.path === "/health" && NODE_ENV === "production") {
          return true;
        }
        return false;
      },
    });
    this.app.use(limiter);

    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader("X-Powered-By", "VibeAI Router");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-XSS-Protection", "1; mode=block");

      const origin = req.headers.origin;
      if (origin) {
        res.setHeader("Vary", "Origin");
      }

      next();
    });

    if (fs.existsSync(path.join(process.cwd(), "public"))) {
      this.app.use(
        "/public",
        express.static(path.join(process.cwd(), "public")),
      );
      Logger.info("Static file directory enabled: /public");
    }
  }

  /**
   * Sets up application routes.
   */
  private setupRoutes(): void {
    Logger.info("Setting up application routes...");

    this.app.get("/health", (_req: Request, res: Response) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
        memory: process.memoryUsage(),
        version: require("../package.json").version,
      });
    });

    this.app.get("/", (_req: Request, res: Response) => {
      res.json({
        name: "VibeAI Router",
        version: require("../package.json").version,
        description: "AI routing service",
        endpoints: {
          health: "/health",
          api: "/api/v1",
          docs: "/api-docs",
        },
        environment: NODE_ENV,
      });
    });

    const apiRouter = express.Router();

    apiRouter.get("/", (_req: Request, res: Response) => {
      res.json({
        message: "VibeAI API v1",
        timestamp: new Date().toISOString(),
      });
    });

    apiRouter.get("/status", (_req: Request, res: Response) => {
      res.json({
        service: "vibe-ai-router",
        status: "operational",
        timestamp: new Date().toISOString(),
      });
    });

    apiRouter.post("/echo", (req: Request, res: Response) => {
      res.json({
        message: "Echo received",
        data: req.body,
        headers: req.headers,
        timestamp: new Date().toISOString(),
      });
    });

    this.app.use("/api/v1", apiRouter);

    this.app.use("*", (req: Request, res: Response) => {
      res.status(404).json({
        error: "Resource not found",
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Configures error handling for the application.
   */
  private setupErrorHandling(): void {
    process.on("unhandledRejection", (reason: any) => {
      Logger.error("Unhandled promise rejection:", { reason });
    });

    process.on("uncaughtException", (error: Error) => {
      Logger.error("Uncaught exception:", {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });

    this.app.use(
      (error: any, req: Request, res: Response, _next: NextFunction) => {
        Logger.error("Request processing error:", {
          error: error.message,
          stack: error.stack,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });

        if (req.timedout) {
          return res.status(408).json({
            error: "Request timeout",
            message: "Server took too long to process the request",
            code: 408,
          });
        }

        const statusCode = error.statusCode || error.status || 500;
        const response = {
          error: error.message || "Internal server error",
          code: statusCode,
          timestamp: new Date().toISOString(),
          ...(NODE_ENV === "development" && { stack: error.stack }),
        };

        res.status(statusCode).json(response);
        return;
      },
    );
  }

  /**
   * Starts the HTTP server.
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(PORT, () => {
          this.initConnectionTracking();

          Logger.info(`🚀 Server started: http://${HOST}:${PORT}`);
          Logger.info(`📊 Environment: ${NODE_ENV}`);
          Logger.info(`📝 Log level: ${Logger.getWinstonLogger().level}`);
          Logger.info(`⏱️  Server uptime: ${new Date().toISOString()}`);

          Logger.info("Available endpoints:");
          Logger.info(`  - Root: GET http://${HOST}:${PORT}/`);
          Logger.info(`  - Health check: GET http://${HOST}:${PORT}/health`);
          Logger.info(`  - API v1: GET http://${HOST}:${PORT}/api/v1`);
          Logger.info(
            `  - Echo endpoint: POST http://${HOST}:${PORT}/api/v1/echo`,
          );

          resolve();
        });

        this.server.on("error", (error: any) => {
          Logger.error("Server failed to start:", { error: error.message });
          reject(error);
        });

        this.setupGracefulShutdown();
      } catch (error) {
        Logger.error("Error starting server:", { error });
        reject(error);
      }
    });
  }

  /**
   * Sets up graceful shutdown handlers for termination signals.
   */
  private setupGracefulShutdown(): void {
    const signals = ["SIGINT", "SIGTERM", "SIGHUP"];

    signals.forEach((signal) => {
      process.on(signal, () => {
        Logger.info(
          `Received ${signal} signal, initiating graceful shutdown...`,
        );
        this.gracefulShutdown();
      });
    });

    process.on("uncaughtException", (error) => {
      Logger.error("Uncaught exception, shutting down server:", {
        error: error.message,
      });
      this.gracefulShutdown(1);
    });

    process.on("unhandledRejection", (reason) => {
      Logger.error("Unhandled promise rejection:", { reason });
      this.gracefulShutdown(1);
    });
  }

  /**
   * Performs a graceful shutdown of the server.
   * @param exitCode - The exit code to use when terminating the process.
   */
  private async gracefulShutdown(exitCode: number = 0): Promise<void> {
    Logger.info("Starting graceful server shutdown...");

    this.app.set("serverClosing", true);
    Logger.info("Server closing flag set, new requests will be rejected");

    this.app.disable("healthCheck");

    if (this.server) {
      return new Promise<void>((_resolve) => {
        Logger.info("Closing server, stopping new connections...");

        this.server.close(async (err: any) => {
          if (err) {
            Logger.error("Error closing server:", { error: err.message });
          } else {
            Logger.info("Server stopped listening for new connections");
          }

          const activeCount = this.getActiveConnectionsCount();
          if (activeCount > 0) {
            Logger.info(
              `Waiting for ${activeCount} active connections to complete...`,
            );
            await this.waitForActiveConnections();
          }

          if (this.getActiveConnectionsCount() > 0) {
            this.closeAllActiveConnections();
          }

          await this.cleanup();

          Logger.info("Graceful shutdown complete, exiting process");
          process.exit(exitCode);
        });

        const shutdownTimeout = process.env.SHUTDOWN_TIMEOUT
          ? parseInt(process.env.SHUTDOWN_TIMEOUT, 10)
          : 30000;

        setTimeout(() => {
          Logger.warn(`Shutdown timeout (${shutdownTimeout}ms), forcing exit`);

          if (this.server && this.server.closeAllConnections) {
            this.server.closeAllConnections();
            Logger.info("All connections forcefully closed");
          }

          process.exit(exitCode);
        }, shutdownTimeout);
      });
    } else {
      process.exit(exitCode);
    }
  }

  /**
   * Waits for active connections to close within a timeout.
   */
  private async waitForActiveConnections(): Promise<void> {
    const maxWaitTime = process.env.CONNECTION_CLOSE_TIMEOUT
      ? parseInt(process.env.CONNECTION_CLOSE_TIMEOUT, 10)
      : 10000;

    Logger.info(
      `Waiting up to ${maxWaitTime / 1000} seconds for existing connections to complete...`,
    );

    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkInterval = setInterval(() => {
        const activeCount = this.getActiveConnectionsCount();
        const elapsed = Date.now() - startTime;

        if (activeCount === 0 || elapsed >= maxWaitTime) {
          clearInterval(checkInterval);
          if (activeCount === 0) {
            Logger.info("All connections closed normally");
          } else {
            Logger.info(`Wait timeout, ${activeCount} connections still open`);
          }
          resolve();
        } else {
          Logger.info(
            `Waiting... ${activeCount} active connections remaining, waited ${elapsed / 1000} seconds`,
          );
        }
      }, 1000);
    });
  }

  /**
   * Performs cleanup tasks before shutdown.
   */
  private async cleanup(): Promise<void> {
    Logger.info("Performing cleanup tasks...");

    try {
      // Placeholder for cleanup tasks (e.g., close database connections, clean temp files)
      Logger.info("Cleanup tasks completed");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Logger.error("Cleanup task error:", { error: errorMessage });
    }
  }

  /**
   * Returns the Express application instance.
   */
  public getApp(): Application {
    return this.app;
  }

  /**
   * Stops the server.
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err: any) => {
          if (err) {
            reject(err);
          } else {
            Logger.info("Server stopped");
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

const app = new App();

export { app };

if (require.main === module) {
  app.start().catch((error) => {
    Logger.error("Application failed to start:", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });
}
