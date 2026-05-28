# Go 主业务后端迁移方案

## 结论

Go 承接主业务 API 和 Worker；AI/Agent/MCP 作为独立服务保留，不强求 Go 实现。

迁移完成的定义：

- Go 服务处理所有业务 API 请求（用户、账号、发布、推广、结算等）。
- Go Worker 处理所有异步任务（发布队列、轮询、回调、通知等）。
- AI/Agent/MCP 作为独立服务运行，对 Go 主服务暴露内部 API。
- Node 后端完全下线。

非 Go 例外范围：

| 模块 | 保留语言 | 原因 | 退出条件 |
| --- | --- | --- | --- |
| AI Agent runtime | Python（或保留 Node） | LLM SDK 生态（Anthropic/OpenAI/Vercel AI SDK/LangChain）Python 和 Node 是一等公民，Go 无对等实现 | Go LLM 生态成熟到官方 SDK 功能对等时可重新评估 |
| MCP 协议层 | Go 或 Node sidecar | Go MCP SDK 已存在（官方 Tier 1），但当前项目深度绑定 `@modelcontextprotocol/sdk` + 自研 `@yikart/nest-mcp`，迁移成本在业务集成和协议兼容 | 阶段 6 评估，如果 Go SDK 能覆盖现有 tool/resource 注册模式则迁移 |
| LLM streaming/tool calling | 跟随 AI 服务 | Vercel AI SDK、Claude Agent SDK 无 Go 版本 | 同 AI Agent runtime |

保留不变的基础设施：

- MongoDB（Go 官方 driver）
- Redis（go-redis）
- S3 兼容对象存储 / RustFS（minio-go）
- Docker Compose + Nginx
- Next.js 前端

## 当前后端现状

当前后端位于 `project/aitoearn-backend`，是 Nx + pnpm + TypeScript 工作区，包含两个主要应用：

- `apps/aitoearn-server`：主业务 API、用户、账号、发布、平台 OAuth、Relay、MCP。
- `apps/aitoearn-ai`：AI 对话、图片/视频生成、Agent runtime、模型配置、任务处理。

共享库包括：

- `libs/mongodb`、`libs/channel-db`：MongoDB/Mongoose schema 和 repository。
- `libs/redis`、`libs/redlock`：Redis 和分布式锁。
- `libs/aitoearn-queue`：BullMQ 队列封装。
- `libs/assets`、`libs/aws-s3`、`libs/ali-oss`：资源和对象存储。
- `libs/aitoearn-auth`、`libs/nest-mcp`、`libs/mail`、`libs/ali-sms` 等。

现有 BullMQ 队列清单：

| 队列名 | 职责 | 复杂度 |
| --- | --- | --- |
| `post_publish` | 发布任务 | 高（多平台、状态机、回调） |
| `post_media_task` | Meta 平台媒体发布 | 高 |
| `ai_image_async` | AI 图片生成 | 中（依赖 AI 服务） |
| `engagement_task_distribution` | 互动任务分发 | 中 |
| `engagement_reply_to_comment_task` | 评论回复 | 中 |
| `dump_social_media_avatar` | 头像下载 | 低 |
| `update_published_post` | 更新已发布内容 | 中 |
| `bull_notification` | 通知 | 低 |
| `ai_task_refund` | AI 任务退款 | 中（涉及结算） |
| `place_draft_generation` | 草稿生成 | 高（AI + 多步骤） |
| `place_draft_generation_low_priority` | 低优先级草稿生成 | 高 |
| `user_event_batch` | 用户事件批量写入 | 低 |

Docker Compose 目前提供：MongoDB replica set、Redis、RustFS、aitoearn-server、aitoearn-ai、aitoearn-web、Nginx。

## 技术栈选型

### HTTP

Go 1.22+ 标准库 `net/http`。

`http.ServeMux` 已原生支持方法匹配和路径参数（`GET /users/{id}`），不需要第三方路由库。只在服务规模扩大、路由分组变得笨重时才考虑引入 `chi`。不推荐 Gin。

### 配置

`os.Getenv` + typed config struct。不引入 Viper、cleanenv 或类似框架。

Go 服务必须兼容现有 Docker Compose 环境变量命名，不另起变量模型：

