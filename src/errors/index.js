/**
 * VibeAI Router 错误处理系统
 * 
 * 原则：
 * 1. 所有错误都是类实例，不是对象字面量
 * 2. 错误类型清晰，便于中间件处理
 * 3. 保持向后兼容（错误格式不变）
 */

class VibeAIError extends Error {
  /**
   * @param {string} type - 错误类型（保持与现有代码兼容）
   * @param {string} message - 错误消息
   * @param {string} code - 错误代码
   * @param {string|null} provider - 相关的提供者名称
   */
  constructor(type, message, code, provider = null) {
    super(message);
    this.type = type;
    this.code = code;
    this.provider = provider;
    
    // 保持与现有错误处理兼容
    this.name = 'VibeAIError';
  }
  
  /**
   * 转换为API响应格式
   */
  toResponse() {
    return {
      error: {
        message: this.message,
        type: this.type,
        code: this.code,
        ...(this.provider && { provider: this.provider })
      }
    };
  }
}

/**
 * 模型未找到错误
 */
class ModelNotFoundError extends VibeAIError {
  constructor(model) {
    super('invalid_request_error', `Model ${model} is not supported`, 'model_not_found');
    this.model = model;
    this.name = 'ModelNotFoundError';
  }
}

/**
 * 提供者错误基类
 */
class ProviderError extends VibeAIError {
  constructor(message, code, provider) {
    super('provider_error', message, code, provider);
    this.name = 'ProviderError';
  }
}

/**
 * 提供者不可用错误
 */
class ProviderUnavailableError extends ProviderError {
  constructor(provider) {
    super(`Provider ${provider} is not available`, 'provider_unavailable', provider);
    this.name = 'ProviderUnavailableError';
  }
}

/**
 * 提供者不健康错误
 */
class ProviderUnhealthyError extends ProviderError {
  constructor(provider) {
    super(`Provider ${provider} is currently unavailable`, 'provider_unhealthy', provider);
    this.name = 'ProviderUnhealthyError';
  }
}

/**
 * 速率限制错误
 */
class RateLimitError extends VibeAIError {
  constructor(provider = null) {
    super('rate_limit_error', 'Rate limit exceeded', 'rate_limit_exceeded', provider);
    this.name = 'RateLimitError';
  }
}

/**
 * 认证错误
 */
class AuthenticationError extends VibeAIError {
  constructor(provider = null) {
    super('authentication_error', 'Invalid API key or authentication failed', 'invalid_api_key', provider);
    this.name = 'AuthenticationError';
  }
}

/**
 * 超时错误
 */
class TimeoutError extends VibeAIError {
  constructor(provider = null) {
    super('timeout_error', 'Request timeout', 'timeout', provider);
    this.name = 'TimeoutError';
  }
}

/**
 * 网络错误
 */
class NetworkError extends VibeAIError {
  constructor(message = 'Network error', provider = null) {
    super('network_error', message, 'network_error', provider);
    this.name = 'NetworkError';
  }
}

/**
 * 流处理错误
 */
class StreamError extends VibeAIError {
  constructor(message = 'Stream error', provider = null) {
    super('stream_error', message, 'stream_error', provider);
    this.name = 'StreamError';
  }
}

/**
 * 验证错误
 */
class ValidationError extends VibeAIError {
  constructor(message) {
    super('invalid_request_error', message, 'invalid_request');
    this.name = 'ValidationError';
  }
}

/**
 * 配置错误
 */
class ConfigError extends VibeAIError {
  constructor(message) {
    super('config_error', message, 'config_error');
    this.name = 'ConfigError';
  }
}

/**
 * 数据库错误
 */
class DatabaseError extends VibeAIError {
  constructor(message) {
    super('database_error', message, 'database_error');
    this.name = 'DatabaseError';
  }
}

/**
 * 错误工具函数
 */
class ErrorUtils {
  /**
   * 将未知错误转换为VibeAIError
   */
  static normalizeError(error) {
    if (error instanceof VibeAIError) {
      return error;
    }
    
    if (error.response) {
      // Axios响应错误
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 429) {
        return new RateLimitError();
      }
      
      if (status === 401 || status === 403) {
        return new AuthenticationError();
      }
      
      return new ProviderError(
        data.error?.message || `Provider error: ${status}`,
        data.error?.code || 'provider_error',
        null
      );
    }
    
    if (error.code === 'ECONNABORTED') {
      return new TimeoutError();
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new NetworkError(error.message);
    }
    
    // 未知错误
    return new VibeAIError(
      'internal_error',
      error.message || 'Internal server error',
      'server_error'
    );
  }
  
  /**
   * 根据错误类型获取HTTP状态码
   */
  static getStatusCode(error) {
    if (error instanceof ModelNotFoundError || error instanceof ValidationError) {
      return 400;
    }
    
    if (error instanceof RateLimitError) {
      return 429;
    }
    
    if (error instanceof AuthenticationError) {
      return 500; // 保持向后兼容，现有代码返回500
    }
    
    if (error instanceof ProviderError || 
        error instanceof ProviderUnavailableError || 
        error instanceof ProviderUnhealthyError) {
      return 503;
    }
    
    if (error instanceof TimeoutError || error instanceof NetworkError) {
      return 504;
    }
    
    // 默认
    return 500;
  }
  
  /**
   * 错误处理中间件
   */
  static errorHandler(err, req, res, next) {
    const error = ErrorUtils.normalizeError(err);
    const statusCode = ErrorUtils.getStatusCode(error);
    
    // 记录错误
    const logger = require('../services/logger');
    logger.error(`${error.name}: ${error.message}`, {
      type: error.type,
      code: error.code,
      provider: error.provider,
      url: req.url,
      method: req.method
    });
    
    // 流请求的特殊处理
    if (req.body?.stream) {
      res.write(`data: ${JSON.stringify(error.toResponse())}\n\n`);
      res.end();
      return;
    }
    
    // 普通请求
    res.status(statusCode).json(error.toResponse());
  }
}

module.exports = {
  VibeAIError,
  ModelNotFoundError,
  ProviderError,
  ProviderUnavailableError,
  ProviderUnhealthyError,
  RateLimitError,
  AuthenticationError,
  TimeoutError,
  NetworkError,
  StreamError,
  ValidationError,
  ConfigError,
  DatabaseError,
  ErrorUtils
};