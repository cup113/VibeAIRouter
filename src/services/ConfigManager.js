/**
 * ConfigManager - 配置管理服务
 * 
 * 原则：
 * 1. 清晰的配置优先级链
 * 2. 类型安全的配置访问
 * 3. 热重载支持
 */

const path = require('path');
const fs = require('fs').promises;
const chokidar = require('chokidar');
const logger = require('./logger');
const { ConfigError } = require('../errors');

class ConfigManager {
  constructor() {
    this.config = {};
    this.configPath = null;
    this.watcher = null;
    this.listeners = new Set();
  }
  
  /**
   * 初始化配置管理器
   * @param {string} configDir - 配置文件目录
   */
  async initialize(configDir) {
    this.configPath = path.resolve(configDir);
    
    // 加载配置
    await this.loadConfig();
    
    // 设置文件监视（开发环境）
    if (process.env.NODE_ENV === 'development') {
      this.setupFileWatcher();
    }
    
    logger.info('Config manager initialized');
  }
  
  /**
   * 加载配置（遵循优先级链）
   */
  async loadConfig() {
    const config = {};
    
    // 1. 加载默认配置
    const defaultConfig = await this.loadConfigFile('default.json');
    Object.assign(config, defaultConfig);
    
    // 2. 加载环境特定配置
    const env = process.env.NODE_ENV || 'development';
    const envConfig = await this.loadConfigFile(`${env}.json`);
    Object.assign(config, envConfig);
    
    // 3. 加载本地配置（覆盖）
    const localConfig = await this.loadConfigFile('local.json');
    Object.assign(config, localConfig);
    
    // 4. 应用环境变量覆盖
    this.applyEnvironmentOverrides(config);
    
    this.config = config;
    logger.debug('Configuration loaded', { env });
    
    // 通知监听者
    this.notifyListeners();
    
    return config;
  }
  
  /**
   * 加载配置文件
   */
  async loadConfigFile(filename) {
    const filePath = path.join(this.configPath, filename);
    
    try {
      await fs.access(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 文件不存在是正常的
        return {};
      }
      
      logger.error(`Failed to load config file ${filename}:`, error);
      throw new ConfigError(`Invalid config file ${filename}: ${error.message}`);
    }
  }
  
  /**
   * 应用环境变量覆盖
   */
  applyEnvironmentOverrides(config) {
    // 端口
    if (process.env.PORT) {
      config.port = parseInt(process.env.PORT, 10);
    }
    
    // 日志级别
    if (process.env.LOG_LEVEL) {
      config.logging = config.logging || {};
      config.logging.level = process.env.LOG_LEVEL;
    }
    
    // 速率限制
    if (process.env.RATE_LIMIT_IP) {
      config.rateLimiting = config.rateLimiting || {};
      config.rateLimiting.ip = config.rateLimiting.ip || {};
      config.rateLimiting.ip.max = parseInt(process.env.RATE_LIMIT_IP, 10);
    }
    
    if (process.env.RATE_LIMIT_GLOBAL) {
      config.rateLimiting = config.rateLimiting || {};
      config.rateLimiting.global = config.rateLimiting.global || {};
      config.rateLimiting.global.max = parseInt(process.env.RATE_LIMIT_GLOBAL, 10);
    }
    
    // 超时设置
    if (process.env.FIRST_TOKEN_TIMEOUT) {
      config.timeouts = config.timeouts || {};
      config.timeouts.firstToken = parseInt(process.env.FIRST_TOKEN_TIMEOUT, 10);
    }
    
    if (process.env.TOTAL_TIMEOUT) {
      config.timeouts = config.timeouts || {};
      config.timeouts.total = parseInt(process.env.TOTAL_TIMEOUT, 10);
    }
    
    // 提供者配置
    this.applyProviderEnvOverrides(config);
  }
  
  /**
   * 应用提供者环境变量覆盖
   */
  applyProviderEnvOverrides(config) {
    if (!config.providers) return;
    
    for (const [providerId, providerConfig] of Object.entries(config.providers)) {
      // 启用状态
      const envKey = `${providerId.toUpperCase()}_ENABLED`;
      if (process.env[envKey] !== undefined) {
        providerConfig.enabled = process.env[envKey].toLowerCase() === 'true';
      }
      
      // 优先级
      const priorityKey = `${providerId.toUpperCase()}_PRIORITY`;
      if (process.env[priorityKey]) {
        providerConfig.priority = parseInt(process.env[priorityKey], 10);
      }
      
      // 超时
      const timeoutKey = `${providerId.toUpperCase()}_TIMEOUT`;
      if (process.env[timeoutKey]) {
        providerConfig.timeout = parseInt(process.env[timeoutKey], 10);
      }
    }
  }
  
  /**
   * 设置文件监视器
   */
  setupFileWatcher() {
    if (this.watcher) {
      this.watcher.close();
    }
    
    this.watcher = chokidar.watch(this.configPath, {
      ignored: /(^|[\/\\])\../, // 忽略隐藏文件
      persistent: true,
      ignoreInitial: true
    });
    
    this.watcher.on('change', async (filePath) => {
      logger.info(`Config file changed: ${path.basename(filePath)}`);
      
      try {
        await this.loadConfig();
        logger.info('Configuration reloaded successfully');
      } catch (error) {
        logger.error('Failed to reload configuration:', error);
      }
    });
    
    this.watcher.on('error', (error) => {
      logger.error('Config file watcher error:', error);
    });
  }
  
  /**
   * 获取配置值
   * @param {string} key - 配置键（支持点符号）
   * @param {any} defaultValue - 默认值
   * @returns {any}
   */
  get(key, defaultValue = undefined) {
    if (!key) {
      return this.config;
    }
    
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value === null || value === undefined || typeof value !== 'object') {
        return defaultValue;
      }
      value = value[k];
    }
    
    return value !== undefined ? value : defaultValue;
  }
  
  /**
   * 设置配置值（仅内存中）
   * @param {string} key - 配置键
   * @param {any} value - 配置值
   */
  set(key, value) {
    const keys = key.split('.');
    let obj = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!obj[k] || typeof obj[k] !== 'object') {
        obj[k] = {};
      }
      obj = obj[k];
    }
    
    obj[keys[keys.length - 1]] = value;
    
    // 通知监听者
    this.notifyListeners();
  }
  
  /**
   * 添加配置变更监听器
   */
  addListener(listener) {
    this.listeners.add(listener);
  }
  
  /**
   * 移除配置变更监听器
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }
  
  /**
   * 通知所有监听者
   */
  notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.config);
      } catch (error) {
        logger.error('Config listener error:', error);
      }
    }
  }
  
  /**
   * 重新加载配置
   */
  async reload() {
    logger.info('Reloading configuration...');
    return await this.loadConfig();
  }
  
  /**
   * 获取提供者配置
   */
  getProviderConfig(providerId) {
    const providers = this.get('providers', {});
    return providers[providerId] || null;
  }
  
  /**
   * 获取模型映射
   */
  getModelMapping() {
    return this.get('models.mapping', {});
  }
  
  /**
   * 获取提供者支持的模型列表
   */
  getProviderModels(providerId) {
    const models = this.get('models', {});
    return models[providerId] || [];
  }
  
  /**
   * 获取默认模型
   */
  getDefaultModel() {
    return this.get('models.default', 'Qwen/Qwen3-8B');
  }
  
  /**
   * 清理资源
   */
  cleanup() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    
    this.listeners.clear();
    logger.info('Config manager cleaned up');
  }
}

module.exports = ConfigManager;