```go
type Config struct {
    Port             string
    MongoDBHost      string
    MongoDBPort      string
    MongoDBUsername  string
    MongoDBPassword  string
    RedisHost        string
    RedisPort        string
    RedisPassword    string
    AssetsConfig     string // JSON，解析为 AssetsOptions struct
    JWTSecret        string
}

func LoadConfig() (Config, error) {
    cfg := Config{
        Port:            getenv("PORT", "8080"),
        MongoDBHost:     getenv("MONGODB_HOST", "127.0.0.1"),
        MongoDBPort:     getenv("MONGODB_PORT", "27017"),
        MongoDBUsername: os.Getenv("MONGODB_USERNAME"),
        MongoDBPassword: os.Getenv("MONGODB_PASSWORD"),
        RedisHost:       getenv("REDIS_HOST", "127.0.0.1"),
        RedisPort:       getenv("REDIS_PORT", "6379"),
        RedisPassword:   os.Getenv("REDIS_PASSWORD"),
        AssetsConfig:    os.Getenv("ASSETS_CONFIG"),
        JWTSecret:       os.Getenv("JWT_SECRET"),
    }
    if cfg.MongoDBHost == "" {
        return Config{}, errors.New("MONGODB_HOST is required")
    }
    return cfg, nil
}

func (c Config) MongoURI() string {
    if c.MongoDBUsername != "" {
        return fmt.Sprintf("mongodb://%s:%s@%s:%s", c.MongoDBUsername, c.MongoDBPassword, c.MongoDBHost, c.MongoDBPort)
    }
    return fmt.Sprintf("mongodb://%s:%s", c.MongoDBHost, c.MongoDBPort)
}
```

`ASSETS_CONFIG` 是 JSON 字符串，包含 S3 provider/endpoint/bucket/accessKey/secretKey，解析为独立 struct。

### 数据库

继续使用 MongoDB，Go 侧用官方 MongoDB Go Driver。不引入 ORM。

双跑期间 Node 和 Go 共同读写同一批文档，数据结构兼容比抽象层更重要。

### Redis

继续使用 Redis，Go 侧用 `go-redis`。

### 队列和工作流

按现有队列复杂度一次性选定方案，不设计"先 Asynq 后 Temporal"的升级路径：

| 队列 | 当前复杂度 | Go 方案 |
| --- | --- | --- |
| `dump_social_media_avatar` | 低 | Asynq |
| `bull_notification` | 低 | Asynq |
| `user_event_batch` | 低 | Asynq |
| `update_published_post` | 中 | Asynq |
| `engagement_task_distribution` | 中 | 评估：如果只是分发则 Asynq，如果有多步骤则 Temporal |
| `engagement_reply_to_comment_task` | 中 | Asynq（单步骤） |
| `ai_task_refund` | 中 | Temporal（涉及结算补偿） |
| `post_publish` | 高 | Temporal（多平台状态机 + 回调 + 重试） |
| `post_media_task` | 高 | Temporal |
| `ai_image_async` | 中 | 保留在 AI 服务内，不迁 Go |
| `place_draft_generation` | 高 | 保留在 AI 服务内，不迁 Go |
| `place_draft_generation_low_priority` | 高 | 保留在 AI 服务内，不迁 Go |

#### 队列共存方案（双跑期）

迁移期间 BullMQ、Asynq、Temporal 会共存。共存规则：

1. **按队列整体迁移**：一个队列的 producer 和 consumer 必须同时迁移，不允许 Go produce + Node consume 或反过来。
2. **迁移顺序**：先迁低复杂度队列验证 Asynq 基础设施，再迁高复杂度队列到 Temporal。
3. **切换方式**：通过环境变量控制某个队列是否启用 Go consumer。切换前先停 Node consumer，再启 Go consumer，避免重复消费。
4. **回滚**：每个队列可独立回滚到 BullMQ（停 Go consumer，启 Node consumer）。
5. **AI 相关队列不迁**：`ai_image_async`、`place_draft_generation` 系列保留在 AI 服务内，由 AI 服务自行处理。

### 对象存储

保留 S3 兼容协议，Go 侧用 `minio-go` 接 RustFS。配置从 `ASSETS_CONFIG` JSON 解析。

### 鉴权

`golang-jwt/jwt/v5`。保持现有 Bearer token 行为和错误结构兼容。

### 日志和可观测

- 日志：`slog`（标准库）
- 指标：Prometheus Go client
- 链路追踪：OpenTelemetry

## 模块迁移难度评估

### 可直接迁移（Go 生态成熟）

