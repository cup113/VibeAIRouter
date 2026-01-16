// 在导入app之前加载测试设置
require('./setup');

const request = require('supertest');

// 延迟导入app，确保模拟已设置
let app;
beforeAll(() => {
  // 清除require缓存以确保使用模拟
  delete require.cache[require.resolve('../src/app')];
  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve('../src/services/database')];
  delete require.cache[require.resolve('../src/services/providerManager')];
  
  app = require('../src/app');
});

describe('VibeAI Router Basic Tests', () => {
  test('Health endpoint should return status', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('services');
  });
  
  test('Invalid route should return 404', async () => {
    const response = await request(app).get('/invalid-route');
    
    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.type).toBe('invalid_request_error');
  });
  
  test('Chat completion without body should return 400', async () => {
    const response = await request(app)
      .post('/v1/chat/completions')
      .send({});
    
    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });
  
  test('Rate limiting headers should be present', async () => {
    const response = await request(app).get('/health');
    
    expect(response.headers).toHaveProperty('x-ratelimit-limit');
    expect(response.headers).toHaveProperty('x-ratelimit-remaining');
  });
});