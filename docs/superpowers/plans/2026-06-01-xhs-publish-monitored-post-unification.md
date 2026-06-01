# XHS 发布后立即写入 monitored_post 改造方案

## 背景

当前作品数据页同时展示两类记录：

- 正式监控记录：来自 `aitoearn_channel.monitored_post`，来源包含 `manual` 和 `published_backfill`。
- 审核中占位记录：来自 `aitoearn.publishRecord`，由 `pending-published-posts` 接口把 `publishRecord` 映射成虚拟 work-data 行。

这导致同一个表格里实际混合了两套数据模型：

- 上方审核中记录使用 `publishRecord` 的临时 trace id，例如 `req-1780294930951-5dg5oosr`。
- 下方正式监控记录使用小红书真实笔记 id，例如 `6a1a7fc4000000000800024e`。
- 删除、抓取、暂停、详情、token 刷新等操作需要依赖 `rowType` 分支判断。
- 分页、统计、筛选、去重都需要前端拼接两个接口结果，长期会越来越脆。

目标是采用方案 C：发布后立即写入 `monitored_post`，彻底取消 pending 虚拟行，让作品数据页只有一个数据源。

## 目标

1. 发布后只要拿到小红书真实 `noteId`，立即创建或更新 `monitored_post`。
2. 作品数据页只读取 `monitored_post`，不再读取 `publishRecord` 虚拟行。
3. 前端表格统一展示 `noteId`，不再展示 `req-*`。
4. `publishRecord` 只作为发布流水和回调关联，不再作为作品数据页展示数据源。
5. 审核中、缺 token、抓取失败等状态统一通过 `monitored_post.monitorStatus` 和 `monitored_post.fetchStatus` 表达。

## 命名约定

项目里小红书笔记 ID 建议统一命名为 `noteId`。

用户口头提到的 `nodeId` 在本文按 `noteId` 理解。如果后续确实要求数据库/API 字段名叫 `nodeId`，需要单独做全链路重命名；当前不建议这样做，因为小红书语义和现有代码都使用 `noteId`。

字段语义：

```ts
noteId: string
// 小红书真实笔记 ID。用于 UI 展示、监控身份、抓取入口。

traceId: string
// MultiPost/AitoBee 发布请求临时 ID，例如 req-*。只用于发布回调关联和排查，不展示为作品 ID。

publishRecordId: string
// publishRecord Mongo ID。只用于关联发布流水。

monitoredPostId: string
// monitored_post Mongo ID。用于作品数据页操作 API。
```

硬约束：

- 作品数据页副标题只展示真实 `noteId`。
- `req-*` 不允许作为作品 ID 展示。
- 如果暂时没有真实 `noteId`，不要创建 `monitored_post`；保留在 `publishRecord` 中等待后续 noteId 回填。

## 目标状态模型

`monitored_post` 成为作品数据页唯一读模型。

建议扩展 `monitored_post` 字段：

```ts
publishRecordId?: string
publishTraceId?: string
linkStatus?: 'pending' | 'ready' | 'failed'
linkError?: string
```

现有核心字段保留：

```ts
postId: string
postUrl: string
source: 'manual' | 'published_backfill' | 'demo_seed'
monitorStatus: 'active' | 'published' | 'paused' | 'failed' | 'archived'
fetchStatus:
  | 'idle'
  | 'fetching'
  | 'ready'
  | 'failed'
  | 'permission_required'
  | 'not_configured'
  | 'pending_confirmation'
  | 'reviewing'
xsecToken: string
xsecSource: string
xsecTokenUpdatedAt?: Date
```

小红书发布后审核中的记录：

