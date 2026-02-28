FROM node:20-slim

# 安装必要的系统依赖 (用于编译 better-sqlite3 和 sharp)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制所有源代码
COPY . .

# 创建数据目录并设置权限
RUN mkdir -p data/uploads

# 构建前端 Vite 应用
RUN npm run build

# 暴露 3000 端口
EXPOSE 3000

# 启动全栈服务
CMD ["npm", "start"]
