# VibeAI Router 操作指南

## 开发环境设置

### 1. 安装依赖
```bash
# 使用 pnpm 安装依赖
pnpm install

# 或使用 npm
npm install
```

### 2. 环境配置
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，添加 API 密钥
# SILICONFLOW_API_KEY=your_key_here
# GITEE_API_KEY=your_key_here
```

### 3. 开发服务器
```bash
# 开发模式（热重载）
pnpm run dev

# 生产模式
pnpm start
```

## 代码质量检查

### 代码规范检查
```bash
# 运行 ESLint 检查
pnpm run lint

# 自动修复 ESLint 问题
pnpm run lint -- --fix
```

### 测试
```bash
# 运行所有测试
pnpm test

# 运行特定测试文件
pnpm test test/basic.test.js

# 查看测试覆盖率
pnpm test -- --coverage
```

## Docker 操作

### 构建和运行
```bash
# 构建 Docker 镜像
pnpm run docker:build

# 启动 Docker 容器
pnpm run docker:up

# 停止 Docker 容器
pnpm run docker:down

# 查看容器日志
docker-compose logs -f
```

### 开发环境 Docker
```bash
# 使用开发配置启动
docker-compose -f docker-compose.dev.yml up -d
```

## 配置管理

### 配置文件结构
```
config/
├── default.json          # 默认配置
├── development.json      # 开发环境配置
├── production.json       # 生产环境配置
└── local.json           # 本地覆盖配置（git忽略）
```

### 热重载配置
配置更改会自动重新加载，无需重启服务。支持以下文件：
- 配置文件（JSON格式）
- 环境变量（.env文件）

## 架构说明

### 目录结构
```
src/
├── app.js              # 应用入口
├── config/             # 配置管理
├── middleware/         # Express中间件
├── providers/          # AI提供者实现
├── routes/            # API路由
└── services/          # 核心服务
```

### 核心组件
1. **ProviderManager** (`src/services/providerManager.js`) - 提供者管理
2. **BaseProvider** (`src/providers/base.js`) - 提供者基类
3. **配置系统** (`src/config/index.js`) - 统一配置管理

## API 端点

### 主要端点
- `POST /v1/chat/completions` - AI聊天完成
- `GET /health` - 健康检查
- `GET /admin/providers` - 提供者状态

### 请求示例
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen3-8B",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

## 添加新的 AI 提供者

### 步骤 1: 创建提供者类
在 `src/providers/` 目录下创建新文件，继承 `BaseProvider`：

```javascript
const BaseProvider = require('./base');

class NewProvider extends BaseProvider {
  constructor(config) {
    super(config);
    // 自定义初始化
  }
  
  getTestModel() {
    return 'your-test-model';
  }
}

module.exports = NewProvider;
```

### 步骤 2: 注册提供者
在 `src/services/providerManager.js` 中添加：

```javascript
const NewProvider = require('../providers/newprovider');

// 在 initialize() 方法中添加
case 'newprovider':
  provider = new NewProvider(providerConfig);
  break;
```

### 步骤 3: 更新配置
在 `config/default.json` 中添加：

```json
{
  "providers": {
    "newprovider": {
      "name": "New Provider",
      "baseUrl": "https://api.newprovider.com/v1",
      "apiKey": "",
      "enabled": true,
      "priority": 3
    }
  },
  "models": {
    "newprovider": [
      "model-1",
      "model-2"
    ],
    "mapping": {
      "model-1": "newprovider",
      "model-2": "newprovider"
    }
  }
}
```

## 故障排除

### 常见问题

#### 1. 提供者连接失败
```bash
# 检查提供者健康状态
curl http://localhost:3000/admin/providers

# 查看日志
docker-compose logs -f
```

#### 2. 配置不生效
- 确保配置文件格式正确（JSON）
- 检查环境变量是否设置
- 确认配置热重载已启用

#### 3. 速率限制错误
- 检查 `config/default.json` 中的速率限制设置
- 确认 IP 地址未被误判

### 日志级别
```bash
# 设置日志级别
LOG_LEVEL=debug pnpm run dev

# 可用级别：error, warn, info, debug
```

## 部署指南

### 生产环境准备
1. 更新 `config/production.json` 配置
2. 设置环境变量
3. 配置反向代理（Nginx/Apache）
4. 设置监控和告警

### 性能优化
- 调整连接池大小
- 配置适当的超时时间
- 启用请求缓存（如需要）

## 安全建议

### 必须配置
1. 设置强密码的 API 密钥
2. 配置适当的速率限制
3. 启用 HTTPS
4. 定期更新依赖

### 可选配置
1. IP 白名单
2. API 密钥轮换
3. 请求签名验证

## 维护任务

### 定期检查
- [ ] 更新依赖包版本
- [ ] 检查提供者 API 变更
- [ ] 验证配置有效性
- [ ] 清理日志文件

### 监控指标
- 请求成功率
- 平均响应时间
- 错误率
- 提供者健康状态

---

## 开发工作流

### 1. 创建新功能分支
```bash
git checkout -b feature/new-feature
```

### 2. 开发测试
```bash
# 运行测试确保功能正常
pnpm test

# 检查代码规范
pnpm run lint
```

### 3. 提交代码
```bash
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature
```

### 4. 创建 Pull Request
在 GitHub/GitLab 上创建 PR，等待代码审查。

---

*最后更新: 2026-01-16*