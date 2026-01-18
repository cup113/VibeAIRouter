/**
 * RequestForwarder - 请求转发服务
 * 
 * 原则：
 * 1. 只负责请求转发，不管理提供者状态
 * 2. 统一的请求/响应处理
 * 3. 完整的错误处理
 */

const database = require('./database');
const logger = require('./logger');
const { ErrorUtils } = require('../errors');
const StreamHandler = require('./StreamHandler');

class RequestForwarder {
  constructor(providerRegistry) {
    this.providerRegistry = providerRegistry;
    this.streamHandler = new StreamHandler();
  }
  
  /**
   * 转发请求到适当的提供者
   * @param {Object} request - 原始请求数据
   * @param {Object} res - Express响应对象（用于流请求）
   * @returns {Promise<Object>} 响应数据
   */
  async forwardRequest(request, res = null) {
    const model = request.model;
    const startTime = Date.now();
    
    let provider;
    try {
      provider = await this.providerRegistry.getProviderForModel(model);
    } catch (error) {
      // 如果获取provider失败，记录错误但不尝试记录到数据库（因为没有provider信息）
      logger.error(`Failed to get provider for model ${model}:`, error);
      throw error;
    }
    
    logger.debug(`Forwarding request to ${provider.name} for model ${model}, stream: ${request.stream}`);
    
    try {
      if (request.stream && res) {
        // 使用专门的StreamHandler处理流请求
        return await this.streamHandler.handleStream(provider, request, res);
      } else {
        // 处理普通请求
        const response = await provider.chatCompletion(request);
        const responseTime = Date.now() - startTime;
        
        this.recordRequestSuccess({
          model,
          provider: provider.name,
          responseTime,
          usage: response.usage
        });
        
        return response;
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.recordRequestFailure({
        model,
        provider: provider.name,
        responseTime,
        error
      });
      
      // 重新抛出错误，让上层处理
      throw error;
    }
  }
  
  /**
   * 记录成功请求
   */
  recordRequestSuccess({ model, provider, responseTime, usage }) {
    const tokensUsed = this.calculateTokensUsed(usage);
    
    database.recordRequest({
      model,
      provider,
      success: true,
      responseTime,
      tokensUsed,
      errorMessage: null
    });
  }
  
  /**
   * 记录失败请求
   */
  recordRequestFailure({ model, provider, responseTime, error }) {
    try {
      database.recordRequest({
        model: model || 'unknown',
        provider: provider || 'unknown',
        success: false,
        responseTime,
        tokensUsed: 0,
        errorMessage: error?.message || 'Unknown error'
      });
    } catch (dbError) {
      logger.error('Failed to record request failure to database:', dbError);
    }
  }
  
  /**
   * 计算使用的token数量
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
  
  /**
   * 获取活动流统计（用于监控）
   */
  getActiveStreams() {
    return this.streamHandler.getActiveStreams();
  }
  
  /**
   * 清理所有活动流（用于优雅关闭）
   */
  cleanupAllStreams() {
    return this.streamHandler.cleanupAllStreams();
  }
}

module.exports = RequestForwarder;