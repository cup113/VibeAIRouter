# VibeAI Router - 架构参考

## 项目概述

基于 Express.js 的 AI 路由服务，用于管理和路由不同 AI 模型请求。使用 TypeScript 开发，支持 Docker 部署。

## 技术栈

- **运行时**: Node.js 18+
- **框架**: Express.js
- **语言**: TypeScript
- **包管理器**: pnpm
- **数据库**: PocketBase (SQLite)
- **开发工具**: ts-node-dev, ESLint, Prettier
- **日志**: Winston + Daily Rotate File
- **安全**: CORS, express-rate-limit, Zod

## 项目结构

```
VibeAIRouter/
├── src/                          # 源代码
│   ├── middleware/              # 中间件
│   ├── routes/                  # 路由
│   ├── types/                   # 类型定义
│   ├── database.ts              # 数据库连接
│   ├── logger.ts                # 日志配置
│   └── main.ts                  # 应用入口
├── demo/                        # 演示前端项目
│   ├── src/                     # 前端源代码
│   ├── public/                  # 静态资源
│   ├── index.html               # SPA 入口
│   └── package.json             # 前端依赖
├── db/                          # 数据库文件
├── dist/                        # 构建输出
├── logs/                        # 日志目录
├── package.json                 # 项目依赖
├── tsconfig.json                # TypeScript 配置
├── Dockerfile                   # Docker 配置
└── docker-compose.yml           # Docker Compose
```

## 核心架构

### 1. 应用层

- **App 类**: 封装 Express 应用生命周期
- **优雅关闭**: SIGINT/SIGTERM 信号处理
- **连接跟踪**: 实时监控活跃连接

### 2. 中间件管道

```
请求 → 超时处理 → CORS → 请求体解析 → 日志
      → 上下文 → 速率限制 → 安全头部 → 路由
```

### 3. 数据库层

- PocketBase 客户端提供数据访问
- 自动重连和连接状态监控
- 使用 `pocketbase-typegen` 生成 TypeScript 类型

### 4. 路由系统

- `/health` - 健康检查
- `/api/v1/*` - 业务接口
- `/public/*` - 静态资源服务

### 5. 错误处理

- 全局异常捕获
- 统一错误响应格式
- 请求超时处理 (408)

## 开发命令 (pnpm)

### 基本操作

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm run dev

# 构建项目
pnpm run build

# 生产环境运行
pnpm run start:prod
```

### 工具命令

```bash
# 代码检查
pnpm run lint

# 代码格式化
pnpm run format

# 启动数据库
pnpm run db

# 生成类型定义
pnpm run type-gen
```

## 部署配置

### 环境变量

```bash
NODE_ENV=production

DATABASE_URL=./db/pb_data/data.db
```

### Docker 部署

- 多阶段构建: 构建阶段 + 生产阶段
- 容器编排: Express (3000) + PocketBase (4162)
- 非 root 用户运行

## 前端集成方案

### Demo 项目构建

```bash
cd demo
pnpm run build
# 输出到 demo/dist
```

### Express 静态服务

```typescript
// main.ts 配置
import path from 'path';

// 服务静态文件
app.use(express.static(path.join(__dirname, '../demo/dist')));

// SPA 路由回退
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../demo/dist/index.html'));
});
```

## 开发规范

### 代码质量

- TypeScript 严格模式
- ESLint (Airbnb TypeScript 规则)
- Prettier 代码格式化

### 安全实践

- 输入验证 (Zod)
- 速率限制
- 安全头部 (CSP, HSTS)
- 环境变量管理密钥

### 性能考虑

- 连接池管理
- 实施缓存策略
