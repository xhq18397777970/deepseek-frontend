# DeepSeek 前端（Vue3 + Vite）+ Flask 流式对话

本项目在同域下通过 `/api/*` 代理到 Flask 后端，实现“逐字打印”的流式对话体验。开发模式下使用 Vite 代理，生产模式下使用 Nginx 反向代理，避免跨域与确保流畅的流式传输。

## 1) 后端接口协议与路径（已确认）

代码参考：
- [`deepseek-flask-api/app.py`](../deepseek-flask-api/app.py)
- [`deepseek-flask-api/services/chat_service.py`](../deepseek-flask-api/services/chat_service.py)

要点摘要：
- 服务端口：`10086`（监听 0.0.0.0），参见 [`deepseek-flask-api/app.py`](../deepseek-flask-api/app.py)
- 路由：
  - 健康检查：GET `/`
  - 聊天接口：POST `/chat`
- CORS：在后端仅对 `/chat` 允许来自 `http://127.0.0.1:8080` 的跨域（生产将通过 Nginx 同域代理，无跨域问题；开发用 Vite 代理规避跨域）
- 请求体（JSON 或表单/原始 JSON，后端已做健壮解析）：
  - 单轮输入：`message: string`（可选 `system_message: string`）
  - 或 OpenAI 风格：`messages: Array<{ role: "system" | "user" | "assistant", content: string }>`
  - 生成可选参数：`model, temperature, max_tokens, top_p, frequency_penalty, presence_penalty, stop`
  - `stream: boolean`（默认 `true`）
- 流式响应：
  - 响应头：`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`
  - 数据格式：非标准 SSE 事件（不带 `data:` 前缀、无 `\n\n` 事件分隔）；实际为“纯文本块增量 + 特殊结束/错误标记”
    - 正常块：直接输出文本
    - 结束：输出 `"[DONE]"`
    - 错误：输出以 `"[ERROR]"` 开头的文本
  - 前端应使用 `fetch + ReadableStream` 增量解码，按块追加与根据标记结束/报错

前端调用规范（统一走同域 `/api/chat`，由代理转发至后端 `http://127.0.0.1:10086/chat`）：
- URL：POST `/api/chat`
- Headers：`Content-Type: application/json`
- Body 示例（单轮）：
  {
    "message": "你好，帮我总结一下Vue3要点",
    "system_message": "你是有帮助的助手",
    "stream": true,
    "model": "deepseek-chat",
    "temperature": 0.8,
    "max_tokens": 1024
  }
- 流消费规则：逐块追加文本；遇到 `"[DONE]"` 结束；遇到以 `"[ERROR]"` 开头的块则展示错误

## 2) 前端工程结构

目录：[`deepseek-frontend/`](.)
- 构建与依赖
  - 包配置：[`package.json`](./package.json)
  - 构建/开发配置（含 dev 代理 `/api` → `http://127.0.0.1:10086`）：[`vite.config.js`](./vite.config.js)
- 页面与入口
  - HTML 模板：[`index.html`](./index.html)
  - Vue 入口：[`src/main.js`](./src/main.js)
  - 根组件：[`src/App.vue`](./src/App.vue)
- 对话与 API
  - 对话组件（简洁消息区 + 输入区、回车发送、处理中禁用、错误提示、逐字打印）：[`src/components/ChatBox.vue`](./src/components/ChatBox.vue)
  - 流式客户端（fetch 流增量解码，处理 `[DONE]`/`[ERROR]` 标记）：[`src/api/streamClient.js`](./src/api/streamClient.js)

UI 说明：
- 不使用重量级 UI 框架，原生 CSS 少量样式
- “助手”回复按块增量渲染，滚动自动跟随
- 发送中可取消（`AbortController`）

## 3) 开发启动（无 nginx，Vite 代理联调）

1. 启动后端（首次需安装依赖）：
   - 终端 1：
     - cd `deepseek-flask-api`
     - 安装依赖：`pip install -r requirements.txt`
     - 启动：`python app.py`
     - 监听端口：`10086`
