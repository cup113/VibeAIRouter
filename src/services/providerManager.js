/**
 * ProviderManager 兼容层
 * 
 * 提供与旧API完全兼容的接口，内部使用新的模块化架构。
 * 这是迁移的第一步，确保向后兼容。
 */

const NewProviderManager = require('./NewProviderManager');
const logger = require('./logger');

class ProviderManagerCompat {
  constructor() {
    this.newManager = NewProviderManager;
    this.initialized = false;
  }
  
  /**
   * 确保管理器已初始化
   */
  async ensureInitialized() {
    if (!this.initialized) {
      try {
        await this.newManager.initialize();
        this.initialized = true;
        logger.info('ProviderManager compatibility layer initialized');
      } catch (error) {
        logger.error('Failed to initialize ProviderManager:', error);
        throw error;
      }
    }
  }
  
  /**
   * 转发请求到适当的提供者
   */
  async forwardRequest(request, res = null) {
    await this.ensureInitialized();
    return await this.newManager.forwardRequest(request, res);
  }
  
  /**
   * 获取提供者状态
   */
  getProviderStatus() {
    return this.newManager.getProviderStatus();
  }
  
  /**
   * 检查所有提供者健康状态
   */
  async checkAllProvidersHealth() {
    await this.ensureInitialized();
    return await this.newManager.checkAllProvidersHealth();
  }
  
  /**
   * 重新加载配置
   */
  async reloadConfig() {
    await this.ensureInitialized();
    return await this.newManager.reloadConfig();
  }
  
  /**
   * 获取默认提供者
   */
  async getDefaultProvider() {
    await this.ensureInitialized();
    return await this.newManager.getDefaultProvider();
  }
  
  /**
   * 根据模型获取提供者
   */
  async getProviderForModel(model) {
    await this.ensureInitialized();
    return await this.newManager.getProviderForModel(model);
  }
  
  /**
   * 计算使用的token数量（保持向后兼容）
   */
  calculateTokensUsed(usage) {
    if (!usage) return 0;
    
    if (usage.total_tokens !== undefined) {
      return usage.total_tokens;
    }
    
    if (usage.completion_tokens !== undefined && usage.prompt_tokens !== undefined) {
      return usage.completion_tokens + usage.prompt_tokens;
    }
    
    if (usage.completion_tokens !== undefined) {
      return usage.completion_tokens;
    }
    
    if (usage.prompt_tokens !== undefined) {
      return usage.prompt_tokens;
    }
    
    return 0;
  }
}

// 导出单例实例，保持与旧代码兼容
const instance = new ProviderManagerCompat();
module.exports = instance;