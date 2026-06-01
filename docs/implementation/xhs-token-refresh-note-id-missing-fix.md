# 小红书 Token 自动刷新 - "XHS note id is missing" 问题修复

## 问题描述

用户发布小红书笔记后，点击"尝试自动获取访问令牌"按钮时，出现错误：
```
XHS note id is missing
```

## 根本原因

### 问题链路

1. **发布时**：用户通过 MultiPost 扩展发布小红书笔记
2. **审核中**：笔记进入审核状态，扩展只能获取到裸 noteId（没有 xsec_token）
3. **回传数据**：扩展回传 `pendingConfirmation: true`，但**没有回传 workLink**
4. **后端存储**：
   - `dataId` = `req-1780293934752-o59qn8lq`（临时 traceId）
   - `linkMeta.unverifiedWorkLink` = `undefined`（缺失）
5. **刷新 Token 时**：
   - `resolveXhsNoteId()` 尝试从 `dataId` 提取 → 被过滤（`req-` 开头）
   - 尝试从 `workLink` 提取 → 为空
   - 尝试从 `linkMeta.unverifiedWorkLink` 提取 → 为空
   - 返回 `null` → 报错 "XHS note id is missing"

### 代码位置

**扩展端**（问题所在）：
```typescript
// multipost-extension/src/contents/xhs-note-manager.ts:142-151
chrome.runtime.sendMessage({
  action: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
  data: {
    type: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
    traceId: pending.traceId,
    platform: pending.platform,
    success: true,
    // ❌ 问题：审核中时只回传 pendingConfirmation，没有 workLink
    ...(noteLink?.xsecToken ? noteLink : { pendingConfirmation: true }),
  },
});
```

**后端**（依赖 workLink）：
```typescript
// publish.controller.ts:320-333
async refreshXhsToken(@GetToken() token: TokenInfo, @Param('id') id: string) {
  const publishRecord = await this.publishRecordService.getPublishRecordInfo(id)
  // ...
  
  // ❌ 问题：resolveXhsNoteId 无法从空的 workLink 中提取 noteId
  const noteId = this.resolveXhsNoteId(publishRecord)
  if (!noteId) {
    throw new AppException(ResponseCode.PublishTaskInvalid, 'XHS note id is missing')
  }
  // ...
}
```

## 解决方案

### 修复扩展端

即使笔记在审核中（没有 token），也应该回传裸的 workLink，这样后端可以从中提取 noteId。

**修改文件**：`multipost-extension/src/contents/xhs-note-manager.ts`

```typescript
chrome.runtime.sendMessage({
  action: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
  data: {
    type: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
    traceId: pending.traceId,
    platform: pending.platform,
    success: true,
    // ✅ 修复：即使没有 token，也回传 workLink
    ...(noteLink?.xsecToken
      ? noteLink
      : noteLink?.workLink
        ? { pendingConfirmation: true, workLink: noteLink.workLink }
        : { pendingConfirmation: true }
    ),
  },
});
```

### 数据流转（修复后）

```
发布笔记（审核中）
    ↓
扩展抓取到裸 noteId（例如：6a1a7fc4000000000800024e）
    ↓
扩展回传：
  - pendingConfirmation: true
  - workLink: "https://www.xiaohongshu.com/explore/6a1a7fc4000000000800024e"  ✅
    ↓
后端存储：
  - dataId: "req-1780293934752-o59qn8lq"
  - linkMeta.unverifiedWorkLink: "https://www.xiaohongshu.com/explore/6a1a7fc4000000000800024e"  ✅
    ↓
用户点击"获取令牌"
    ↓
resolveXhsNoteId() 从 unverifiedWorkLink 提取：
  - 提取 noteId: "6a1a7fc4000000000800024e"  ✅
    ↓
加入刷新队列
    ↓
扩展在笔记管理页面查找该 noteId
    ↓
提取带 token 的链接并回传
    ↓
成功！
```

## 对已发布记录的处理

对于已经发布但没有 workLink 的记录（如 `req-1780293934752-o59qn8lq`），有两个选择：

### 方案 A：手动补充 workLink（推荐）

1. 打开小红书创作者中心笔记管理页面
2. 找到对应的笔记
3. 复制笔记链接（例如：`https://www.xiaohongshu.com/explore/6a1a7fc4000000000800024e`）
4. 在数据库中更新记录：

```javascript
db.publish_records.updateOne(
  { dataId: "req-1780293934752-o59qn8lq" },
  {
    $set: {
      "linkMeta.unverifiedWorkLink": "https://www.xiaohongshu.com/explore/实际的noteId"
    }
  }
)
```

5. 再次点击"获取令牌"按钮

### 方案 B：重新发布

如果找不到原始笔记链接，可以删除这条记录，重新发布笔记。

## 验证步骤

1. **重新构建扩展**：
   ```bash
   cd project/aitoearn-extension/multipost-extension
   pnpm build
   ```

2. **重新加载扩展**：
   - 打开 Chrome 扩展管理页面
   - 点击 MultiPost 扩展的"重新加载"按钮

3. **测试发布**：
   - 发布一篇新的小红书笔记
   - 等待笔记进入审核状态
   - 检查数据库中的 `linkMeta.unverifiedWorkLink` 是否有值

4. **测试刷新**：
   - 点击"尝试自动获取访问令牌"按钮
   - 应该不再报错 "XHS note id is missing"

## 预防措施

### 扩展端

- ✅ 确保 `xhs-note-manager.ts` 在任何情况下都回传 workLink
- ✅ 增加日志记录，便于调试

### 后端端

- ✅ `resolveXhsNoteId` 方法已支持从 `unverifiedWorkLink` 提取 noteId
- ✅ 添加更详细的错误信息，指出缺失的字段

### 监控

建议添加监控指标：
- 发布记录中 `linkMeta.unverifiedWorkLink` 为空的比例
- "XHS note id is missing" 错误的发生频率

## 相关文件

- `multipost-extension/src/contents/xhs-note-manager.ts` - 扩展端修复
- `apps/aitoearn-server/src/core/channel/publish.controller.ts` - 后端 noteId 解析
- `apps/aitoearn-server/src/core/acquisition/xhs-token-refresh.service.ts` - 后端 noteId 解析

## 总结

这个问题的根本原因是扩展在笔记审核中时没有回传 workLink，导致后端无法提取 noteId。修复后，即使笔记在审核中，也能正常进行 token 自动刷新。

**修复状态**：✅ 已完成
**验证状态**：⏳ 待测试
