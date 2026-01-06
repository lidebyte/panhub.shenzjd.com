# syntax=docker/dockerfile:1.7

# 构建阶段：使用 npm 安装依赖
FROM node:20-alpine AS deps
WORKDIR /app

# 安装编译工具（better-sqlite3 需要）
RUN apk add --no-cache python3 make g++ gcc libc-dev musl-dev

COPY package.json ./

# 使用 npm 安装（避免 pnpm 的复杂结构）
RUN npm install --production

# 验证 better-sqlite3 编译结果
RUN ls -la node_modules/better-sqlite3/build/Release/ 2>/dev/null || echo "⚠️ 检查编译目录"

# 构建阶段：构建应用
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
# 安装所有依赖（包括 devDependencies）
RUN npm install
# 针对 Docker，将 Nitro 预设改为 node-server 运行时
RUN NITRO_PRESET=node-server npm run build

# 运行阶段：最小化镜像
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
# 可根据需要调整日志级别：debug|info|warn|error
ENV NITRO_LOG_LEVEL=info
EXPOSE 3000

# 安装运行时依赖（better-sqlite3 需要）
RUN apk add --no-cache python3 make g++ gcc libc-dev musl-dev

# 从构建阶段复制 node_modules（包含已编译的 better-sqlite3）
COPY --from=deps /app/node_modules ./node_modules

# 从构建阶段复制 .output
COPY --from=build /app/.output ./.output

# 复制 package.json
COPY --from=build /app/package.json ./

# 创建 data 目录并设置权限（用于 SQLite 持久化）
RUN mkdir -p /app/data && chmod 777 /app/data

# 验证 better-sqlite3 是否可用
RUN node -e "try { require('better-sqlite3'); console.log('✅ better-sqlite3 可用'); } catch(e) { console.log('❌', e.message); process.exit(1); }"

CMD ["node", "--enable-source-maps", ".output/server/index.mjs"]
