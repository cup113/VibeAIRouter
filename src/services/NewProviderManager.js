/**
 * NewProviderManager - 重构后的提供者管理器
 * 
 * 整合：
 * 1. ProviderRegistry - 提供者注册和查找
 * 2. RequestForwarder - 请求转发
 * 3. ConfigManager - 配置管理
 * 
 * 原则：
 * 1. 每个类只做一件事
 * 2. 依赖注入，便于测试
 * 3. 向后兼容的API
 */

const path = require('path');
const SiliconFlowProvider = require('../providers/siliconflow');
const GiteeProvider = require('../providers/gitee');
const ProviderRegistry = require('./ProviderRegistry');
const RequestForwarder = require('./RequestForwarder');
const ConfigManager = require('./ConfigManager');
const logger = require('./logger');

class NewProviderManager {
  constructor() {
    this.configManager = new ConfigManager();
    this.providerRegistry = new ProviderRegistry();
    this.requestForwarder = new RequestForwarder(this.providerRegistry);
    
    this.initialized = false;
  }
  
  /**
   * 初始化提供者管理器
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('Provider manager already initialized');
      return;
    }
    
    try {
      // 1. 初始化配置管理器
      const configDir = process.env.CONFIG_DIR || path.join(__dirname, '../../config');
      await this.configManager.initialize(configDir);
      
      // 2. 注册配置变更监听器
      this.configManager.addListener((config) => this.onConfigChanged(config));
      
      // 3. 初始化提供者
      await this.initializeProviders();
      
      this.initialized = true;
      logger.info('New provider manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize provider manager:', error);
      throw error;
    }
  }
  
  /**
   * 初始化提供者
   */
  async initializeProviders() {
    const providerConfigs = this.configManager.get('providers', {});
    const modelMapping = this.configManager.getModelMapping();
    
    // 清除现有注册
    this.providerRegistry.clear();
    
    for (const [providerId, providerConfig] of Object.entries(providerConfigs)) {
      if (!providerConfig.enabled) {
        logger.info(`Provider ${providerId} is disabled`);
        continue;
      }
      
      // 获取API密钥
      const apiKey = this.getApiKeyForProvider(providerId);
      if (!apiKey) {
        logger.warn(`Provider ${providerId} has no API key configured`);
        continue;
      }
      
      // 创建提供者实例
      const provider = this.createProvider(providerId, {
        ...providerConfig,
        apiKey
      });
      
      if (!provider) {
        logger.warn(`Failed to create provider ${providerId}`);
        continue;
      }
      
      // 获取该提供者支持的模型
      const models = this.configManager.getProviderModels(providerId);
      
      // 注册提供者
      await this.providerRegistry.registerProvider(providerId, provider, models);
      
      logger.info(`Provider ${providerId} initialized with ${models.length} models`);
    }
    
    const totalModels = this.providerRegistry.getAllModels().length;
    logger.info(`Provider initialization complete: ${totalModels} models available`);
  }
  
  /**
   * 获取提供者的API密钥
   */
  getApiKeyForProvider(providerId) {
    const envVarName = `${providerId.toUpperCase()}_API_KEY`;
    return process.env[envVarName];
  }
  
  /**
   * 创建提供者实例
   */
  createProvider(providerId, config) {
    switch(providerId.toLowerCase()) {
      case 'siliconflow':
        return new SiliconFlowProvider(config);
      case 'gitee':
        return new GiteeProvider(config);
      default:
        logger.warn(`Unknown provider type: ${providerId}`);
        return null;
    }
  }
  
  /**
   * 配置变更回调
   */
  onConfigChanged(config) {
    logger.info('Configuration changed, reloading providers...');
    
    // 在下一个事件循环中重新初始化，避免阻塞配置加载
    setImmediate(() => {
      this.initializeProviders().catch(error => {
        logger.error('Failed to reload providers after config change:', error);
      });
    });
  }
  
  /**
   * 转发请求（兼容旧API）
   */
  async forwardRequest(request, res = null) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return await this.requestForwarder.forwardRequest(request, res);
  }
  
  /**
   * 获取提供者状态（兼容旧API）
   */
  getProviderStatus() {
    return this.providerRegistry.getProviderStatus();
  }
  
  /**
   * 检查所有提供者健康状态（兼容旧API）
   */
  async checkAllProvidersHealth() {
    return await this.providerRegistry.checkAllProvidersHealth();
  }
  
  /**
   * 重新加载配置（兼容旧API）
   */
  async reloadConfig() {
    await this.configManager.reload();
    return true;
  }
  
  /**
   * 获取默认提供者（兼容旧API）
   */
  getDefaultProvider() {
    const defaultModel = this.configManager.getDefaultModel();
    return this.providerRegistry.getDefaultProvider(defaultModel);
  }
  
  /**
   * 获取提供者（兼容旧API）
   */
  getProviderForModel(model) {
    return this.providerRegistry.getProviderForModel(model);
  }
  
  /**
   * 获取配置管理器（用于测试和扩展）
   */
  getConfigManager() {
    return this.configManager;
  }
  
  /**
   * 获取提供者注册表（用于测试和扩展）
   */
  getProviderRegistry() {
    return this.providerRegistry;
  }
  
  /**
   * 获取请求转发器（用于测试和扩展）
   */
  getRequestForwarder() {
    return this.requestForwarder;
  }
  
  /**
   * 清理资源
   */
  async cleanup() {
    this.configManager.cleanup();
    this.providerRegistry.clear();
    this.initialized = false;
    logger.info('Provider manager cleaned up');
  }
}

// 向后兼容：导出单例实例
const instance = new NewProviderManager();
module.exports = instance;