2. 启动前端（Vite）：
   - 终端 2：
     - cd `deepseek-frontend`
     - 安装依赖：`npm install`
     - 开发启动：`npm run dev`
     - 访问：http://127.0.0.1:5173
3. 验证：
   - 在页面底部输入问题并发送
   - 消息区应立即追加“你”的消息，随后“助手”的回答逐字滚动出现
   - 若后端报错或中断，消息区显示“错误”提示

说明：开发模式下，前端请求 `/api/chat` 由 Vite 代理配置 [`vite.config.js`](./vite.config.js) 转发到后端 `http://127.0.0.1:10086/chat`，浏览器同源访问 Vite，避免跨域。

## 4) 生产构建与 Nginx 反向代理（同域，支持流式）

1. 构建前端：
   - cd `deepseek-frontend`
   - `npm install`
   - `npm run build`
   - 产物目录：`deepseek-frontend/dist`
2. 配置 Nginx：
   - 使用示例配置：[`nginx/deepseek-frontend.conf`](../nginx/deepseek-frontend.conf)
   - 修改以下项：
     - 将 `root` 修改为 `deepseek-frontend/dist` 的绝对路径（例如：`/Users/你的用户名/Documents/Joy/deepseek-frontend/dist`）
     - 确认后端地址端口与实际一致（本项目为 `http://127.0.0.1:10086`）
   - 流式/SSE 关键项（配置中已包含）：
     - `proxy_http_version 1.1`
     - `proxy_buffering off`
     - `proxy_cache off`
     - `proxy_read_timeout 3600`
     - `gzip off`
     - `proxy_set_header Connection "keep-alive";`
3. 启动 Nginx（示例命令，按你本机 Nginx 安装位置调整）：
   - 将 `deepseek-frontend.conf` 放入 Nginx `conf.d` 或 `sites-enabled` 并在主配置中 `include` 该文件
   - 重新加载/启动：
     - `sudo nginx -s reload`（已运行情况下）
     - 或 `sudo nginx -c /usr/local/etc/nginx/nginx.conf`（指定主配置）
4. 访问验证：
   - 打开：http://127.0.0.1:8080
   - 输入问题发送，观察逐字打印
   - 若不生效，检查：
     - Nginx `root` 路径是否正确
     - 代理段 `location /api/` 是否转发到 `127.0.0.1:10086`
     - 是否已关闭 `proxy_buffering` 且 `X-Accel-Buffering: no` 生效
     - 后端是否运行且端口正确

补充：如无需 Nginx，仅本地快速预览构建产物，可：
- `npm run preview`（Vite 本地预览，默认 5174 端口），但此模式下 `/api` 仍需手动代理或改用开发模式

## 5) 常见问题与排查

- 开发模式仍报跨域？
  - 确认前端请求是 `/api/chat`（确保经过 Vite 代理），不要直接请求 `http://127.0.0.1:10086/chat`
- 生产模式不逐字打印、长时间无输出：
  - 确认已 `proxy_buffering off` 且 `gzip off`
  - 确认后端响应包含 `X-Accel-Buffering: no`
  - 浏览器网络面板查看响应是否分块到达
- 返回以 `"[ERROR]"` 开头的块：
  - 前端会在消息区展示错误，检查后端日志定位
- 后端端口占用：
  - 修改后端端口或停止占用进程，并同步更新 Vite/Nginx 代理目标

## 6) 脚本与命令速查

- 前端
  - 开发：`npm run dev`
  - 构建：`npm run build`
  - 预览：`npm run preview`
- 后端
  - 依赖：`pip install -r requirements.txt`
  - 启动：`python app.py`（端口 `10086`）
- Nginx（示例）
  - 重载：`sudo nginx -s reload`
  - 指定配置启动：`sudo nginx -c /usr/local/etc/nginx/nginx.conf`