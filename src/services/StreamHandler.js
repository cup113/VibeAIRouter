/**
 * StreamHandler - 专门处理流响应
 * 
 * 原则：
 * 1. 使用Node.js的pipeline API确保资源清理
 * 2. 完整的错误处理和资源释放
 * 3. 内存泄漏防护
 */

const { pipeline, PassThrough } = require('stream');
const logger = require('./logger');
const { ErrorUtils, StreamError } = require('../errors');

class StreamHandler {
  constructor() {
    this.activeStreams = new Map();
    this.nextStreamId = 1;
  }
  
  /**
   * 处理流请求
   * @param {BaseProvider} provider - 提供者实例
   * @param {Object} request - 请求数据
   * @param {Object} res - Express响应对象
   * @returns {Promise<Object>}
   */
  async handleStream(provider, request, res) {
    const streamId = this.nextStreamId++;
    const startTime = Date.now();
    
    logger.debug(`Starting stream ${streamId} for provider ${provider.name}`);
    
    try {
      // 设置流响应头
      this.setupStreamResponse(res);
      
      // 创建上游流（从提供者）
      const upstream = await this.createUpstreamStream(provider, request);
      
      // 创建下游流（到客户端）
      const downstream = new PassThrough();
      
      // 注册流以便跟踪
      this.activeStreams.set(streamId, {
        upstream,
        downstream,
        startTime,
        provider: provider.name,
        model: request.model
      });
      
      // 设置超时保护
      const timeout = provider.timeout || 30000;
      const timeoutId = setTimeout(() => {
        this.abortStream(streamId, new StreamError('Stream timeout', provider.name));
      }, timeout);
      
      // 使用pipeline确保资源清理
      return new Promise((resolve, reject) => {
        pipeline(upstream, downstream, res, async (error) => {
          // 清理超时
          clearTimeout(timeoutId);
          
          // 从活动流中移除
          this.activeStreams.delete(streamId);
          
          if (error) {
            logger.error(`Stream ${streamId} pipeline error:`, error);
            
            // 如果响应还未发送头，发送错误
            if (!res.headersSent) {
              this.sendStreamError(res, error, provider.name);
            }
            
            reject(error);
          } else {
            const responseTime = Date.now() - startTime;
            logger.debug(`Stream ${streamId} completed in ${responseTime}ms`);
            resolve({ stream: true });
          }
        });
        
        // 监听客户端断开连接
        res.on('close', () => {
          if (!downstream.destroyed) {
            logger.debug(`Stream ${streamId} aborted by client`);
            downstream.destroy();
            upstream.destroy();
            this.activeStreams.delete(streamId);
            clearTimeout(timeoutId);
          }
        });
      });
      
    } catch (error) {
      // 清理资源
      this.activeStreams.delete(streamId);
      
      logger.error(`Stream ${streamId} setup error:`, error);
      this.sendStreamError(res, error, provider.name);
      throw error;
    }
  }
  
  /**
   * 创建上游流
   */
  async createUpstreamStream(provider, request) {
    return new Promise((resolve, reject) => {
      provider.client.post('/chat/completions', request, {
        timeout: provider.timeout,
        responseType: 'stream'
      })
      .then(response => {
        const upstream = response.data;
        
        // 监听上游错误
        upstream.on('error', (error) => {
          logger.error('Upstream stream error:', error);
          upstream.destroy();
          reject(error);
        });
        
        resolve(upstream);
      })
      .catch(error => {
        reject(error);
      });
    });
  }
  
  /**
   * 设置流响应头
   */
  setupStreamResponse(res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用Nginx缓冲
    
    // 立即刷新头
    res.flushHeaders();
  }
  
  /**
   * 发送流错误
   */
  sendStreamError(res, error, providerName) {
    try {
      const normalizedError = ErrorUtils.normalizeError(error);
      const errorResponse = normalizedError.toResponse();
      
      res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
      res.end();
    } catch (e) {
      // 如果发送错误失败，直接结束响应
      logger.error('Failed to send stream error:', e);
      try {
        res.end();
      } catch (endError) {
        // 忽略结束错误
      }
    }
  }
  
  /**
   * 中止流
   */
  abortStream(streamId, error) {
    const streamInfo = this.activeStreams.get(streamId);
    if (streamInfo) {
      logger.warn(`Aborting stream ${streamId}: ${error.message}`);
      
      if (!streamInfo.upstream.destroyed) {
        streamInfo.upstream.destroy();
      }
      
      if (!streamInfo.downstream.destroyed) {
        streamInfo.downstream.destroy();
      }
      
      this.activeStreams.delete(streamId);
    }
  }
  
  /**
   * 获取活动流统计
   */
  getActiveStreams() {
    const stats = [];
    const now = Date.now();
    
    for (const [streamId, info] of this.activeStreams) {
      stats.push({
        streamId,
        provider: info.provider,
        model: info.model,
        duration: now - info.startTime,
        upstreamDestroyed: info.upstream.destroyed,
        downstreamDestroyed: info.downstream.destroyed
      });
    }
    
    return stats;
  }
  
  /**
   * 清理所有活动流
   */
  cleanupAllStreams() {
    let cleaned = 0;
    
    for (const [streamId, info] of this.activeStreams) {
      if (!info.upstream.destroyed) {
        info.upstream.destroy();
      }
      
      if (!info.downstream.destroyed) {
        info.downstream.destroy();
      }
      
      cleaned++;
    }
    
    this.activeStreams.clear();
    logger.info(`Cleaned up ${cleaned} active streams`);
    
    return cleaned;
  }
  
  /**
   * 从流数据中提取token使用量
   */
  extractTokensFromStream(chunk, currentTokens) {
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
              return this.calculateTokensUsed(data.usage);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    } catch (e) {
      // 忽略所有错误
    }
    
    return currentTokens;
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
}

module.exports = StreamHandler;