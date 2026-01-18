/**
 * ProviderRegistry - 提供者注册和管理
 * 
 * 原则：
 * 1. 单一数据结构：模型直接映射到提供者
 * 2. 简单的查找逻辑，没有中间映射
 * 3. 线程安全的操作
 */

const { ModelNotFoundError, ProviderUnavailableError, ProviderUnhealthyError } = require('../errors');
const logger = require('./logger');

class ProviderRegistry {
  constructor() {
    // Map<modelName, Provider> - 模型直接映射到提供者
    this.modelProviders = new Map();
    // Map<providerId, Provider> - 按ID索引提供者
    this.providers = new Map();
    
    // 改进的并发安全机制
    this.locks = new Map(); // 细粒度锁
    this.readWriteLock = {
      readers: 0,
      writers: 0,
      waitingWriters: 0,
      mutex: new Promise(resolve => resolve()), // 初始已解决的promise
    };
  }
  
  /**
   * 获取写锁
   * @private
   */
  async acquireWriteLock() {
    this.readWriteLock.waitingWriters++;
    
    // 等待所有读者完成
    while (this.readWriteLock.readers > 0) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    // 等待其他写者完成
    while (this.readWriteLock.writers > 0) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    this.readWriteLock.waitingWriters--;
    this.readWriteLock.writers++;
  }
  
  /**
   * 释放写锁
   * @private
   */
  releaseWriteLock() {
    this.readWriteLock.writers--;
  }
  
  /**
   * 获取读锁
   * @private
   */
  async acquireReadLock() {
    // 等待写者完成
    while (this.readWriteLock.writers > 0 || this.readWriteLock.waitingWriters > 0) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    this.readWriteLock.readers++;
  }
  
  /**
   * 释放读锁
   * @private
   */
  releaseReadLock() {
    this.readWriteLock.readers--;
  }
  
  /**
   * 注册提供者及其支持的模型
   * @param {string} providerId - 提供者ID
   * @param {BaseProvider} provider - 提供者实例
   * @param {Array<string>} models - 支持的模型列表
   */
  async registerProvider(providerId, provider, models) {
    await this.acquireWriteLock();
    
    try {
      // 检查是否已注册
      if (this.providers.has(providerId)) {
        logger.warn(`Provider ${providerId} is already registered, updating...`);
      }
      
      // 存储providerId到provider实例中，便于查找
      provider._providerId = providerId;
      
      // 注册提供者
      this.providers.set(providerId, provider);
      logger.info(`Provider ${providerId} registered`);
      
      // 注册模型映射
      for (const model of models) {
        this.modelProviders.set(model, provider);
        logger.debug(`Model ${model} mapped to provider ${providerId}`);
      }
      
      return true;
    } finally {
      this.releaseWriteLock();
    }
  }
  
  /**
   * 根据模型名称获取提供者
   * @param {string} model - 模型名称
   * @returns {BaseProvider}
   * @throws {ModelNotFoundError} 模型未找到
   * @throws {ProviderUnavailableError} 提供者不可用
   * @throws {ProviderUnhealthyError} 提供者不健康
   */
  async getProviderForModel(model) {
    await this.acquireReadLock();
    
    try {
      const provider = this.modelProviders.get(model);
      
      if (!provider) {
        throw new ModelNotFoundError(model);
      }
      
      // 检查提供者是否可用
      if (!provider._providerId || !this.providers.has(provider._providerId)) {
        throw new ProviderUnavailableError(provider.name);
      }
      
      // 检查提供者健康状态
      if (!provider.isHealthy) {
        throw new ProviderUnhealthyError(provider.name);
      }
      
      return provider;
    } finally {
      this.releaseReadLock();
    }
  }
  
  /**
   * 获取默认提供者
   * @param {string} defaultModel - 默认模型名称
   * @returns {BaseProvider}
   */
  async getDefaultProvider(defaultModel) {
    return await this.getProviderForModel(defaultModel);
  }
  
  /**
   * 获取所有提供者状态
   * @returns {Object} 提供者状态信息
   */
  async getProviderStatus() {
    await this.acquireReadLock();
    
    try {
      const status = {};
      
      for (const [providerId, provider] of this.providers) {
        status[providerId] = provider.getStatus();
      }
      
      return status;
    } finally {
      this.releaseReadLock();
    }
  }
  
  /**
   * 检查所有提供者健康状态
   * @returns {Promise<Object>} 健康检查结果
   */
  async checkAllProvidersHealth() {
    const results = {};
    
    for (const [providerId, provider] of this.providers) {
      try {
        const isHealthy = await provider.checkHealth();
        results[providerId] = {
          healthy: isHealthy,
          status: provider.getStatus()
        };
      } catch (error) {
        logger.error(`Health check failed for ${providerId}:`, error);
        results[providerId] = {
          healthy: false,
          error: error.message
        };
      }
    }
    
    return results;
  }
  
  /**
   * 获取支持的模型列表
   * @returns {Array<string>} 所有支持的模型
   */
  async getAllModels() {
    await this.acquireReadLock();
    
    try {
      return Array.from(this.modelProviders.keys());
    } finally {
      this.releaseReadLock();
    }
  }
  
  /**
   * 获取提供者支持的模型
   * @param {string} providerId - 提供者ID
   * @returns {Array<string>} 该提供者支持的模型
   */
  async getModelsByProvider(providerId) {
    await this.acquireReadLock();
    
    try {
      const models = [];
      const provider = this.providers.get(providerId);
      
      if (!provider) {
        return models;
      }
      
      for (const [model, modelProvider] of this.modelProviders) {
        if (modelProvider === provider) {
          models.push(model);
        }
      }
      
      return models;
    } finally {
      this.releaseReadLock();
    }
  }
  
  /**
   * 清除所有注册的提供者
   */
  async clear() {
    await this.acquireWriteLock();
    
    try {
      this.modelProviders.clear();
      this.providers.clear();
      this.locks.clear();
      logger.info('Provider registry cleared');
    } finally {
      this.releaseWriteLock();
    }
  }
  
  /**
   * 重新加载配置
   * @param {Function} initCallback - 初始化回调函数
   */
  async reload(initCallback) {
    await this.acquireWriteLock();
    
    try {
      // 保存当前提供者状态（用于优雅重启）
      const oldProviders = new Map(this.providers);
      
      // 清除当前注册
      this.modelProviders.clear();
      this.providers.clear();
      this.locks.clear();
      
      // 执行初始化
      if (typeof initCallback === 'function') {
        await initCallback();
      }
      
      logger.info('Provider registry reloaded');
      return true;
    } finally {
      this.releaseWriteLock();
    }
  }
}

module.exports = ProviderRegistry;