# AGENTS.md

本文件定义 Codex 在 `AiToEarn` 仓库内的默认工作规则。

## Communication

- 默认使用简体中文回复。

## Project Layout

- `project/aitoearn-backend` 是 Nx + pnpm 后端工作区。
- `project/aitoearn-web` 是 Next.js + pnpm 前端项目。
- 根目录主要维护 README、Docker 部署文档、`docker-compose.yml` 和展示资源。

## Package & Command Rules

- backend/web 使用 `pnpm`。
- 根目录没有统一 package，不要在根目录随手执行 install/build。
- backend 改动优先在 `project/aitoearn-backend` 用 `pnpm nx ...` 验证，并遵循 `project/aitoearn-backend/CLAUDE.md`。
- web 改动在 `project/aitoearn-web` 验证，优先使用 `pnpm run type-check` 和 `pnpm build`。
- 如果本机 `pnpm`/Corepack 环境异常，可优先使用项目内本地二进制验证，例如 `./node_modules/.bin/tsc --noEmit`、`./node_modules/.bin/next build`、`./node_modules/.bin/nx ...`，但不要在根目录安装依赖。
- 纯文档改动至少运行 `git diff --check`。

## Local Runtime Rules

- 用户要求“本地部署”时，默认指非 Docker 本机部署；不要重新引入 Docker/Compose，除非用户明确要求。
- 本地前端默认端口可用 `6061`，后端 server 默认 `3002`，AI 服务默认 `3010`，本地 API 代理可用 `7001`。
- 本地依赖服务通常包括 MongoDB、Redis、MinIO；排查运行状态时同时检查进程、监听端口、日志和关键 API，而不是只看页面是否打开。
- 本地文件上传/生成素材默认依赖 `ASSETS_CONFIG` 指向的对象存储；使用 MinIO 时确认 bucket 存在且 `cdnEndpoint`/`publicEndpoint` 能被后端访问。
- 不要把用户提供的第三方 Key 写入仓库文件；需要临时验证时用 shell 环境变量或本机私有配置文件，并避免在日志/回复中回显完整 Key。

## Documentation Rules

- 根 README 对外文档包含 `README.md`、`README_EN.md`、`README_JA.md`；涉及用户可见能力、安装、OpenClaw、MCP、Relay、API Key 或环境地址时默认三语同步。
- Docker 部署说明涉及生产部署、环境变量或 `docker compose` 时，同步检查 `DOCKER_DEPLOYMENT_CN.md` 和 `DOCKER_DEPLOYMENT_EN.md`。
- README 类改动保持最小可用改写，不要把参考文档整段复制进来。
- 用户可见 README、skill、capability reference 只写当前能力与环境规则，不写 `dev`、测试环境、验证日期等来源说明。

## Environment Rules

- OpenClaw、MCP、Relay 都必须明确区分中国版和国际版环境：`*.aitoearn.cn` 属于中国版，`*.aitoearn.ai` 属于国际版。
- 中国版 API Key 只能搭配 `aitoearn.cn` 相关 URL；国际版 API Key 只能搭配 `aitoearn.ai` 相关 URL。环境和 Key 不匹配会导致 401。
- MCP 示例需要按环境区分 `https://aitoearn.cn/api/unified/mcp` / `https://aitoearn.ai/api/unified/mcp`，SSE 示例同理区分 `/api/unified/sse`。
- Relay 示例需要按 `RELAY_API_KEY` 来源选择 `RELAY_SERVER_URL`：中国版使用 `https://aitoearn.cn/api`，国际版使用 `https://aitoearn.ai/api`。

## AI Draft Generation Rules

- `Generate Draft(Video)` 走 `aitoearn-ai` 的 `ai/draft-generation/v2`，不是单纯前端配置；排查失败时要同时检查前端请求、server 代理、AI 服务、Redis 队列、MongoDB `AiLog` 和素材写入。
- 完整视频草稿模式会先调用规划模型生成视频 prompt、标题、描述和 topics；当前默认规划模型来自 `config.ai.draftGeneration.planner.defaultModel`，默认是 `gpt-5.5`，通常需要 `OPENAI_API_KEY` 和 `OPENAI_BASE_URL`。
- Grok Video 使用模型 `grok-imagine-video`，需要 `GROK_API_KEY`。
- Seedance 使用火山方舟模型 `doubao-seedance-2-0-260128` 或 `doubao-seedance-2-0-fast-260128`，核心需要 `VOLCENGINE_API_KEY`。
- `VOLCENGINE_VOD_SPACE_NAME` 和 `VOLCENGINE_URL_AUTH_PRIMARY_KEY` 主要影响火山 VOD 上传、播放鉴权、Aideo/视频编辑等 VOD 链路；单纯 Seedance 方舟生成任务通常不依赖它们，但后续若走火山 VOD 播放或编辑会失败。
- 仅生成草稿不需要平台 OAuth 配置；真正发布到 YouTube、TikTok、X、Facebook、Instagram、LinkedIn、Bilibili、抖音、快手、微信公众号等平台时，才需要对应平台的 `CLIENT_ID`/`CLIENT_SECRET` 和账号授权。
