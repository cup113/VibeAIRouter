require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
// 使用新的ConfigManager
const ConfigManager = require('./services/ConfigManager');
const logger = require('./services/logger');

// 初始化配置管理器
const configManager = new ConfigManager();
const config = {
  get: (key, defaultValue) => configManager.get(key, defaultValue)
};

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();

// 异步初始化配置
(async () => {
  try {
    const configDir = process.env.CONFIG_DIR || path.join(__dirname, '../config');
    await configManager.initialize(configDir);
    
    const PORT = config.get('port') || 3000;
    
    app.listen(PORT, () => {
      logger.info(`VibeAI Router started on port ${PORT}`);
      logger.info(`Environment: ${config.get('env')}`);
      logger.info(`Default model: ${config.get('models.default')}`);
    });
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  }
})();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const requestLogger = require('./middleware/requestLogger');
const rateLimiter = require('./middleware/rateLimiter');
const { ErrorUtils } = require('./errors');

app.use(requestLogger);
app.use(rateLimiter.ipLimiter);
app.use(rateLimiter.globalLimiter);

const chatRoutes = require('./routes/chat');
const healthRoutes = require('./routes/health');
const adminRoutes = require('./routes/admin');
const modelsRoutes = require('./routes/models');

app.use('/v1/chat/completions', chatRoutes);
app.use('/health', healthRoutes);
app.use('/v1/models', modelsRoutes);

// 静态文件服务（在admin路由之前）
app.use(express.static('public'));

// 管理员API路由（需要认证）
app.use('/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Not Found',
      type: 'invalid_request_error',
      code: 'not_found'
    }
  });
});

app.use(ErrorUtils.errorHandler);

// 注意：app.listen现在在异步初始化块中调用