| 模块 | 说明 |
| --- | --- |
| 用户/账号 CRUD | 标准 REST |
| 推广市场（promotion-marketplace） | 标准业务逻辑 |
| 资产管理 | 文件操作 + DB |
| 短链接 | 简单重定向 |
| 通知 | 邮件/短信发送 |
| 内部 API | 服务间调用 |
| Webhook 接收 | 验签 + 写入 |
| 文件处理 | 转码/缩略图 |
| 定时轮询 | 周期任务 |

### 需要大量体力活（技术可行但工作量大）

| 模块 | 工作量来源 |
| --- | --- |
| 平台 OAuth（14 个平台） | 每个平台 OAuth 流程、签名方式、错误码不同，纯重写 |
| 发布链路 | 14 个平台的发布接口参数、媒体要求、状态回调各不相同 |
| 互动/评论 | 平台 API 差异大 |

预估这块占总迁移量 40-50%。没有 Go 库能帮忙，就是逐平台重写。

### 不用 Go 实现（非 Go 例外）

| 模块 | 建议 | 原因 |
| --- | --- | --- |
| AI Agent runtime | 独立 Python 服务（FastAPI） | LLM SDK 生态：Anthropic/OpenAI/LangChain 官方 SDK 都是 Python 一等公民 |
| MCP 协议层 | 优先尝试 Go SDK（官方已有 Tier 1 支持），回退 Node sidecar | 当前深度绑定 `@yikart/nest-mcp`，迁移成本在业务集成而非 SDK 缺失 |
| LLM streaming/tool calling | 跟随 AI 服务 | Vercel AI SDK、Claude Agent SDK 无 Go 版本 |
| AI 图片/视频生成队列 | 保留在 AI 服务内 | 依赖 AI 模型调用，不属于主业务 |
| 草稿生成队列 | 保留在 AI 服务内 | 多步骤 AI 编排，和 LLM 强耦合 |

最终架构：

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Next.js    │────▶│  Go API + Worker │────▶│  MongoDB/Redis  │
│  Frontend   │     │  (主业务)         │     │  /RustFS        │
└─────────────┘     └────────┬─────────┘     └─────────────────┘
                             │ 内部 HTTP/gRPC
                    ┌────────▼─────────┐
                    │  AI Service      │
                    │  (Python/Node)   │
                    │  LLM/Agent/MCP   │
                    └──────────────────┘
