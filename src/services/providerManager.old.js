const config = require('../config');
const logger = require('./logger');
const database = require('./database');
const SiliconFlowProvider = require('../providers/siliconflow');
const GiteeProvider = require('../providers/gitee');

class ProviderManager {
  constructor() {
    this.providers = new Map();
    this.modelToProvider = new Map();
    this.initialize();
  }
  
  initialize() {
    const providerConfigs = config.get('providers');
    const modelMapping = config.get('models.mapping');
    
    for (const [providerId, providerConfig] of Object.entries(providerConfigs)) {
      if (!providerConfig.enabled) {
        logger.info(`Provider ${providerId} is disabled`);
        continue;
      }
      
      const apiKey = providerId === 'siliconflow' 
        ? process.env.SILICONFLOW_API_KEY 
        : process.env.GITEE_API_KEY;
      
      if (!apiKey) {
        logger.warn(`Provider ${providerId} has no API key configured in environment variables`);
        continue;
      }
      
      const fullConfig = {
        ...providerConfig,
        apiKey: apiKey
      };
      
      let provider;
      switch(providerId) {
        case 'siliconflow':
          provider = new SiliconFlowProvider(fullConfig);
          break;
        case 'gitee':
          provider = new GiteeProvider(fullConfig);
          break;
        default:
          logger.warn(`Unknown provider type: ${providerId}`);
          continue;
      }
      
      this.providers.set(providerId, provider);
      logger.info(`Provider ${providerId} initialized`);
    }
    
    for (const [model, providerId] of Object.entries(modelMapping)) {
      this.modelToProvider.set(model, providerId);
    }
    
    logger.info(`Provider manager initialized with ${this.providers.size} providers`);
  }
  
  getProviderForModel(model) {
    const providerId = this.modelToProvider.get(model);
    
    if (!providerId) {
      throw {
        type: 'invalid_request_error',
        message: `Model ${model} is not supported`,
        code: 'model_not_found'
      };
    }
    
    const provider = this.providers.get(providerId);
    
    if (!provider) {
      throw {
        type: 'provider_error',
        message: `Provider ${providerId} is not available`,
        code: 'provider_unavailable'
      };
    }
    
    if (!provider.isHealthy) {
      throw {
        type: 'provider_error',
        message: `Provider ${providerId} is currently unavailable`,
        code: 'provider_unhealthy'
      };
    }
    
    return provider;
  }
  
  getDefaultProvider() {
    const defaultModel = config.get('models.default');
    return this.getProviderForModel(defaultModel);
  }
  
  async forwardRequest(request, res = null) {
    const model = request.model || config.get('models.default');
    const provider = this.getProviderForModel(model);
    const startTime = Date.now();
    
    logger.debug(`Forwarding request to ${provider.name} for model ${model}, stream: ${request.stream}`);
    
    try {
      if (request.stream && res) {
        return await this.handleStreamRequest(provider, request, res);
      } else {
        const response = await provider.chatCompletion(request);
        const responseTime = Date.now() - startTime;
        
        const tokensUsed = this.calculateTokensUsed(response.usage);
        
        database.recordRequest({
          model,
          provider: provider.name,
          success: true,
          responseTime,
          tokensUsed,
          errorMessage: null
        });
        
        return response;
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      database.recordRequest({
        model,
        provider: provider.name,
        success: false,
        responseTime,
        tokensUsed: 0,
        errorMessage: error.message
      });
      
      logger.error(`Provider ${provider.name} error:`, error);
      throw error;
    }
  }
  
  async handleStreamRequest(provider, request, res) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      provider.client.post('/chat/completions', request, {
        timeout: provider.timeout,
        responseType: 'stream'
      })
      .then(response => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        let tokensReceived = 0;
        const chunks = [];
        
        response.data.on('data', (chunk) => {
          res.write(chunk);
          chunks.push(chunk);
          
          try {
            const chunkStr = chunk.toString();
            const lines = chunkStr.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                if (dataStr === '[DONE]') continue;
                
                try {
                  const data = JSON.parse(dataStr);
                  if (data.usage) {
                    tokensReceived = this.calculateTokensUsed(data.usage);
                  }
                } catch (e) {
                }
              }
            }
          } catch (e) {
          }
        });
        
        response.data.on('end', () => {
          const responseTime = Date.now() - startTime;
          
          database.recordRequest({
            model: request.model,
            provider: provider.name,
            success: true,
            responseTime,
            tokensUsed: tokensReceived,
            errorMessage: null
          });
          
          res.end();
          resolve({ stream: true });
        });
        
        response.data.on('error', (error) => {
          const responseTime = Date.now() - startTime;
          
          database.recordRequest({
            model: request.model,
            provider: provider.name,
            success: false,
            responseTime,
            tokensUsed: 0,
            errorMessage: error.message
          });
          
          logger.error('Stream error:', error);
          res.write(`data: ${JSON.stringify({
            error: {
              message: 'Stream error',
              type: 'stream_error',
              code: 'stream_error'
            }
          })}\n\n`);
          res.end();
          reject(error);
        });
      })
      .catch(error => {
        const responseTime = Date.now() - startTime;
        
        database.recordRequest({
          model: request.model,
          provider: provider.name,
          success: false,
          responseTime,
          tokensUsed: 0,
          errorMessage: error.message
        });
        
        reject(error);
      });
    });
  }
  
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
  
  getProviderStatus() {
    const status = {};
    
    for (const [providerId, provider] of this.providers) {
      status[providerId] = provider.getStatus();
    }
    
    return status;
  }
  
  reloadConfig() {
    this.providers.clear();
    this.modelToProvider.clear();
    this.initialize();
  }
  
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

module.exports = new ProviderManager();