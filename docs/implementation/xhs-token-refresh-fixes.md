# 小红书 Token 自动刷新方案 - 问题修复总结

## 修复日期
2026-06-01

## 修复的问题

### ✅ 1. 队列任务移除时机问题（高优先级）

**问题描述**：
前端获取任务后立即从队列移除，如果扩展处理失败，任务会永久丢失。

**修复方案**：
- 改为在成功回传 token 后才移除任务
- 添加任务处理标记（`processingAt`、`processingCount`）
- 添加超时任务清理机制（10 分钟超时）

**修改文件**：
1. `libs/aitoearn-queue/src/queue.service.ts`
   - `getXhsTokenRefreshJobs()`: 不再立即移除任务，而是标记为处理中
   - `removeXhsTokenRefreshJob()`: 新增方法，用于成功处理后移除任务
   - `cleanupStaleXhsTokenRefreshJobs()`: 新增方法，清理超时任务

2. `apps/aitoearn-server/src/core/channel/publish.controller.ts`
   - `updateTokenFromPlugin()`: 成功处理后调用 `removeXhsTokenRefreshJob()`

3. `apps/aitoearn-server/src/core/acquisition/xhs-token-refresh.service.ts`
   - 新增 `cleanupStaleJobs()` 定时任务，每 10 分钟清理一次

**效果**：
- 任务不会因为扩展处理失败而丢失
- 超时任务会自动重新加入队列
- 避免任务永久卡在处理中状态

---

### ✅ 2. 定时任务与轮询协调问题（高优先级）

**问题描述**：
- 后端每 30 分钟扫描一次 → 任务集中产生
- 前端每 30 秒轮询一次 → 大部分请求都是空的

**修复方案**：
- 后端定时任务改为每 5 分钟扫描一次
- 前端轮询改为每 60 秒一次
- 减少无效请求，提高响应速度

**修改文件**：
1. `apps/aitoearn-server/src/core/acquisition/xhs-token-refresh.service.ts`
   - `scanPendingRecords()`: `@Cron('*/5 * * * *')` 改为每 5 分钟

2. `project/aitoearn-web/src/hooks/useXhsTokenRefresh.ts`
   - 轮询间隔从 30 秒改为 60 秒

**效果**：
- 新任务平均等待时间从 15 分钟降低到 2.5 分钟
- 前端无效请求减少 50%（从每小时 120 次降低到 60 次）
- 任务处理更及时

---

### ✅ 3. 扩展页面加载等待机制（中优先级）

**问题描述**：
固定等待 3 秒，网络慢时不够，网络快时浪费时间。

**修复方案**：
使用 `chrome.tabs.onUpdated` 监听页面加载完成，添加 10 秒超时保护。

**修改文件**：
`project/aitoearn-extension/multipost-extension/src/background/index.ts`
- `handleRefreshTokenRequest()`: 使用事件监听替代固定延迟

**效果**：
- 页面加载快时立即处理，不浪费时间
- 页面加载慢时最多等待 10 秒，有超时保护
- 提高处理可靠性

---

### ✅ 4. 并发控制（中优先级）

**问题描述**：
没有限制同时处理的刷新任务数量，可能导致资源浪费。

**修复方案**：
前端每次最多处理 5 个任务，剩余任务在下次轮询时处理。

**修改文件**：
`project/aitoearn-web/src/hooks/useXhsTokenRefresh.ts`
- `dispatchRefreshJobs()`: 添加批量限制，每次最多 5 个

**效果**：
- 避免同时打开过多标签页
- 避免扩展资源占用过高
- 提高处理稳定性

---

### ✅ 5. 错误处理和重试机制（中优先级）

**问题描述**：
多个环节缺少错误处理和重试机制。

**修复方案**：
- 扩展 background 添加 3 次重试，指数退避
- content script 添加 try-catch 错误处理
- 增加超时时间到 60 秒

**修改文件**：
1. `project/aitoearn-extension/multipost-extension/src/background/index.ts`
   - `handleTokenFound()`: 添加 3 次重试，指数退避（1s, 2s, 4s）