```

## AI 服务专项迁移边界

`aitoearn-ai` 不只是 LLM SDK 调用，还包含完整的业务逻辑。迁移为独立服务需要明确边界：

### AI 服务职责（迁移后）

- LLM 对话（streaming + tool calling）
- AI 图片/视频生成（调用外部模型 API）
- 草稿生成编排（多步骤：脚本 → 素材匹配 → 粗剪 → 精剪）
- Agent runtime（Claude Agent SDK）
- MCP tool/resource 注册和执行
- AI 任务退款判定逻辑

### Go 主服务职责（与 AI 服务交互部分）

- 创建 AI 任务请求（写入 DB + 调用 AI 服务）
- AI 任务状态查询和展示
- AI 任务计费/扣费/退款执行（结算在 Go 侧）
- 草稿结果接收和存储
- 用户配额管理

### 内部 API 契约

AI 服务对 Go 主服务暴露：

```
POST   /internal/ai/chat/stream      # 流式对话
POST   /internal/ai/image/generate    # 图片生成
POST   /internal/ai/draft/generate    # 草稿生成
GET    /internal/ai/task/:id/status   # 任务状态
POST   /internal/ai/task/:id/cancel   # 取消任务
```

Go 主服务对 AI 服务暴露（回调）：

```
POST   /internal/callback/ai/task/:id/complete   # 任务完成回调
POST   /internal/callback/ai/task/:id/failed     # 任务失败回调
```

### 流式响应处理

AI 服务 → Go 主服务 → 前端的 streaming 链路：

- AI 服务输出 SSE stream
- Go 主服务透传 SSE 到前端（不解析内容，只做鉴权和限流）
- 或 Go 主服务直接把前端 WebSocket/SSE 请求代理到 AI 服务

### 迁移步骤

1. 定义内部 API 契约（OpenAPI spec）
2. AI 服务实现内部 API（保留现有 Node 代码，加 HTTP 入口）
3. Go 主服务调用 AI 内部 API 替代直接队列投递
4. 验证流式响应、任务状态、退款流程
5. 后续可选：Node AI 服务迁移为 Python（独立决策，不阻塞 Go 主服务迁移）

## API 兼容保障

迁移任何对前端暴露的接口前，必须建立 API 合约。

### 步骤

1. 从现有 NestJS 导出完整 OpenAPI spec（`config.openapi.enable` 已支持）。
2. 标记前端正在使用的 API。
3. 使用 `oapi-codegen` 为 Go 生成类型和 handler 边界。
4. Go 服务实现同一份接口契约。
5. CI 中用 contract test（Schemathesis）验证 Go 服务响应。
6. 核心接口做 Node/Go 双端响应对比：状态码、envelope 结构、错误码、分页字段。

### 前端零改动原则

Go API 必须保持：

- 相同的 URL 路径和方法。
- 相同的请求/响应 JSON 结构（`{ code, data, message }`）。
- 相同的 Bearer token 鉴权行为。
- 相同的错误码和 HTTP 状态码。

## 双跑期数据兼容规则

Go 和 Node 同时读写 MongoDB 时的约定：

### 允许

- 新增可选字段（带默认值）。
- 新集合用于 Go 独立服务。
- append-only 事件写入。

### 禁止

- 改已有字段含义或类型。
- 删除 Node 仍在读取的字段。
- Go 写入 Node 无法解析的枚举值。
- Go 直接更新核心状态字段但不走现有状态机约束。

### 策略

新 Go 服务优先写入独立集合（`platform_webhook_events`、`media_processing_jobs`），由统一 worker 消费后更新主集合。降低 Go 直接破坏主业务 schema 的风险。

## 迁移阶段

### 阶段 0：准备

- 盘点 BullMQ 队列（已完成，见上方队列清单）。
- 导出 OpenAPI spec。
- 标记前端实际调用的 API，区分只读/写入/有队列副作用。
- 列出 MongoDB 关键集合字段读写方。
- 确定每个队列的 Go 方案（Asynq/Temporal/保留 AI 服务）。

### 阶段 1：Go 服务骨架 + 第一个独立模块

建立最小生产骨架并实现第一个独立服务（推荐 webhook 接收或文件处理）：

- `net/http` 路由 + health check
- typed config（兼容现有环境变量）
- slog + Prometheus
- MongoDB client + Redis client
- Dockerfile + docker-compose 接入

退出条件：Go 服务独立运行，不依赖调用 Node 服务，写入数据不破坏 Node 读取。

### 阶段 2：队列兼容层 + 只读 API

**先建立队列共存机制，再迁移 API。**

注意：当前很多看似 CRUD 的模块实际有队列副作用（如发布创建会写 BullMQ、账号操作会触发头像下载队列）。因此本阶段只迁移：

- 真正只读的查询接口（无写入、无队列投递）
- 低复杂度队列的 Asynq 实现（`dump_social_media_avatar`、`bull_notification`、`user_event_batch`）

工作项：

1. 实现 Asynq 基础设施（producer + consumer + 监控）
2. 迁移 3 个低复杂度队列到 Asynq
3. 迁移只读查询接口到 Go
4. 每个接口：导出 OpenAPI → Go 实现 → contract test → Nginx 灰度

退出条件：Asynq 队列稳定运行，只读接口 contract test 通过。

### 阶段 3：写入 API + 任务编排

在队列共存机制验证后，迁移有写入但无复杂状态机的业务模块：

1. 推广市场（promotion-marketplace）
2. 短链接
3. 通知
4. 资产管理
5. 用户/账号 CRUD

同时建立 Temporal 基础设施：

- Temporal Server 部署（docker-compose 接入）
- 第一个 Temporal workflow：`ai_task_refund`（相对独立，涉及结算补偿）
- Workflow + Activity 模式验证

退出条件：写入接口 contract test 通过，Temporal 处理退款流程稳定。

### 阶段 4：平台 OAuth + 发布链路

最大工作量阶段。按平台逐个迁移：

建议顺序（按用户量和复杂度排序）：

1. 小红书（XHS）
2. 抖音（Douyin）
3. 快手（Kuaishou）
4. TikTok
5. YouTube
6. Twitter/X
7. 其余平台

每个平台包含：OAuth 授权流程、发布接口、回调处理、状态同步、错误重试。

发布队列（`post_publish`、`post_media_task`）迁移到 Temporal workflow。

### 阶段 5：AI 服务独立化

将 `aitoearn-ai` 从 NestJS 模块重构为独立服务：

**注意**：这不是简单的"换成 FastAPI + SDK"。当前 `aitoearn-ai` 包含：

- AI 对话（streaming + tool calling + 多模型切换）
- 图片/视频生成（异步队列 + 回调）
- 草稿生成（多步骤编排：脚本 → 素材匹配 → 粗剪 → 精剪 → 评估）
- Agent runtime（Claude Agent SDK + MCP 工具注册）
- AI 任务退款判定
- 模型配置管理

迁移步骤：

1. 定义 Go ↔ AI 服务内部 API 契约
2. 在现有 Node AI 服务上加内部 HTTP 入口（不改内部逻辑）
3. Go 主服务通过内部 API 调用 AI 服务（替代直接 import）
4. 验证流式响应、任务生命周期、退款
5. （可选后续）Node AI 服务迁移为 Python — 这是独立决策，需要单独的设计文档

本阶段可与阶段 4 并行。

### 阶段 6：MCP + 收尾

- 评估 Go MCP SDK 覆盖度（官方 Go SDK 已存在，需验证是否支持现有 tool/resource 注册模式）
- 如果覆盖：迁移 MCP 到 Go
- 如果不覆盖：保留为独立 sidecar
- 下线所有 Node 服务
- 清理双跑期兼容代码

## 回滚策略

每个模块独立可回滚：

- Nginx 路由开关（按路径切流到 Node 或 Go）
- 环境变量 feature flag
- 独立 Go 容器可停用
- 队列级别回滚（停 Go consumer，启 Node consumer）
- Node 旧逻辑保留到 Go 灰度稳定后再删

## 风险清单

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| API 响应结构不兼容 | 前端报错 | OpenAPI + contract test + 双端对比 |
| Node/Go 同时写 Mongo 导致 schema 漂移 | 数据异常 | 字段级兼容规则、独立事件集合 |
| 平台 OAuth 重写遗漏边界 case | 授权失败 | 逐平台迁移 + 充分测试 + 灰度 |
| 有队列副作用的 API 被当作纯 CRUD 迁移 | 队列消息丢失或重复 | 阶段 2 只迁只读接口，写入接口必须先确认队列归属 |
| AI 服务独立化低估 | 流式响应断裂、任务状态不一致 | 先加内部 API 入口验证，不急于换语言 |
| 迁移周期过长导致双栈维护成本 | 开发效率下降 | 严格按阶段推进，每阶段有明确退出条件 |
| Temporal 引入复杂度 | 学习和运维成本 | 只对确实需要编排的任务使用 |

## 时间预估

前提条件：

- 1-2 人全职投入 Go 迁移
- 迁移期间新功能开发节奏放缓（不完全暂停）
- AI/MCP 保留为独立服务，不在本轮迁移为 Python
- 14 个平台全部迁移（如果只迁核心 3-5 个平台，阶段 4 可压缩）

| 阶段 | 乐观（1-2 人） | 保守（1 人） | 前提 |
| --- | --- | --- | --- |
| 阶段 0 准备 | 1 周 | 2 周 | — |
| 阶段 1 骨架 + 独立模块 | 2 周 | 3 周 | — |
| 阶段 2 队列兼容 + 只读 API | 3 周 | 5 周 | 阶段 1 稳定 |
| 阶段 3 写入 API + Temporal | 4 周 | 7 周 | 阶段 2 稳定 |
| 阶段 4 平台 OAuth + 发布 | 8 周 | 14 周 | 阶段 3 稳定 |
| 阶段 5 AI 服务独立化 | 3 周 | 5 周 | 可与阶段 4 并行 |
| 阶段 6 MCP + 收尾 | 2 周 | 3 周 | 全部稳定 |
| **总计** | **5-6 个月** | **9-10 个月** | — |

阶段 4（平台 OAuth + 发布）是关键路径。如果只迁移核心 3 个平台（小红书、抖音、快手），可压缩 4-5 周，其余平台后续补充。

## 推荐下一步

1. 导出 OpenAPI spec，标记前端实际调用的 API 并区分只读/写入/有队列副作用。
2. 初始化 Go 项目骨架（`project/aitoearn-go/`），兼容现有 docker-compose 环境变量。
3. 实现 webhook 接收服务作为第一个 Go 模块。
4. 建立 contract test CI。
5. 部署 Asynq 监控面板，迁移第一个低复杂度队列验证。
