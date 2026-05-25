# AGENTS.md

本文件定义 Codex 在 `AiToEarn` 仓库内的默认工作规则。

## Communication

- 默认使用简体中文回复。

## Project Layout

- 项目当前产品名是 `AitoBee`，历史名称是 `AiToEarn`；代码包名、仓库名、文档或第三方平台文案里仍可能出现 `AiToEarn`，不要在无关改动中批量替换。
- 本项目是社交媒体内容管理平台，核心能力包括多平台发布、AI 内容生成、互动自动化、创作者/广告主任务市场。
- `project/aitoearn-backend` 是 Nx + pnpm 后端工作区。
- `project/aitoearn-web` 是 Next.js + pnpm 前端项目。
- 根目录主要维护 README、Docker 部署文档、`docker-compose.yml` 和展示资源。
- `project/aitoearn-backend/apps/aitoearn-server` 是主 API 服务。
- `project/aitoearn-backend/apps/aitoearn-ai` 是 AI 服务。
- `project/aitoearn-backend/libs/channel-db` 维护频道域 Mongoose schema 与 repository。
- `project/aitoearn-backend/libs/mongodb` 维护用户、API Key 等核心 MongoDB schema。
- `project/aitoearn-backend/libs/helpers` 维护 metric event 和通用工具。
- `project/aitoearn-backend/libs/aitoearn-auth` 维护 JWT、guard 等认证模块。
- `project/aitoearn-backend/libs/aitoearn-queue` 维护 BullMQ/Redis 队列。

## Package & Command Rules

- backend/web 使用 `pnpm`。
- 根目录没有统一 package，不要在根目录随手执行 install/build。
- backend 改动优先在 `project/aitoearn-backend` 用 `pnpm nx ...` 验证，并遵循 `project/aitoearn-backend/CLAUDE.md`。
- Nx 任务优先通过 `nx` 执行，例如 `pnpm nx run aitoearn-server:build`、`pnpm nx run aitoearn-server:test`、`pnpm nx serve aitoearn-server`。
- 需要跑单个后端测试文件时，可在 `project/aitoearn-backend` 用 `pnpm exec vitest run <path>`。
- web 改动在 `project/aitoearn-web` 验证，优先使用 `pnpm run type-check` 和 `pnpm build`。
- web 常用命令包括 `pnpm dev`、`pnpm run type-check`、`pnpm build`、`pnpm run lint`、`pnpm test`。
- 如果本机 `pnpm`/Corepack 环境异常，可优先使用项目内本地二进制验证，例如 `./node_modules/.bin/tsc --noEmit`、`./node_modules/.bin/next build`、`./node_modules/.bin/nx ...`，但不要在根目录安装依赖。
- 纯文档改动至少运行 `git diff --check`。
- 如果可用 Nx MCP 工具，涉及 Nx workspace、project graph、target 或配置问题时优先用 MCP 查看；如果不可用，则直接读取 `project/aitoearn-backend` 内的 Nx 配置文件。

## Backend Architecture Rules

- 后端按 NestJS module 组织，业务域通常放在 `project/aitoearn-backend/apps/aitoearn-server/src/core/<domain>`，新增 domain 需要注册到 `app.module.ts` 或对应上级 module。
- 后端 DTO/请求校验优先使用 Zod 和 `createZodDto`，不要新增 `class-validator` 风格 DTO，除非现有同模块已经明确采用。
- 内部库包名使用 `@yikart/*`。
- `libs/channel-db/src/schemas` 中的 Mongoose schema 要显式设置 `collection`，继承 `BaseTemp`，并使用 `DEFAULT_SCHEMA_OPTIONS`。
- 新增 channel-db schema 后必须在 `libs/channel-db/src/schemas/index.ts` 中 import/export，并加入 `schemas` 数组，否则 Mongoose model 不会注册。
- channel-db repository 放在 `libs/channel-db/src/repositories`，遵循现有 `BaseRepository` 模式；新增 repository 后在 `repositories/index.ts` 导出并加入 repositories 列表。
- 每个 MongoDB collection 优先一个 schema 文件；如果少数现有文件合并多个 schema，新增方案仍优先按 collection 拆分，除非有强关联且能说明原因。
- BullMQ/Redis 异步任务优先接入现有 `libs/aitoearn-queue` 队列能力，不要手写独立后台轮询服务。

## Frontend Architecture Rules

- 前端使用 Next.js App Router，并通过 `[lng]` 动态段处理多语言路由。
- 前端状态优先使用 Zustand；页面专属 store 通常和页面组件放在同一目录。
- API 客户端放在 `project/aitoearn-web/src/api`，使用现有 `http.get<T>(path)`、`http.post<T>(path, data)` 等 `FetchService`/`request` 封装，不要绕过统一请求层。
- 前端 API base URL 来自 `NEXT_PUBLIC_API_URL`；本地通常指向 `http://127.0.0.1:7001/api`。
- 路径别名 `@/*` 指向 `project/aitoearn-web/src/*`。
- UI 组件优先沿用现有 Ant Design、Radix UI、Tailwind CSS、Lucide icons 组合。
- i18n 文案维护在 `project/aitoearn-web/src/app/i18n/locales/{lang}/`；新增用户可见路由或文案时同步关键语言文件，至少同步 `en` 与 `zh-CN`，对 README 级公开文档仍按三语规则处理。
- App Router 页面如果只因 query 参数做客户端分流，优先用 client component + `useSearchParams()`，避免无意让 server page 动态化；如果确实需要 server `searchParams`，要在方案/说明中明确取舍。

## Key Integration Points

- 频道账号和 OAuth 数据主要在 `libs/channel-db` 与 `apps/aitoearn-server/src/core/channel/platforms`。
- 多平台发布链路主要在 `apps/aitoearn-server/src/core/channel/publishing`，前端发布入口复用 `PublishDialog`。
- 小红书数据抓取/发布依赖浏览器插件或本地 bridge，前端相关代码在 `project/aitoearn-web/src/store/plugin/plats/xhs`；没有插件/bridge 时必须给配置引导，不要显示泛化网络错误。
- 互动、评论、AI 回复相关能力在 `apps/aitoearn-server/src/core/channel/engagement`、`apps/aitoearn-server/src/core/channel/interact` 和前端 plugin plat modules。
- 统计事件常量在 `project/aitoearn-backend/libs/helpers/src/metric-event`；新增任务市场、发布、互动埋点时优先复用已有常量。

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
