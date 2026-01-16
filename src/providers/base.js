const axios = require('axios');
const logger = require('../services/logger');
const { 
  RateLimitError, 
  AuthenticationError, 
  TimeoutError, 
  NetworkError,
  ProviderError 
} = require('../errors');

class BaseProvider {
  constructor(config) {
    this.name = config.name;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.enabled = config.enabled;
    this.priority = config.priority;
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 2;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    
    this.isHealthy = true;
    this.lastError = null;
    this.errorCount = 0;
    this.maxErrorCount = 5;
  }
  
  async chatCompletion(request) {
    try {
      const response = await this.client.post('/chat/completions', request, {
        timeout: this.timeout,
        responseType: request.stream ? 'stream' : 'json'
      });
      
      this.resetErrorState();
      
      if (request.stream && response.data) {
        return response.data;
      }
      
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }
  
  async checkHealth() {
    try {
      const testRequest = {
        model: this.getTestModel(),
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      };
      
      const response = await this.client.post('/chat/completions', testRequest, {
        timeout: 10000
      });
      
      this.isHealthy = true;
      this.lastError = null;
      return true;
    } catch (error) {
      this.isHealthy = false;
      this.lastError = error.message;
      this.errorCount++;
      
      if (this.errorCount >= this.maxErrorCount) {
        logger.warn(`Provider ${this.name} marked as unhealthy after ${this.errorCount} errors`);
      }
      
      return false;
    }
  }
  
  getTestModel() {
    return 'Qwen/Qwen3-8B';
  }
  
  handleError(error) {
    this.errorCount++;
    this.lastError = error.message;
    
    if (this.errorCount >= this.maxErrorCount) {
      this.isHealthy = false;
      logger.warn(`Provider ${this.name} marked as unhealthy due to errors`);
    }
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 429) {
        throw new RateLimitError(this.name);
      }
      
      if (status === 401 || status === 403) {
        throw new AuthenticationError(this.name);
      }
      
      throw new ProviderError(
        data.error?.message || `Provider error: ${status}`,
        data.error?.code || 'provider_error',
        this.name
      );
    }
    
    if (error.code === 'ECONNABORTED') {
      throw new TimeoutError(this.name);
    }
    
    throw new NetworkError(error.message || 'Network error', this.name);
  }
  
  resetErrorState() {
    this.errorCount = 0;
    this.isHealthy = true;
    this.lastError = null;
  }
  
  getStatus() {
    return {
      name: this.name,
      enabled: this.enabled,
      healthy: this.isHealthy,
      priority: this.priority,
      errorCount: this.errorCount,
      lastError: this.lastError
    };
  }
}

module.exports = BaseProvider;