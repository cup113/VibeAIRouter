/**
 * 测试设置文件
 * 避免在测试中直接启动服务器
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // 使用随机端口

// 模拟配置系统
jest.mock('../src/config', () => ({
  get: (key) => {
    const config = {
      'env': 'test',
      'port': 0,
      'providers': {
        'siliconflow': {
          'name': 'SiliconFlow',
          'baseUrl': 'https://api.siliconflow.cn/v1',
          'enabled': false, // 测试中禁用实际提供者
          'priority': 1,
          'timeout': 30000,
          'maxRetries': 2
        }
      },
      'models': {
        'default': 'test-model',
        'mapping': {
          'test-model': 'siliconflow'
        }
      },
      'rateLimiting': {
        'ip': {
          'windowMs': 60000,
          'max': 1000, // 测试中提高限制
          'message': 'Test rate limit'
        },
        'global': {
          'windowMs': 60000,
          'max': 5000,
          'message': 'Test global limit'
        }
      }
    };
    
    if (!key) return config;
    
    const keys = key.split('.');
    let value = config;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    return value;
  }
}));

// 模拟数据库
jest.mock('../src/services/database', () => ({
  recordRequest: jest.fn(),
  getStats: jest.fn(() => ({
    overall: { total_requests: 0, successful_requests: 0 },
    byProvider: [],
    hourlyStats: []
  })),
  getRecentRequests: jest.fn(() => []),
  logAdminAction: jest.fn(),
  getAdminLogs: jest.fn(() => []),
  cleanupOldData: jest.fn(() => ({ requestsDeleted: 0, statsDeleted: 0, logsDeleted: 0 }))
}));

// 模拟providerManager
jest.mock('../src/services/providerManager', () => ({
  forwardRequest: jest.fn(async (request) => {
    if (request.model === 'error-model') {
      throw new Error('Test error');
    }
    return {
      id: 'test-chat-completion',
      object: 'chat.completion',
      created: Date.now(),
      model: request.model || 'test-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a test response'
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      }
    };
  }),
  getProviderStatus: jest.fn(() => ({})),
  checkAllProvidersHealth: jest.fn(async () => ({})),
  reloadConfig: jest.fn(async () => true),
  getDefaultProvider: jest.fn(() => ({ name: 'test-provider' })),
  getProviderForModel: jest.fn((model) => ({ name: 'test-provider' })),
  calculateTokensUsed: jest.fn((usage) => usage?.total_tokens || 0)
}));