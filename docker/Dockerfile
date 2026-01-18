FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

# 安装pnpm
RUN npm install -g pnpm

COPY package*.json ./

# 使用pnpm安装生产依赖
RUN pnpm install --prod --frozen-lockfile

COPY . .

RUN mkdir -p logs

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "src/app.js"]