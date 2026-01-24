# 使用 Node.js 官方镜像
FROM node:20-alpine AS builder

# 安装 pnpm
RUN npm install -g pnpm

WORKDIR /app

# 复制根目录依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装所有依赖（包括开发依赖）
RUN pnpm install --frozen-lockfile

# 复制 Demo 项目依赖文件
COPY demo/package.json demo/pnpm-lock.yaml ./demo/

# 安装 Demo 项目依赖
RUN cd demo && pnpm install --frozen-lockfile

# 复制剩余源代码
COPY . .

# 构建项目
RUN pnpm run build:all

# 生产阶段
FROM node:20-alpine

WORKDIR /app

# 仅复制生产依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装生产依赖（不再全局安装 pnpm）
RUN npm install --omit=dev --frozen-lockfile

# 从构建阶段复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/demo/dist ./demo/dist

# 创建日志目录并设置权限
RUN mkdir -p /app/logs && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]
