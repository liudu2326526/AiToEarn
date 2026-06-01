# 小红书 Token 自动刷新方案实施总结

## 实施日期
2026-06-01

## 方案概述

基于 MultiPost 扩展的自动化 Token 获取方案，利用扩展在小红书创作者笔记管理页面自动化操作，定期扫描待审核的笔记，从页面 DOM 中提取带 xsec_token 的完整链接，回传给后端更新。

## 完整流程

```
发布笔记（审核中）
    ↓
插件回传裸 noteId
    ↓
后端存储 dataId + linkStatus: PENDING
    ↓
【定时任务：每 30 分钟】
    ↓
后端扫描 PENDING 记录
    ↓
后端通知 MultiPost 扩展刷新指定 noteId
    ↓
MultiPost 导航到笔记管理页面
    ↓
MultiPost 在 DOM 中查找对应 noteId 的笔记卡片
    ↓
从卡片的 <a> 标签中提取带 token 的链接
    ↓
回传完整 URL 给后端
    ↓
后端更新 publish_record + 创建 monitored_post
    ↓
开始抓取数据
```

## 已实施的代码

### 1. MultiPost 扩展端

#### 1.1 Content Script (已存在)
**文件**: `project/aitoearn-extension/multipost-extension/src/contents/xhs-token-refresher.ts`

功能：
- 在小红书创作者页面运行
- 监听来自 background 的刷新请求
- 在 DOM 中查找指定 noteId 的笔记链接
- 提取带 xsec_token 的完整 URL
- 回传给 background script

#### 1.2 Background Script (已完善)
**文件**: `project/aitoearn-extension/multipost-extension/src/background/index.ts`

新增功能：
- 处理 `REFRESH_XHS_TOKEN_REQUEST` 消息
- 处理 `XHS_TOKEN_FOUND` 消息
- `handleRefreshTokenRequest()`: 查找或创建小红书创作者页面标签页，发送刷新请求
- `handleTokenFound()`: 调用后端 API 更新 token

### 2. 后端

#### 2.1 XhsTokenRefreshService (已存在)
**文件**: `apps/aitoearn-server/src/core/acquisition/xhs-token-refresh.service.ts`

功能：
- `@Cron(CronExpression.EVERY_30_MINUTES)` 定时扫描待审核记录
- `scanPendingRecords()`: 扫描所有 PENDING 状态的小红书发布记录
- `requestTokenRefresh()`: 将刷新请求加入队列
- `manualRefresh()`: 手动触发刷新（供 API 调用）

#### 2.2 PublishRecordRepository (已存在)
**文件**: `libs/mongodb/src/repositories/publish-record.repository.ts`

新增方法：
- `listPendingXhsRecords()`: 查询待审核的小红书发布记录（最近 7 天，限制 50 条）

#### 2.3 QueueService (已完善)
**文件**: `libs/aitoearn-queue/src/queue.service.ts`

新增方法：
- `addXhsTokenRefreshJob()`: 添加刷新任务到队列
- `getXhsTokenRefreshJobs()`: 获取待处理的刷新任务列表

#### 2.4 PublishController (已完善)
**文件**: `apps/aitoearn-server/src/core/channel/publish.controller.ts`

新增接口：
- `POST /plat/publish/updateTokenFromPlugin`: 从插件更新 token（公开接口）
- `POST /plat/publish/refreshXhsToken/:id`: 手动刷新 token
- `GET /plat/publish/xhsTokenRefreshJobs`: 获取当前用户的刷新任务列表

#### 2.5 DTO 定义 (已存在)
**文件**: `apps/aitoearn-server/src/core/channel/publish.dto.ts`

- `UpdateTokenFromPluginDto`: 插件更新 token 的请求参数

#### 2.6 Queue 枚举 (已存在)
**文件**: `libs/aitoearn-queue/src/enums/queue-name.enum.ts`

- `XhsTokenRefresh = 'xhs_token_refresh'`: 小红书 Token 刷新队列

### 3. 前端

#### 3.1 API 方法 (已新增)
**文件**: `project/aitoearn-web/src/api/plat/publish.ts`

新增方法：
- `refreshXhsToken(publishRecordId)`: 手动刷新小红书作品 token
- `getXhsTokenRefreshJobs()`: 获取小红书 token 刷新任务列表

#### 3.2 useXhsTokenRefresh Hook (已新增)
**文件**: `project/aitoearn-web/src/hooks/useXhsTokenRefresh.ts`

功能：
- 每 30 秒轮询后端获取待刷新的 token 任务
- 通过 `window.postMessage` 通知 MultiPost 扩展处理刷新
- 立即执行一次初始检查

#### 3.3 Providers 组件 (已更新)
**文件**: `project/aitoearn-web/src/app/layout/Providers.tsx`