2. `project/aitoearn-extension/multipost-extension/src/contents/xhs-token-refresher.ts`
   - `findNoteLinkByNoteId()`: 添加 try-catch，超时时间从 20 秒增加到 60 秒
   - 调用处超时时间从 30 秒增加到 60 秒

**效果**：
- 网络抖动不会导致任务失败
- 临时错误会自动重试
- 提高成功率

---

## 修复前后对比

### 任务处理流程

**修复前**：
```
发布笔记 → 后端扫描（30分钟） → 加入队列 → 前端获取（立即删除） 
→ 扩展处理失败 → 任务丢失 ❌
```

**修复后**：
```
发布笔记 → 后端扫描（5分钟） → 加入队列 → 前端获取（标记处理中）
→ 扩展处理失败 → 10分钟后重新加入队列 → 重试 ✅
```

### 性能指标

| 指标 | 修复前 | 修复后 | 改善 |
|------|--------|--------|------|
| 任务平均等待时间 | 15 分钟 | 2.5 分钟 | ↓ 83% |
| 前端轮询频率 | 30 秒 | 60 秒 | ↓ 50% |
| 每小时请求次数 | 120 次 | 60 次 | ↓ 50% |
| 任务丢失风险 | 高 | 低 | ✅ |
| 并发任务数 | 无限制 | 最多 5 个 | ✅ |
| 重试次数 | 0 | 3 次 | ✅ |
| Token 提取超时 | 20-30 秒 | 60 秒 | ↑ 100% |

### 可靠性提升

**修复前的失败场景**：
1. ❌ 扩展未安装 → 任务丢失
2. ❌ 网络抖动 → 任务丢失
3. ❌ 页面加载慢 → 处理失败
4. ❌ DOM 查找超时 → 处理失败

**修复后的处理**：
1. ✅ 扩展未安装 → 10 分钟后重试
2. ✅ 网络抖动 → 自动重试 3 次
3. ✅ 页面加载慢 → 等待最多 10 秒
4. ✅ DOM 查找超时 → 60 秒超时，下次重试

---

## 代码变更统计

### 后端
- **修改文件**: 3 个
- **新增方法**: 3 个
- **修改方法**: 3 个
- **新增定时任务**: 1 个

### 扩展
- **修改文件**: 2 个
- **新增逻辑**: 重试机制、页面加载监听
- **修改超时**: 20s → 60s

### 前端
- **修改文件**: 1 个
- **新增逻辑**: 并发控制
- **修改轮询**: 30s → 60s

---

## 测试建议

### 单元测试
- [x] `getXhsTokenRefreshJobs` 不立即删除任务
- [x] `removeXhsTokenRefreshJob` 正确删除任务
- [x] `cleanupStaleXhsTokenRefreshJobs` 清理超时任务
- [ ] 重试机制测试
- [ ] 并发控制测试

### 集成测试
- [ ] 扩展未安装场景
- [ ] 网络失败重试场景
- [ ] 超时任务清理场景
- [ ] 并发任务处理场景
- [ ] 页面加载慢场景

### 性能测试
- [ ] 100 个任务的处理时间
- [ ] 前端轮询的资源占用
- [ ] 扩展处理的资源占用

---

## 后续优化建议

### 短期（1-2 周）
1. **添加监控指标**
   - 任务成功率
   - 平均处理时间
   - 重试次数统计
   - 超时任务数量

2. **完善日志**
   - 关键节点日志
   - 错误详情记录
   - 性能指标记录

### 中期（1-2 月）
3. **WebSocket 推送**
   - 替代前端轮询
   - 实时推送任务
   - 减少服务器压力

4. **智能重试**
   - 根据失败原因调整重试策略
   - 区分临时错误和永久错误
   - 避免无效重试

### 长期（3-6 月）
5. **用户体验优化**
   - 刷新进度提示
   - 失败原因展示
   - 手动重试按钮

6. **健壮性增强**
   - DOM 选择器降级方案
   - 扩展健康检查
   - 自动故障恢复

---

## 相关文档
- [实施总结](./xhs-token-auto-refresh-implementation.md)
- [潜在问题清单](./xhs-token-refresh-potential-issues.md)
- [小红书发布到监控流程](../memory/xhs-publish-monitoring-pipeline.md)
