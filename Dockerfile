# 阶段 1: 构建前端静态文件
FROM node:20-slim AS builder

WORKDIR /app

# 复制 package.json 并安装依赖
COPY package*.json ./
RUN npm install

# 复制所有源代码并构建
COPY . .
RUN npm run build

# 阶段 2: 运行生产环境服务
FROM node:20-slim

# 安装 SQLite 编译环境 (better-sqlite3 需要)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制依赖定义并仅安装生产依赖
COPY package*.json ./
RUN npm install --omit=dev && npm install -g tsx

# 从 builder 阶段复制构建好的前端文件
COPY --from=builder /app/dist ./dist

# 复制后端源码和必要文件
COPY server.ts ./
COPY src/db.ts ./src/
COPY src/types.ts ./src/
COPY structure.md ./
COPY tsconfig*.json ./
# 如果有其他后端依赖的文件，也需要在这里 COPY

# 创建数据目录并设置权限
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV DATA_DIR=/app/data

# 启动全栈服务
CMD ["tsx", "server.ts"]