更新：
- 导入 `useXhsTokenRefresh` hook
- 在组件中调用 hook 启动轮询

#### 3.4 MonitoredPostTable 组件 (已更新)
**文件**: `project/aitoearn-web/src/app/[lng]/work-data/components/MonitoredPostTable/index.tsx`

新增功能：
- 导入 `refreshXhsToken` API 方法
- 添加 `refreshingId` 状态管理
- 添加 `handleRefreshToken()` 方法
- 在操作列添加"获取令牌"按钮（仅对小红书审核中的作品显示）

## 关键技术点

### 1. 定时任务
- 后端使用 `@Cron(CronExpression.EVERY_30_MINUTES)` 每 30 分钟扫描一次
- 前端使用 `setInterval` 每 30 秒轮询一次

### 2. 消息通信
- 前端 → 扩展：`window.postMessage({ type: 'REFRESH_XHS_TOKEN_REQUEST', ... })`
- 扩展 content script → background：`chrome.runtime.sendMessage({ action: 'XHS_TOKEN_FOUND', ... })`
- 扩展 background → 后端：`fetch('/plat/publish/updateTokenFromPlugin')`

### 3. DOM 提取策略
- 策略 1：从页面 `<a>` 标签中查找（优先，因为审核通过后链接会包含 token）
- 策略 2：从笔记卡片的 `data-impression` 中查找 noteId

### 4. 数据流转
```
publish_record (linkStatus: PENDING)
    ↓
xhs_token_refresh 队列
    ↓
前端轮询获取任务
    ↓
MultiPost 扩展提取 token
    ↓
后端更新 publish_record (linkStatus: READY)
    ↓
创建 monitored_post
    ↓
开始数据抓取
```

## 配置要点

### 1. 后端配置
- 确保 `XhsTokenRefreshService` 已注册到 `AcquisitionModule`
- 确保 `@nestjs/schedule` 模块已导入
- 确保 Redis 连接正常（BullMQ 依赖）

### 2. 扩展配置
- 确保 content script 在 `creator.xiaohongshu.com` 域名下运行
- 确保 background script 有权限访问后端 API
- 确保 storage 中存储了 `apiBaseUrl` 和 `authToken`

### 3. 前端配置
- 确保 `useXhsTokenRefresh` hook 在应用启动时被调用
- 确保 API 请求的 base URL 正确配置

## 测试要点

### 1. 单元测试
- [ ] 后端定时任务是否正常触发
- [ ] 队列任务是否正确添加和获取
- [ ] API 接口是否返回正确数据

### 2. 集成测试
- [ ] 发布小红书笔记后，是否创建 PENDING 记录
- [ ] 定时任务是否扫描到 PENDING 记录并加入队列
- [ ] 前端是否能获取到刷新任务
- [ ] 扩展是否能收到刷新请求
- [ ] 扩展是否能提取到带 token 的链接
- [ ] 后端是否能收到 token 并更新记录
- [ ] 是否能创建 monitored_post 并开始抓取

### 3. 端到端测试
- [ ] 完整流程：发布 → 审核中 → 自动刷新 → 开始抓取
- [ ] 手动刷新：点击"获取令牌"按钮 → 扩展处理 → 更新成功
- [ ] 异常处理：扩展未安装、token 提取失败、API 调用失败

## 优势

1. **完全自动化**：无需用户手动操作
2. **利用现有能力**：MultiPost 已经在创作者页面运行
3. **定时轮询**：每 30 分钟自动检查
4. **手动触发**：用户也可以主动刷新
5. **简化逻辑**：移除复杂的用户主页刷新
6. **可靠性高**：直接从 DOM 提取真实链接

## 注意事项

1. **扩展依赖**：需要用户安装并授权 MultiPost 扩展
2. **页面依赖**：依赖小红书创作者页面的 DOM 结构，如果页面改版可能需要更新选择器
3. **时效性**：定时任务 30 分钟一次，可能存在延迟
4. **并发控制**：避免同时对同一笔记发起多次刷新请求
5. **错误处理**：需要完善各环节的错误处理和重试机制

## 后续优化建议

1. **WebSocket 推送**：替代前端轮询，实时推送刷新任务
2. **智能重试**：对失败的刷新任务进行指数退避重试
3. **监控告警**：添加刷新成功率监控和异常告警
4. **批量处理**：一次处理多个待刷新的笔记，提高效率
5. **缓存优化**：缓存已提取的 token，避免重复提取

## 相关文档

- [小红书发布到监控流程记忆](../memory/xhs-publish-monitoring-pipeline.md)
- [MultiPost 扩展文档](../../project/aitoearn-extension/multipost-extension/CLAUDE.md)
- [后端项目规范](../../project/aitoearn-backend/.claude/rules/project-standards.md)
