# VibeAI Router 重构架构设计

## 核心问题识别

### 1. 数据结构混乱
**当前**：三重映射（providers Map + modelToProvider Map + config.mapping）
**目标**：单一数据结构，直接映射模型->提供者

### 2. 错误处理垃圾
**当前**：到处throw对象字面量
**目标**：统一的错误类体系

### 3. 上帝类（ProviderManager）
**当前**：300行，做所有事情
**目标**：拆分为专注的小类

### 4. 配置管理复杂
**当前**：环境变量 + JSON + 硬编码
**目标**：清晰的优先级链

## 新架构设计

### 1. 核心数据结构

```javascript
// 单一映射：模型 -> 提供者实例
class ProviderRegistry {
  constructor() {
    // Map<modelName, Provider>
    this.modelProviders = new Map();
    // Map<providerId, Provider>
    this.providers = new Map();
  }
  
  // 直接查找，不需要中间映射
  getProviderForModel(model) {
    const provider = this.modelProviders.get(model);
    if (!provider) throw new ModelNotFoundError(model);
    return provider;
  }
}
```

### 2. 错误处理体系

```javascript
// src/errors/index.js
class VibeAIError extends Error {
  constructor(type, message, code, provider = null) {
    super(message);
    this.type = type;
    this.code = code;
    this.provider = provider;
  }
}

class ModelNotFoundError extends VibeAIError {
  constructor(model) {
    super('model_not_found', `Model ${model} is not supported`, 'model_not_found');
    this.model = model;
  }
}

class ProviderError extends VibeAIError {
  constructor(message, code, provider) {
    super('provider_error', message, code, provider);
  }
}

class RateLimitError extends VibeAIError {
  constructor(provider = null) {
    super('rate_limit_error', 'Rate limit exceeded', 'rate_limit_exceeded', provider);
  }
}
```

### 3. 类职责拆分

```
ProviderManager (300行) -> 拆分为：
├── ProviderRegistry (50行) - 注册和查找提供者
├── RequestForwarder (80行) - 处理请求转发逻辑
├── StreamHandler (60行) - 专门处理流响应
├── HealthMonitor (40行) - 健康检查和状态管理
└── ConfigManager (50行) - 配置加载和热重载
```

### 4. 配置优先级链

```
优先级（高 -> 低）：
1. 环境变量（process.env）
2. 命令行参数
3. 配置文件（local.json > {env}.json > default.json）
4. 代码默认值
```

### 5. Stream处理改进

**问题**：当前stream处理可能泄漏内存，错误处理不完整
**方案**：使用Node.js的pipeline API，确保资源清理

```javascript
const { pipeline } = require('stream');

class StreamHandler {
  async handleStream(provider, request, res) {
    const upstream = await provider.createStream(request);
    const downstream = new PassThrough();
    
    // 使用pipeline确保资源清理
    pipeline(upstream, downstream, res, (error) => {
      if (error) {
        logger.error('Stream pipeline error:', error);
        // 确保响应结束
        if (!res.headersSent) {
          res.status(500).end();
        }
      }
    });
  }
}
```

## 重构步骤

### 阶段1：错误处理统一（1天）
1. 创建错误类体系
2. 替换所有throw对象字面量
3. 更新错误处理中间件

### 阶段2：数据结构简化（1天）
1. 实现ProviderRegistry
2. 移除modelToProvider映射
3. 简化配置加载

### 阶段3：拆分ProviderManager（2天）
1. 提取RequestForwarder
2. 提取StreamHandler
3. 提取HealthMonitor
4. 提取ConfigManager

### 阶段4：配置系统重构（1天）
1. 实现清晰的配置优先级
2. 简化配置热重载
3. 移除硬编码值

### 阶段5：并发安全（1天）
1. 添加适当的锁机制
2. 确保provider状态更新的原子性
3. 添加请求队列管理

### 阶段6：测试和验证（1天）
1. 更新现有测试
2. 添加新架构的单元测试
3. 验证API向后兼容性

## 向后兼容性保证

### 必须保持不变的：
1. API端点（/v1/chat/completions, /health, /admin/*）
2. 请求/响应格式
3. 错误响应格式（类型和代码）
4. 配置格式（JSON结构）
5. 环境变量名称

### 可以改进的：
1. 内部错误处理机制
2. 配置加载逻辑
3. Provider管理方式
4. Stream处理实现

## 风险缓解

### 高风险：
- Stream处理重构可能引入新的bug
- 配置热重载可能中断正在处理的请求

### 缓解措施：
1. 分阶段重构，每个阶段都有测试
2. 保持旧代码和新代码并行运行，逐步切换
3. 添加详细的日志记录，便于调试
4. 创建回滚计划

## 成功标准

1. ✅ 代码行数减少30%（从~1000行到~700行）
2. ✅ 类平均大小<100行
3. ✅ 消除所有硬编码的特殊情况
4. ✅ 保持100% API向后兼容
5. ✅ 所有现有测试通过
6. ✅ 内存使用减少（stream处理改进）
7. ✅ 错误处理统一且类型安全

## 时间估算

总计：7-8天
- 设计：1天
- 实现：5天
- 测试和验证：1-2天

---

*记住Linus的原则：*
1. **"好品味"** - 消除特殊情况，让正常情况处理一切
2. **"Never break userspace"** - 向后兼容是铁律
3. **实用主义** - 解决真实问题，不是假想问题
4. **简洁** - 如果超过3层缩进，重新设计