```ts
platform = 'xhs'
source = 'published_backfill'
monitorStatus = 'published'
fetchStatus = 'reviewing' // 已发布但仍审核中，无法抓取
postId = noteId
postUrl = `https://www.xiaohongshu.com/explore/${noteId}`
xsecToken = ''
latestMetrics = {}
latestCommentCount = 0
publishRecordId = publishRecord._id
publishTraceId = traceId
linkStatus = 'pending'
```

缺少 `xsec_token` 但已有 `noteId` 的记录：

```ts
monitorStatus = 'published'
fetchStatus = 'pending_confirmation'
linkStatus = 'pending'
```

拿到 token 后：

```ts
monitorStatus = 'active'
fetchStatus = 'idle' // 或 ready，取决于是否立即抓取成功
postUrl = 带 xsec_token 的完整链接
xsecToken = token
xsecSource = xsecSource
xsecTokenUpdatedAt = now
linkStatus = 'ready'
```

## noteId 提取规则

发布回调和 token 刷新相关代码必须按以下优先级解析 `noteId`：

1. 插件回传 `noteId`。
2. 插件回传 `workLink` 中的 `/explore/:noteId` 或 `/discovery/item/:noteId`。
3. `publishRecord.linkMeta.unverifiedWorkLink` 中的 note id。
4. `publishRecord.dataId`，但必须满足不是 `req-*`。

如果解析不到真实 `noteId`：

- 更新 `publishRecord` 为 pending。
- 保存 `traceId`、`pendingConfirmation`、错误原因或待确认原因。
- 不创建 `monitored_post`。
- 作品数据页不会显示这条记录。

## 后端流程

### 1. MultiPost 发布提交成功

MultiPost 提交成功后可能先返回：

```ts
{
  success: true,
  pendingConfirmation: true,
  traceId: 'req-...',
  noteId?: string,
  workLink?: string
}
```

后端 `plat/publish/pluginResult` 做三件事：

1. 通过 `id` 或 `traceId` 找到 `publishRecord`。
2. 更新 `publishRecord` 的发布状态和 link 状态。
3. 如果能解析到真实 `noteId`，立即 upsert `monitored_post`。

### 2. 写入 monitored_post

新增内部方法：

```ts
upsertPublishedBackfillMonitor(params: {
  userId: string
  publishRecordId: string
  publishTraceId?: string
  accountId: string
  platform: 'xhs'
  noteId: string
  postUrl: string
  title?: string
  cover?: string
  xsecToken?: string
  xsecSource?: string
  linkStatus: 'pending' | 'ready' | 'failed'
  fetchStatus: 'reviewing' | 'pending_confirmation' | 'idle' | 'ready' | 'failed'
})
```

写入规则：

- 按 `{ userId, platform, accountId, postId: noteId }` upsert。
- 如果已存在同 noteId 记录，优先保留已有指标、评论数、快照字段。
- 更新 `publishRecordId`、`publishTraceId`、`postUrl`、`linkStatus`、`fetchStatus`。
- 不允许用 `req-*` 作为 `postId`。

### 3. token 刷新成功

插件拿到带 `xsec_token` 的链接后调用 `updateTokenFromPlugin`。

后端同时更新：

- `publishRecord`
  - `dataId = noteId`
  - `workLink = tokenizedUrl`
  - `linkStatus = ready`
  - `linkMeta.pendingConfirmation = false`
- `monitored_post`
  - `postUrl = tokenizedUrl`
  - `xsecToken = token`
  - `xsecSource = xsecSource`
  - `xsecTokenUpdatedAt = now`
  - `linkStatus = ready`
  - `monitorStatus = active`
  - `fetchStatus = idle`

随后可以 enqueue 抓取任务，或者保持 `idle` 等待用户/调度触发。为了用户体验，建议 token 成功后立即 enqueue 一次抓取。

## 前端流程

### 1. 删除双接口拼接

删除 WorkDataPage 中：

```ts
listPendingPublishedPosts()
pendingList + monitoredRes.list
pendingReviewTotal
```

保留：

```ts
listMonitoredPosts()
```

作品数据页只展示 `monitored_post`。

### 2. 表格字段展示

作品列副标题展示规则：

```ts
displayId = record.noteId || record.postId
```

前提：

- 后端保证 `postId` 一定是真实 `noteId`。
- 前端不展示 `traceId`。
- 如果后端返回缺失 noteId，前端显示 `等待笔记ID`，但正常情况下不应该出现。

### 3. 操作按钮

删除 `rowType === 'pending_published'` 分支。

按状态控制：

```ts
fetchStatus === 'reviewing' || fetchStatus === 'pending_confirmation'
```

显示：

- token 刷新按钮。
- 删除按钮。
- 详情按钮，如果有 `postUrl` 则打开链接。

禁用：

- 抓取按钮。
- 暂停/恢复按钮，或保留但置灰。

正式可抓取状态：

```ts
fetchStatus === 'idle' || fetchStatus === 'ready' || fetchStatus === 'failed'
```

显示正常抓取、详情、暂停/恢复、删除。

### 4. 删除逻辑

删除统一走：

```ts
DELETE /acquisition/work-data/monitored-posts/:id
```

默认不删除 `publishRecord`，因为发布流水应保留。可以在 `monitored_post` 中标记 `archived` 或直接删除监控记录，二者二选一：

- 推荐短期：物理删除 `monitored_post`，和现有删除行为一致。
- 推荐长期：软删除为 `monitorStatus = archived`，方便审计和恢复。

## API 调整

保留：

```http
GET /acquisition/work-data/monitored-posts
POST /acquisition/work-data/monitored-posts/:id/fetch
PATCH /acquisition/work-data/monitored-posts/:id/status
DELETE /acquisition/work-data/monitored-posts/:id
```

废弃：

```http
GET /acquisition/work-data/pending-published-posts
```

可以先保留兼容一版，但前端不再调用。

新增或调整：

```http
POST /plat/publish/refreshXhsToken/:publishRecordId
```

短期保留 publishRecordId 入参，内部通过 `publishRecordId` 找到关联 `monitored_post`。

后续可新增：

```http
POST /acquisition/work-data/monitored-posts/:id/refresh-xhs-token
```

让作品数据页操作完全基于 `monitored_post`。

## 队列调整

当前 token 刷新任务基于 `publishRecordId`。

建议任务 payload 扩展为：

```ts
{
  publishRecordId: string
  monitoredPostId?: string
  userId: string
  noteId: string
}
```

处理成功后同时更新 `publishRecord` 和 `monitored_post`。

如果任务里没有 `monitoredPostId`，后端可以通过：

```ts
{ userId, platform: 'xhs', accountId, postId: noteId }
```

反查 `monitored_post`。

## 迁移策略

### 可迁移记录

迁移这些 `publishRecord`：

```ts
accountType = 'xhs'
linkStatus = 'pending'
linkMeta.provider = 'multipost'
linkMeta.pendingConfirmation = true
```

且能解析真实 `noteId`：

- `dataId` 不是 `req-*`
- 或 `linkMeta.unverifiedWorkLink` 能解析出 noteId
- 或 `workLink` 能解析出 noteId

对这些记录写入 `monitored_post`。

### 不迁移记录

只有 `req-*` 且没有真实 `noteId` 的旧记录不迁移。

原因：

- `monitored_post` 的唯一身份应是真实 noteId。
- 用 `req-*` 写入后，后续更新真实 noteId 会遇到身份迁移和唯一索引冲突风险。
- 旧 pending 记录可保留在 `publishRecord` 里用于排查，不进入作品数据页。

## 测试计划

### 后端单测

1. `pluginResult` 收到 `pendingConfirmation + bare workLink` 时：
   - 更新 `publishRecord.dataId = noteId`
   - 创建 `monitored_post`
   - `monitorStatus = published`
   - `fetchStatus = reviewing`
2. `pluginResult` 只有 `traceId=req-*` 且无 noteId 时：
   - 只更新 `publishRecord`
   - 不创建 `monitored_post`
3. `updateTokenFromPlugin` 成功时：
   - 更新 `publishRecord`
   - 更新 `monitored_post` token 字段
   - enqueue 一次抓取任务
4. 同一 noteId 重复回调：
   - upsert，不创建重复 monitored_post
5. 删除 monitored_post：
   - 不删除 publishRecord。

### 前端类型和组件测试

1. WorkDataPage 只调用 `listMonitoredPosts`。
2. 表格不再依赖 `rowType=pending_published`。
3. 审核中记录显示真实 noteId，不显示 `req-*`。
4. `reviewing/pending_confirmation` 禁用抓取，显示 token 刷新。
5. 正式记录保持抓取、暂停、详情、删除行为。

### 集成验证

1. 发布小红书图文。
2. 发布完成后进入作品数据页。
3. 如果笔记审核中：
   - 列表出现一条 `monitored_post` 行。
   - 显示真实 noteId。
   - 状态为 `已发布 / 审核中`。
   - 指标为空或 `-`。
4. 审核通过并刷新 token 后：
   - 同一行更新为可抓取状态。
   - 不新增重复行。
   - 抓取后指标和评论数更新。

## 风险与约束

### 1. noteId 获取可靠性

方案 C 依赖插件能稳定拿到真实 noteId。必须确保 `xhs-note-manager` 能从以下位置解析：

- `.note-card[data-impression]`
- note manager 卡片属性
- 可用的 `a[href]` 链接

如果发布后页面仍拿不到 noteId，则该记录只能留在 `publishRecord`，不会展示在作品数据页。

### 2. 唯一索引冲突

`monitored_post` 当前唯一索引：

```ts
{ userId, platform, accountId, postId }
```

所以禁止用 `req-*` 写入 `postId`。否则后续真实 noteId 更新会变成身份迁移，复杂且容易产生重复。

### 3. 审核中链接不可抓取

审核中裸链接可能打开 404 或要求扫码。此时 `fetchStatus` 应保持：

```ts
reviewing
```

不要反复触发抓取失败，也不要把它标记成正式 failed。

### 4. publishRecord 与 monitored_post 状态同步

token 刷新成功后必须同步两边，否则会出现：

- 作品数据页可抓取，但发布记录仍 pending。
- 发布记录 ready，但 monitored_post 仍 reviewing。

建议把同步逻辑收敛到一个 service 方法，避免 controller 和 queue consumer 各自写一半。

## 实施顺序建议

1. 后端新增 `monitored_post` 关联字段。
2. 新增 `upsertPublishedBackfillMonitor()` 内部方法。
3. 修改 `pluginResult`：拿到真实 noteId 后立即写入 `monitored_post`。
4. 修改 `updateTokenFromPlugin`：同步更新 `monitored_post`。
5. 调整 token 刷新任务 payload，携带 `noteId` 和可选 `monitoredPostId`。
6. 前端 WorkDataPage 删除 `pending-published-posts` 拼接逻辑。
7. 前端表格删除 `rowType=pending_published` 分支，改为按 `fetchStatus` 控制。
8. 废弃 `pending-published-posts` API。
9. 编写一次性迁移脚本，只迁移能解析真实 noteId 的 pending publishRecord。
10. 更新 `docs/memory/xhs-publish-monitoring-pipeline.md`，记录新的唯一数据源和状态机。

## 验收标准

1. 作品数据页不再调用 `pending-published-posts`。
2. 作品数据页上方审核中记录来自 `monitored_post`。
3. 所有作品行副标题展示真实 `noteId`，不显示 `req-*`。
4. 发布审核中记录只有一条，不会在审核通过后再新增重复正式记录。
5. 删除按钮对所有行统一删除 `monitored_post`。
6. token 刷新成功后，同一行从 `审核中/待确认` 变成 `已就绪/可抓取`。
7. 后端测试、前端类型检查、扩展类型检查通过。

