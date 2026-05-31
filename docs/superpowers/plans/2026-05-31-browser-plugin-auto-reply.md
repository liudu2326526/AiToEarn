# Browser Plugin Auto Reply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build automatic public-comment reply execution through the existing browser plugin path, starting with Xiaohongshu leads and preserving backend ownership of generation, safety, task state, audit logs, and retry control.

**Architecture:** Keep the backend as the decision and orchestration layer: it selects eligible leads, generates safe reply suggestions, creates reply tasks, rate-limits execution, calls the local `xhs-bridge` extension, and records results. Extend `project/aitoearn-extension/xhs-bridge` from a read-only data bridge into a narrow authenticated browser executor that posts replies from the user's logged-in Xiaohongshu session without storing platform cookies in the backend. The web app exposes manual single-lead execution first, then current-filter batch execution with human-review gates.

**Tech Stack:** NestJS, Nx, BullMQ via existing `@yikart/aitoearn-queue`, Mongoose repositories in `@yikart/channel-db`, Zod DTOs with `createZodDto`, Chrome Extension Manifest V3, Chrome offscreen document, WebSocket bridge on `ws://127.0.0.1:9333`, Next.js App Router, Ant Design, pnpm, Vitest, Node built-in test runner for plain extension helpers.

---

## Product Decision

Use the browser plugin for platform-side execution.

Do not implement pure backend Xiaohongshu reply posting in this phase. Public comment replies depend on the user's current browser login state, platform CSRF behavior, page verification, and account environment. Moving cookies or platform session state to the backend would increase failure and account-risk surface. The plugin already runs in the user's browser and is connected to the backend through the XHS Bridge, so it is the correct execution boundary.

## MVP Scope

1. Xiaohongshu public comment reply execution for existing leads.
2. Single-lead "generate reply and execute" from the lead detail drawer.
3. Current-filter batch creation of reply tasks with automatic generation and safety filtering.
4. Backend-side task state, audit logs, and retry/failure visibility.
5. Extension-side reply command through the logged-in Xiaohongshu session.
6. Conservative rate limiting: one account executes one reply at a time, with a minimum delay between replies.
7. Safety gates:
   - blocked `suggestedReply.status` never auto-executes.
   - missing `commentId`, missing `postId`, unsupported platform, disconnected extension, platform verification, or platform API rejection creates a failed or human-required task.

## Explicit Non-Scope

1. Direct private-message automation.
2. Douyin and Kuaishou execution. The design leaves adapter slots, but MVP executes only `platform === "xhs"`.
3. Fully unattended high-volume replying. Batch execution remains bounded and auditable.
4. Bypassing platform login, verification, or account restrictions.
5. Storing Xiaohongshu cookies in MongoDB or backend config.

## Existing Code Baseline

Current useful pieces:

- `project/aitoearn-extension/xhs-bridge/background.js`
  - Has command dispatch for `navigate`, `wait_for_load`, `wait_dom_stable`, `evaluate`.
  - Uses `chrome.scripting.executeScript()` against the active Xiaohongshu tab.
- `project/aitoearn-extension/xhs-bridge/offscreen.js`
  - Maintains WebSocket connection to `ws://127.0.0.1:9333`.
  - Forwards backend commands to background.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge.service.ts`
  - Exposes `callExtension(method, params, timeoutMs)`.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-suggestion.service.ts`
  - Generates `suggestedReply` and blocks risky content.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-execution.service.ts`
  - Records manual/platform reply results but does not execute the platform action.
- `project/aitoearn-web/src/api/leads.ts`
  - Already wraps `reply-suggestion` and `reply-result`.
- `project/aitoearn-web/src/store/plugin/plats/xhs/index.ts`
  - Existing frontend-side `commentWork()` shows the Xiaohongshu browser-session posting shape:
    - `note_id`
    - `content`
    - `target_comment_id`
    - endpoint `/api/sns/web/v1/comment/post`

## Target Flow

### Single Lead

1. Operator opens a lead detail drawer.
2. Operator clicks `生成并回复`.
3. Frontend calls `POST /acquisition/leads/:id/auto-reply`.
4. Backend loads the lead and validates ownership.
5. Backend generates `suggestedReply` if none exists or if the user requested regeneration.
6. Backend rejects execution if the suggestion is blocked.
7. Backend creates a `lead_reply_task` row.
8. Backend enqueues one BullMQ job.
9. Worker calls `XhsBridgeService.callExtension("post_comment_reply", params)`.
10. Extension posts the reply using the user's logged-in Xiaohongshu browser session.
11. Worker records success or failure in `reply_comment_record`, updates the lead, and appends timeline activity.
12. Frontend polls task status or refreshes detail and table state.

### Batch Current Filters

1. Operator chooses filters in `/zh-CN/leads`.
2. Operator clicks `批量自动回复`.
3. Frontend sends current filters to `POST /acquisition/leads/auto-reply/batch`.
4. Backend selects up to `limit` eligible leads.
5. Backend generates missing reply suggestions one by one.
6. Backend skips blocked suggestions and creates failed/human-required task rows for visibility.
7. Backend creates pending tasks for safe suggestions.
8. Worker executes tasks serially by `{ userId, platform, accountId }` rate key.
9. Frontend shows counts: queued, skipped, blocked, failed, succeeded.

## Data Model

### `lead_reply_task`

Create a new collection instead of overloading `reply_comment_record`. `reply_comment_record` is an outcome record; `lead_reply_task` is an execution intent and state machine.

Fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `userId` | string | yes | Current AitoBee user. |
| `leadId` | string | yes | Lead row id. |
| `platform` | `xhs` \| `douyin` \| `kwai` | yes | MVP executes only `xhs`. |
| `accountId` | string | yes | Platform account id from lead. |
| `postId` | string | yes | Xiaohongshu note id. |
| `postUrl` | string | yes | Original Xiaohongshu note URL from the lead, including `xsec_token` when present. Required for browser execution. |
| `commentId` | string | yes | Target comment id to reply to. |
| `parentCommentId` | string | no | Existing lead parent id for future nested logic. |
| `replyContent` | string | yes | Frozen reply content at task creation. |
| `replyStyle` | string | yes | Resolved style used for generation. |
| `status` | enum | yes | `pending`, `queued`, `running`, `success`, `failed`, `blocked`, `human_required`, `cancelled`. |
| `executorKind` | enum | yes | Task executor boundary. MVP uses `browser_plugin`. Do not confuse this with `reply_comment_record.executionMode`. |
| `attemptCount` | number | yes | Starts at `0`. |
| `rateKey` | string | yes | `${userId}:${platform}:${accountId}`. |
| `lastError` | string | no | Human-readable failure reason. |
| `platformReplyId` | string | no | Returned platform comment id if available. |
| `screenshotUrl` | string | no | Object-storage URL only. Do not persist base64 data URLs in MongoDB. |
| `startedAt` | Date | no | Worker start. |
| `finishedAt` | Date | no | Terminal status time. |
| `createdAt` | Date | yes | From schema default options. |
| `updatedAt` | Date | yes | From schema default options. |

Indexes:

```ts
LeadReplyTaskSchema.index({ userId: 1, status: 1, createdAt: -1 }, { name: 'idx_lead_reply_task_user_status_created' })
LeadReplyTaskSchema.index({ leadId: 1, createdAt: -1 }, { name: 'idx_lead_reply_task_lead_created' })
LeadReplyTaskSchema.index({ rateKey: 1, status: 1, createdAt: 1 }, { name: 'idx_lead_reply_task_rate_status_created' })
LeadReplyTaskSchema.index(
  { leadId: 1 },
  {
    name: 'uniq_lead_reply_task_active_lead',
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'queued', 'running'] } },
  },
)
```

## API Contract

Backend route prefix stays `@Controller('/acquisition/leads')`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/auto-reply/batch` | Create reply tasks for current filters. |
| `GET` | `/reply-tasks` | List current user's reply tasks. |
| `POST` | `/reply-tasks/:taskId/cancel` | Cancel `pending` or `queued` task. |
| `POST` | `/reply-tasks/:taskId/retry` | Retry failed or human-required task after operator review. |
| `POST` | `/:id/auto-reply` | Generate or reuse a safe suggestion, create one reply task, enqueue execution. |
| `GET` | `/:id/reply-tasks` | List reply tasks for one lead. |

Route declaration order matters in `AcquisitionLeadsController`: declare all static reply-task routes above dynamic `/:id` routes, and insert these endpoints before the existing `@Get('/:id')` detail route.

### `POST /acquisition/leads/:id/auto-reply`

Request:

```json
{
  "regenerate": false,
  "dryRun": false,
  "requireSuggestionReview": false
}
```

Response:

```json
{
  "task": {
    "id": "task-id",
    "leadId": "lead-id",
    "status": "queued",
    "replyContent": "可以的，这件在主页入口能看到。",
    "executorKind": "browser_plugin"
  },
  "lead": {
    "id": "lead-id",
    "suggestedReply": {
      "content": "可以的，这件在主页入口能看到。",
      "status": "generated",
      "riskHits": []
    }
  }
}
```

If `requireSuggestionReview` is `true`, the same endpoint returns a non-executable task:

```json
{
  "task": {
    "id": "task-id",
    "leadId": "lead-id",
    "status": "human_required",
    "replyContent": "可以的，这件在主页入口能看到。",
    "executorKind": "browser_plugin"
  },
  "lead": {
    "id": "lead-id",
    "suggestedReply": {
      "content": "可以的，这件在主页入口能看到。",
      "status": "generated",
      "riskHits": []
    }
  }
}
```

### `POST /acquisition/leads/auto-reply/batch`

Request:

```json
{
  "platform": "xhs",
  "stage": "new_comment",
  "status": "pending",
  "postId": "6a1a7fc4000000000800024e",
  "keyword": "",
  "limit": 20,
  "onlyPending": true,
  "dryRun": false
}
```

Response:

```json
{
  "matched": 20,
  "queued": 16,
  "blocked": 2,
  "skipped": 1,
  "failed": 1,
  "taskIds": ["task-1", "task-2"]
}
```

## Extension Command Contract

Add one backend-to-extension command:

```json
{
  "method": "post_comment_reply",
  "params": {
    "noteId": "6a1a7fc4000000000800024e",
    "postUrl": "https://www.xiaohongshu.com/explore/6a1a7fc4000000000800024e?xsec_token=...",
    "commentId": "64f...",
    "content": "可以的，这件在主页入口能看到。",
    "visibleTab": true,
    "screenshotPolicy": "failure"
  }
}
```

Success result:

```json
{
  "success": true,
  "replyId": "comment-id-returned-by-xhs",
  "message": "评论回复已发布"
}
```

Failure result:

```json
{
  "success": false,
  "needHumanAssist": true,
  "verificationReason": "小红书要求验证或当前账号无权限回复",
  "message": "发布评论失败",
  "screenshotDataUrl": "data:image/png;base64,..."
}
```

The extension may return `screenshotDataUrl` only as a transient transport payload. The backend must upload it to the configured OBS/S3-compatible asset store through `AssetsService.uploadFromBuffer()` and persist only `lead_reply_task.screenshotUrl`.

## File Map

### Extension

| File | Responsibility |
|---|---|
| `project/aitoearn-extension/xhs-bridge/manifest.json` | Add any host permissions needed for reply execution; current XHS permission already covers MVP. |
| `project/aitoearn-extension/xhs-bridge/background.js` | Add `post_comment_reply` command and browser-session posting implementation. |
| `project/aitoearn-extension/xhs-bridge/reply-payload.js` | Pure helpers for payload validation and XHS API response normalization. |
| `project/aitoearn-extension/xhs-bridge/tests/reply-payload.test.mjs` | Node tests for helper behavior. |
| `project/aitoearn-extension/xhs-bridge/README.md` | Document new write capability, risk boundary, and local manual testing steps. |

### Backend Database

| File | Responsibility |
|---|---|
| `project/aitoearn-backend/libs/channel-db/src/schemas/lead-reply-task.schema.ts` | New Mongoose schema and indexes for reply execution tasks. |
| `project/aitoearn-backend/libs/channel-db/src/schemas/lead-activity-log.schema.ts` | Add activity actions for task creation, queueing, execution, human-required, cancellation, retry. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/lead-reply-task.repository.ts` | Task create/list/transition helpers. |
| `project/aitoearn-backend/libs/channel-db/src/schemas/index.ts` | Register schema. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/index.ts` | Register repository. |

### Backend Application

| File | Responsibility |
|---|---|
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/acquisition-leads.dto.ts` | Add DTOs for single auto-reply, batch auto-reply, task list, cancel, retry. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-automation.service.ts` | Validate leads, generate suggestions, create tasks, enqueue jobs, cancel/retry. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-task-executor.service.ts` | Execute one task through platform adapter and record final result. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-task-screenshot.service.ts` | Decode extension screenshot data URLs, upload screenshots to OBS through `AssetsService`, and return a persisted URL. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/platform-reply-adapters/xhs-browser-plugin-reply.adapter.ts` | Xiaohongshu browser-plugin execution adapter. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/platform-reply-adapters/index.ts` | Adapter exports and shared request/result contracts. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/platform-reply-adapters/registry.ts` | Platform-to-adapter registry used by the task executor. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/workers/lead-reply-task.consumer.ts` | BullMQ consumer for reply tasks. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/acquisition-leads.controller.ts` | Add auto-reply and task endpoints. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts` | Register new services and worker. |
| `project/aitoearn-backend/libs/aitoearn-queue/src/enums/queue-name.enum.ts` | Add `AcquisitionLeadReplyTask` queue name. |
| `project/aitoearn-backend/libs/aitoearn-queue/src/interfaces/acquisition.interface.ts` | Add `AcquisitionLeadReplyTaskData`. |
| `project/aitoearn-backend/libs/aitoearn-queue/src/queue.service.ts` | Add typed `addAcquisitionLeadReplyTaskJob()` wrapper. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-automation.service.spec.ts` | Unit tests for validation, safety gates, task creation. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-task-executor.service.spec.ts` | Unit tests for execution success/failure transitions. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-task-screenshot.service.spec.ts` | Unit tests for screenshot data URL validation and OBS upload behavior. |

### Frontend

| File | Responsibility |
|---|---|
| `project/aitoearn-web/src/api/leads.ts` | Add auto-reply and reply-task API helpers/types. |
| `project/aitoearn-web/src/app/[lng]/leads/LeadsPage/index.tsx` | Wire single and batch auto-reply actions. |
| `project/aitoearn-web/src/app/[lng]/leads/components/LeadToolbar/index.tsx` | Add `批量自动回复` action. |
| `project/aitoearn-web/src/app/[lng]/leads/components/LeadDetailDrawer/index.tsx` | Add `生成并回复`, task status list, retry/cancel controls. |
| `project/aitoearn-web/src/app/[lng]/leads/components/ReplyTaskStatusTag/index.tsx` | Shared task status display. |
| `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json` | Add Chinese labels. |
| `project/aitoearn-web/src/app/i18n/locales/en/route.json` | Add English labels. |

## Implementation Tasks

### Task 1: Add Extension Reply Payload Helpers

**Files:**
- Create: `project/aitoearn-extension/xhs-bridge/reply-payload.js`
- Create: `project/aitoearn-extension/xhs-bridge/tests/reply-payload.test.mjs`

- [ ] **Step 1: Create helper module**

Create `reply-payload.js`:

```js
export function validateReplyParams(params = {}) {
  const noteId = String(params.noteId || '').trim()
  const postUrl = String(params.postUrl || '').trim()
  const commentId = String(params.commentId || '').trim()
  const content = String(params.content || '').trim()

  if (!noteId) throw new Error('noteId 不能为空')
  if (!postUrl) throw new Error('postUrl 不能为空')
  if (!postUrl.startsWith('https://www.xiaohongshu.com/')) throw new Error('postUrl 必须是小红书链接')
  if (!commentId) throw new Error('commentId 不能为空')
  if (!content) throw new Error('回复内容不能为空')
  if (content.length > 1000) throw new Error('回复内容不能超过 1000 字')

  return {
    noteId,
    postUrl,
    commentId,
    content,
    visibleTab: params.visibleTab !== false,
    screenshotPolicy: ['never', 'failure', 'always'].includes(params.screenshotPolicy)
      ? params.screenshotPolicy
      : 'failure',
  }
}

export function buildXhsReplyBody(params) {
  return {
    note_id: params.noteId,
    content: params.content,
    at_users: [],
    target_comment_id: params.commentId,
  }
}

export function normalizeXhsReplyResponse(response) {
  const success = Boolean(response?.success || response?.code === 0 || response?.code === '0')
  const replyId = response?.data?.comment?.id || response?.data?.id || ''
  const message = response?.msg || response?.message || (success ? '评论回复已发布' : '发布评论失败')
  const signatureRejected = !success && /x-s|x-t|signature|签名|461|406/i.test(String(response?.msg || response?.message || response?.code || ''))

  return {
    success,
    replyId,
    message,
    // Log hint only. Do not branch final task status on this flag because
    // platform messages can be ambiguous.
    signatureRejected,
    rawData: response,
  }
}
```

- [ ] **Step 2: Add Node tests**

Create `tests/reply-payload.test.mjs`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildXhsReplyBody,
  normalizeXhsReplyResponse,
  validateReplyParams,
} from '../reply-payload.js'

test('validateReplyParams trims and normalizes params', () => {
  const params = validateReplyParams({
    noteId: ' note-1 ',
    postUrl: ' https://www.xiaohongshu.com/explore/note-1?xsec_token=abc ',
    commentId: ' comment-1 ',
    content: '  好的  ',
  })

  assert.deepEqual(params, {
    noteId: 'note-1',
    postUrl: 'https://www.xiaohongshu.com/explore/note-1?xsec_token=abc',
    commentId: 'comment-1',
    content: '好的',
    visibleTab: true,
    screenshotPolicy: 'failure',
  })
})

test('validateReplyParams rejects missing identifiers', () => {
  assert.throws(() => validateReplyParams({ postUrl: 'https://www.xiaohongshu.com/explore/n', commentId: 'c', content: 'hello' }), /noteId/)
  assert.throws(() => validateReplyParams({ noteId: 'n', commentId: 'c', content: 'hello' }), /postUrl/)
  assert.throws(() => validateReplyParams({ noteId: 'n', postUrl: 'https://example.com/n', commentId: 'c', content: 'hello' }), /小红书链接/)
  assert.throws(() => validateReplyParams({ noteId: 'n', postUrl: 'https://www.xiaohongshu.com/explore/n', content: 'hello' }), /commentId/)
})

test('buildXhsReplyBody builds Xiaohongshu reply body', () => {
  assert.deepEqual(buildXhsReplyBody({
    noteId: 'note-1',
    commentId: 'comment-1',
    content: '回复内容',
  }), {
    note_id: 'note-1',
    content: '回复内容',
    at_users: [],
    target_comment_id: 'comment-1',
  })
})

test('normalizeXhsReplyResponse handles success response', () => {
  const result = normalizeXhsReplyResponse({
    success: true,
    msg: 'ok',
    data: { comment: { id: 'reply-1' } },
  })

  assert.equal(result.success, true)
  assert.equal(result.replyId, 'reply-1')
  assert.equal(result.message, 'ok')
})

test('normalizeXhsReplyResponse flags likely signature failures', () => {
  const result = normalizeXhsReplyResponse({ code: 461, msg: 'x-s signature check failed' })
  assert.equal(result.success, false)
  assert.equal(result.signatureRejected, true)
})
```

- [ ] **Step 3: Verify helper tests fail before import support if needed**

Run:

```bash
node --test project/aitoearn-extension/xhs-bridge/tests/reply-payload.test.mjs
```

Expected after Step 1 and Step 2: all tests pass. If Node reports ESM import errors, add this `package.json` inside `project/aitoearn-extension/xhs-bridge`:

```json
{
  "type": "module",
  "private": true
}
```

Then rerun the command and expect pass.

### Task 2: Add `post_comment_reply` To XHS Bridge Extension

**Files:**
- Modify: `project/aitoearn-extension/xhs-bridge/background.js`
- Modify: `project/aitoearn-extension/xhs-bridge/manifest.json`
- Modify: `project/aitoearn-extension/xhs-bridge/README.md`

- [ ] **Step 1: Import helper functions**

At the top of `background.js`, add:

```js
import {
  buildXhsReplyBody,
  normalizeXhsReplyResponse,
  validateReplyParams,
} from './reply-payload.js'
```

- [ ] **Step 2: Register command in `handleCommand`**

Add a case:

```js
case 'post_comment_reply':
  return postCommentReply(params)
```

- [ ] **Step 3: Implement reply posting through the Xiaohongshu page context**

Add this function before `sleep(ms)`:

```js
async function postCommentReply(rawParams) {
  const params = validateReplyParams(rawParams)
  const tab = await getOrCreateXhsTab()

  if (!tab.id) {
    throw new Error('没有可用的小红书标签页')
  }

  await chrome.tabs.update(tab.id, { url: params.postUrl, active: params.visibleTab })
  currentXhsTabId = tab.id
  await waitForLoad(60000)
  await waitDomStable(10000, 500)

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: async (body) => {
      // This must execute in the Xiaohongshu page MAIN world so it can use the
      // same fetch environment as the logged-in page. If the page does not expose
      // the signing-patched fetch path, the response is treated as human-required.
      const response = await fetch('/api/sns/web/v1/comment/post', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
        body: JSON.stringify(body),
      })

      const text = await response.text()
      let payload
      try {
        payload = JSON.parse(text)
      }
      catch {
        payload = { success: false, msg: text || `HTTP ${response.status}` }
      }

      if (!response.ok) {
        return {
          success: false,
          code: response.status,
          msg: payload?.msg || payload?.message || `HTTP ${response.status}`,
          data: payload?.data,
        }
      }

      return payload
    },
    args: [buildXhsReplyBody(params)],
  })

  const normalized = normalizeXhsReplyResponse(results[0]?.result)
  const shouldCaptureScreenshot = params.screenshotPolicy === 'always'
    || (params.screenshotPolicy === 'failure' && !normalized.success)
  const screenshotDataUrl = shouldCaptureScreenshot
    ? await captureXhsVisibleTab(tab)
    : ''

  if (!normalized.success) {
    return {
      ...normalized,
      needHumanAssist: true,
      // signatureRejected changes the operator-facing reason only. The final
      // task status is still human_required for any platform rejection.
      verificationReason: normalized.signatureRejected
        ? '小红书请求签名不可用，需要切换到 DOM 自动化或复用现有插件签名通道'
        : normalized.message,
      screenshotDataUrl,
    }
  }

  return {
    ...normalized,
    screenshotDataUrl,
  }
}

async function captureXhsVisibleTab(tab) {
  if (!tab.id || !tab.windowId) return ''
  await chrome.windows.update(tab.windowId, { focused: true })
  await chrome.tabs.update(tab.id, { active: true })
  await sleep(300)
  return await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
}
```

This command is not allowed to silently bypass signing failures. The manual smoke test must prove that `world: 'MAIN'` can reach the same signed fetch behavior as the existing Xiaohongshu write path. If the smoke test returns a 406/461 or an `x-s`/`x-t` signature failure, stop before batch rollout and replace this function with DOM automation or a `window.postMessage` bridge that reuses the existing signed request path.

- [ ] **Step 4: Confirm permissions**

`manifest.json` already includes:

```json
"host_permissions": [
  "https://www.xiaohongshu.com/*"
]
```

Keep this permission. Do not add `<all_urls>` for the bridge extension.

`captureVisibleTab` is enabled only by `screenshotPolicy`. Keep the current tab on Xiaohongshu, focus its window, wait briefly after `chrome.tabs.update(..., { active: true })`, return the data URL to the backend, upload it to OBS there, and persist only the resulting URL.

- [ ] **Step 5: Update README**

Add under "当前能力":

```md
- 接收 AitoBee 发出的 `post_comment_reply` 命令，在用户已登录的小红书浏览器会话中回复指定评论。
```

Add under "注意":

```md
- `post_comment_reply` 是写操作。它只允许小红书评论回复，不保存平台 Cookie，不绕过登录、验证码或平台风控。
```

- [ ] **Step 6: Manual extension smoke test**

1. Restart local AitoBee backend so `ws://127.0.0.1:9333` is active.
2. Reload `project/aitoearn-extension/xhs-bridge` in `chrome://extensions`.
3. Login to `https://www.xiaohongshu.com`.
4. Open the Xiaohongshu note in the browser and copy the full note URL from the address bar. The smoke-test `postUrl` must include `xsec_token`.
5. Use a local script or backend console path to call:

```ts
await xhsBridgeService.callExtension('post_comment_reply', {
  noteId: 'real-note-id',
  postUrl: 'https://www.xiaohongshu.com/explore/real-note-id?xsec_token=real-token',
  commentId: 'real-comment-id',
  content: '谢谢反馈，我们确认下细节再同步。',
  visibleTab: true,
  screenshotPolicy: 'failure',
})
```

Expected: extension posts one reply and returns `success: true`. If the result mentions `x-s`, `x-t`, `signature`, HTTP 406, or HTTP 461, do not continue to backend integration until the execution path is switched to DOM automation or a signed-request bridge.

### Task 3: Add `LeadReplyTask` Schema And Repository

**Files:**
- Create: `project/aitoearn-backend/libs/channel-db/src/schemas/lead-reply-task.schema.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/lead-activity-log.schema.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/index.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/repositories/lead-reply-task.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/index.ts`

- [ ] **Step 1: Create schema**

Create `lead-reply-task.schema.ts`:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export type LeadReplyTaskDocument = HydratedDocument<LeadReplyTask>

export enum LeadReplyTaskStatus {
  Pending = 'pending',
  Queued = 'queued',
  Running = 'running',
  Success = 'success',
  Failed = 'failed',
  Blocked = 'blocked',
  HumanRequired = 'human_required',
  Cancelled = 'cancelled',
}

export enum LeadReplyExecutorKind {
  BrowserPlugin = 'browser_plugin',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'lead_reply_task' })
export class LeadReplyTask extends BaseTemp {
  @Prop({ required: true, index: true, type: String })
  userId: string

  @Prop({ required: true, index: true, type: String })
  leadId: string

  @Prop({ required: true, enum: ['xhs', 'douyin', 'kwai'], index: true, type: String })
  platform: 'xhs' | 'douyin' | 'kwai'

  @Prop({ required: true, index: true, type: String })
  accountId: string

  @Prop({ required: true, index: true, type: String })
  postId: string

  @Prop({ required: true, type: String })
  postUrl: string

  @Prop({ required: true, index: true, type: String })
  commentId: string

  @Prop({ type: String, default: '' })
  parentCommentId: string

  @Prop({ required: true, type: String })
  replyContent: string

  @Prop({ required: true, type: String })
  replyStyle: string

  @Prop({ required: true, enum: LeadReplyTaskStatus, default: LeadReplyTaskStatus.Pending, index: true, type: String })
  status: LeadReplyTaskStatus

  @Prop({ required: true, enum: LeadReplyExecutorKind, default: LeadReplyExecutorKind.BrowserPlugin, type: String })
  executorKind: LeadReplyExecutorKind

  @Prop({ type: Number, default: 0 })
  attemptCount: number

  @Prop({ required: true, index: true, type: String })
  rateKey: string

  @Prop({ type: String, default: '' })
  lastError: string

  @Prop({ type: String, default: '' })
  platformReplyId: string

  @Prop({ type: String, default: '' })
  screenshotUrl: string

  @Prop({ type: Date, default: null })
  startedAt?: Date

  @Prop({ type: Date, default: null })
  finishedAt?: Date
}

export const LeadReplyTaskSchema = SchemaFactory.createForClass(LeadReplyTask)

LeadReplyTaskSchema.index({ userId: 1, status: 1, createdAt: -1 }, { name: 'idx_lead_reply_task_user_status_created' })
LeadReplyTaskSchema.index({ leadId: 1, createdAt: -1 }, { name: 'idx_lead_reply_task_lead_created' })
LeadReplyTaskSchema.index({ rateKey: 1, status: 1, createdAt: 1 }, { name: 'idx_lead_reply_task_rate_status_created' })
LeadReplyTaskSchema.index(
  { leadId: 1 },
  {
    name: 'uniq_lead_reply_task_active_lead',
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'queued', 'running'] } },
  },
)
```

- [ ] **Step 2: Register schema**

In `schemas/index.ts`, import/export `LeadReplyTask`, `LeadReplyTaskSchema`, and add `{ name: LeadReplyTask.name, schema: LeadReplyTaskSchema }` to the exported `schemas` array using the same pattern as the existing `Lead` and `LeadActivityLog` registrations.

- [ ] **Step 3: Extend activity actions**

In `lead-activity-log.schema.ts`, add action values:

```ts
ReplyTaskCreated = 'reply_task_created',
ReplyTaskQueued = 'reply_task_queued',
ReplyTaskRunning = 'reply_task_running',
ReplyTaskHumanRequired = 'reply_task_human_required',
ReplyTaskCancelled = 'reply_task_cancelled',
ReplyTaskRetryQueued = 'reply_task_retry_queued',
```

- [ ] **Step 4: Create repository**

Create `lead-reply-task.repository.ts`:

```ts
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { BaseRepository } from './base.repository'
import { LeadReplyTask, LeadReplyTaskDocument, LeadReplyTaskStatus } from '../schemas/lead-reply-task.schema'

@Injectable()
export class LeadReplyTaskRepository extends BaseRepository<LeadReplyTaskDocument> {
  constructor(@InjectModel(LeadReplyTask.name) model: Model<LeadReplyTaskDocument>) {
    super(model)
  }

  async listByUser(userId: string, query: { status?: string; leadId?: string; page?: number; pageSize?: number }) {
    const filter: Record<string, unknown> = { userId }
    if (query.status) filter.status = query.status
    if (query.leadId) filter.leadId = query.leadId

    const page = Math.max(Number(query.page || 1), 1)
    const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100)
    const [list, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean({ virtuals: true }),
      this.model.countDocuments(filter),
    ])

    return [list, total] as const
  }

  async getByIdAndUser(id: string, userId: string) {
    return await this.model.findOne({ _id: id, userId }).lean({ virtuals: true })
  }

  async markQueued(id: string) {
    return await this.model.findByIdAndUpdate(id, { status: LeadReplyTaskStatus.Queued }, { new: true }).lean({ virtuals: true })
  }

  async markRunning(id: string) {
    return await this.model.findByIdAndUpdate(id, {
      status: LeadReplyTaskStatus.Running,
      $inc: { attemptCount: 1 },
      startedAt: new Date(),
      lastError: '',
    }, { new: true }).lean({ virtuals: true })
  }

  async markTerminal(id: string, status: LeadReplyTaskStatus, patch: Record<string, unknown>) {
    return await this.model.findByIdAndUpdate(id, {
      ...patch,
      status,
      finishedAt: new Date(),
    }, { new: true }).lean({ virtuals: true })
  }
}
```

- [ ] **Step 5: Register repository**

In `repositories/index.ts`, export and add `LeadReplyTaskRepository` to the `repositories` array.

### Task 4: Add Backend DTOs And API Endpoints

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/acquisition-leads.dto.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/acquisition-leads.controller.ts`

- [ ] **Step 1: Add DTOs**

Add to `acquisition-leads.dto.ts`:

```ts
export const AutoReplyLeadSchema = z.object({
  regenerate: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  requireSuggestionReview: z.boolean().default(false),
})

export class AutoReplyLeadDto extends createZodDto(AutoReplyLeadSchema, 'AutoReplyLeadDto') {}

export const BatchAutoReplyLeadsSchema = LeadStatsQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  onlyPending: z.boolean().default(true),
  dryRun: z.boolean().default(false),
})

export class BatchAutoReplyLeadsDto extends createZodDto(BatchAutoReplyLeadsSchema, 'BatchAutoReplyLeadsDto') {}

export const LeadReplyTaskListQuerySchema = z.object({
  status: z.enum(['pending', 'queued', 'running', 'success', 'failed', 'blocked', 'human_required', 'cancelled']).optional(),
  leadId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export class LeadReplyTaskListQueryDto extends createZodDto(LeadReplyTaskListQuerySchema, 'LeadReplyTaskListQueryDto') {}
```

- [ ] **Step 2: Add controller methods**

Inject `ReplyAutomationService` and add these methods above the existing `@Get('/:id')` method. Keep the static routes before dynamic `/:id...` routes:

```ts
@Post('/auto-reply/batch')
async batchAutoReply(@GetToken() token: TokenInfo, @Body() body: BatchAutoReplyLeadsDto) {
  const userId = token.id
  const operatorId = token.id
  return await this.replyAutomationService.createBatchTasks(userId, body, operatorId)
}

@Get('/reply-tasks')
async replyTasks(@GetToken() token: TokenInfo, @Query() query: LeadReplyTaskListQueryDto) {
  const userId = token.id
  return await this.replyAutomationService.listTasks(userId, query)
}

@Post('/reply-tasks/:taskId/cancel')
async cancelReplyTask(@GetToken() token: TokenInfo, @Param('taskId') taskId: string) {
  const userId = token.id
  const operatorId = token.id
  return await this.replyAutomationService.cancelTask(userId, taskId, operatorId)
}

@Post('/reply-tasks/:taskId/retry')
async retryReplyTask(@GetToken() token: TokenInfo, @Param('taskId') taskId: string) {
  const userId = token.id
  const operatorId = token.id
  return await this.replyAutomationService.retryTask(userId, taskId, operatorId)
}

@Post('/:id/auto-reply')
async autoReply(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: AutoReplyLeadDto) {
  const userId = token.id
  const operatorId = token.id
  return await this.replyAutomationService.createSingleTask(userId, id, body, operatorId)
}

@Get('/:id/reply-tasks')
async leadReplyTasks(@GetToken() token: TokenInfo, @Param('id') id: string, @Query() query: LeadReplyTaskListQueryDto) {
  const userId = token.id
  return await this.replyAutomationService.listTasks(userId, { ...query, leadId: id })
}
```

### Task 5: Implement Backend Reply Automation Service

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-automation.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-automation.service.spec.ts`
- Modify: `project/aitoearn-backend/libs/aitoearn-queue/src/enums/queue-name.enum.ts`
- Modify: `project/aitoearn-backend/libs/aitoearn-queue/src/interfaces/acquisition.interface.ts`
- Modify: `project/aitoearn-backend/libs/aitoearn-queue/src/queue.service.ts`

- [ ] **Step 1: Write tests for safety gates**

Create tests proving:

1. Unsupported platform creates no executable task.
2. Blocked suggestion creates a `blocked` task and does not enqueue.
3. Safe Xiaohongshu lead creates a queued task.
4. `dryRun` returns counts without persisting tasks.
5. Retry refuses non-XHS, blocked, cancelled, success, or running tasks.

Use mocked repositories and a mocked queue service. The core test names:

```ts
it('blocks non-xhs leads in MVP')
it('does not enqueue blocked suggestions')
it('creates and queues a safe xhs reply task')
it('supports dryRun for batch auto reply')
it('does not retry unsupported or terminal tasks')
```

- [ ] **Step 2: Implement service**

Core behavior:

```ts
import { QueueService } from '@yikart/aitoearn-queue'

@Injectable()
export class ReplyAutomationService {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly leadReplyTaskRepository: LeadReplyTaskRepository,
    private readonly leadActivityLogRepository: LeadActivityLogRepository,
    private readonly replySuggestionService: ReplySuggestionService,
    private readonly queueService: QueueService,
  ) {}

  async createSingleTask(userId: string, id: string, body: AutoReplyLeadDto, operatorId: string) {
    const lead = await this.leadRepository.getByIdAndUser(id, userId)
    if (!lead) throw new AppException(ResponseCode.LeadNotFound)

    const prepared = await this.prepareLead(userId, lead, body.regenerate, operatorId)
    if (body.dryRun) return { task: null, lead: prepared.lead, dryRun: true }

    const task = await this.createTaskFromPreparedLead(userId, prepared.lead, prepared.replyContent, operatorId)
    if (task.status === 'queued') await this.queueService.addAcquisitionLeadReplyTaskJob({ taskId: task.id })

    return { task, lead: prepared.lead }
  }
}
```

Rules:

- If `lead.platform !== 'xhs'`, create no task and throw `ResponseCode.PlatformNotSupported` for single lead. The global exception filter returns HTTP 200 with an application `code`, so frontend logic must check `response.code` instead of relying on HTTP 400.
- In batch mode, non-XHS leads may create `human_required` task rows for audit visibility only. These rows are not executable and `retryTask()` must reject them before enqueueing.
- If `suggestedReply.status === 'blocked'`, create a task with `status: blocked` for batch mode and return a user-visible blocked count.
- If `requireSuggestionReview === true`, create a task with `status: human_required` and do not enqueue.
- If `lead.commentId`, `lead.postId`, or `lead.postUrl` is empty, create `human_required` in batch mode and throw validation error in single mode.
- If `lead.platform === 'xhs'` but `lead.postUrl` does not contain `xsec_token`, create `human_required` in batch mode and throw validation error in single mode unless the implementation first refreshes the monitored post URL from the existing XHS acquisition path.
- `retryTask()` may enqueue only tasks with `platform === 'xhs'` and `status` in `['failed', 'human_required']` after re-validating `postId`, `postUrl`, `xsec_token`, `commentId`, and non-empty `replyContent`.

- [ ] **Step 3: Queue service wrapper**

Do not inject BullMQ queues directly in the acquisition module. The queue library README requires application services to use `QueueService`.

In `libs/aitoearn-queue/src/enums/queue-name.enum.ts`, add:

```ts
AcquisitionLeadReplyTask = 'acquisition_lead_reply_task',
```

`AitoearnQueueModule` registers queues from `Object.values(QueueName)`, so adding the enum value is the queue registration step. Do not add a separate `BullModule.registerQueue()` call in `acquisition.module.ts`.

In `libs/aitoearn-queue/src/interfaces/acquisition.interface.ts`, add:

```ts
export interface AcquisitionLeadReplyTaskData {
  taskId: string
}
```

In `libs/aitoearn-queue/src/queue.service.ts`, inject the queue in the constructor next to the other acquisition queues:

```ts
@InjectQueue(QueueName.AcquisitionLeadReplyTask)
private readonly acquisitionLeadReplyTaskQueue: Queue,
```

Add the typed wrapper:

```ts
async addAcquisitionLeadReplyTaskJob(data: AcquisitionLeadReplyTaskData, options?: JobsOptions) {
  return await this.acquisitionLeadReplyTaskQueue.add(QueueName.AcquisitionLeadReplyTask, data, {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30000 },
    removeOnComplete: 1000,
    removeOnFail: 1000,
    ...options,
  })
}
```

Use this wrapper from `ReplyAutomationService`. The `lead_reply_task.attemptCount` field is for audit only; BullMQ is the single retry controller in MVP.

### Task 6: Implement OBS Screenshot Upload

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-task-screenshot.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-task-screenshot.service.spec.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts`

- [ ] **Step 1: Write screenshot service tests**

Create tests proving:

```ts
it('returns empty string for missing screenshot data')
it('rejects non-image data urls')
it('rejects screenshots larger than the configured cap')
it('uploads a png screenshot through AssetsService and returns the asset url')
```

- [ ] **Step 2: Implement screenshot service**

Create `reply-task-screenshot.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import { AssetsService } from '@yikart/assets'
import { AppException, ResponseCode } from '@yikart/common'
import { AssetType } from '@yikart/mongodb'

const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024
const DATA_URL_RE = /^data:(image\/png|image\/jpeg|image\/webp);base64,([a-z0-9+/=]+)$/i

@Injectable()
export class ReplyTaskScreenshotService {
  constructor(private readonly assetsService: AssetsService) {}

  async uploadScreenshot(userId: string, taskId: string, screenshotDataUrl?: string): Promise<string> {
    if (!screenshotDataUrl) return ''

    const match = screenshotDataUrl.match(DATA_URL_RE)
    if (!match) {
      throw new AppException(ResponseCode.ValidationFailed, 'Invalid screenshot data URL')
    }

    const mimeType = match[1].toLowerCase()
    const buffer = Buffer.from(match[2], 'base64')
    if (!buffer.length) return ''
    if (buffer.length > MAX_SCREENSHOT_BYTES) {
      throw new AppException(ResponseCode.AssetTooLarge, 'Screenshot is too large')
    }

    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1]
    const result = await this.assetsService.uploadFromBuffer(userId, buffer, {
      type: AssetType.Temp,
      mimeType,
      filename: `${taskId}.${ext}`,
    }, `lead-reply-task/${taskId}`)

    return result.url
  }
}
```

`AssetsModule` is already imported by `aitoearn-server` through `apps/aitoearn-server/src/core/assets/assets.module.ts`, which wraps `AssetsHttpModule.forRoot({ assetsConfig: config.assets })`. Do not add OBS credentials to the extension or expose upload credentials through the bridge.

- [ ] **Step 3: Register service**

In `acquisition.module.ts`, add:

```ts
ReplyTaskScreenshotService,
```

### Task 7: Implement XHS Browser Plugin Adapter

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/platform-reply-adapters/xhs-browser-plugin-reply.adapter.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/platform-reply-adapters/index.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/platform-reply-adapters/registry.ts`

- [ ] **Step 1: Create adapter interface**

Create `index.ts`:

```ts
export interface PlatformReplyRequest {
  taskId: string
  postId: string
  postUrl: string
  commentId: string
  replyContent: string
}

export interface PlatformReplyResult {
  success: boolean
  platformReplyId?: string
  screenshotDataUrl?: string
  needHumanAssist?: boolean
  failureReason?: string
}

export interface PlatformReplyAdapter {
  execute(request: PlatformReplyRequest): Promise<PlatformReplyResult>
}
```

- [ ] **Step 2: Create XHS adapter**

Create `xhs-browser-plugin-reply.adapter.ts`:

```ts
import { Injectable } from '@nestjs/common'
import { XhsBridgeService } from '../../../xhs-bridge/xhs-bridge.service'
import type { PlatformReplyAdapter, PlatformReplyRequest, PlatformReplyResult } from './index'

@Injectable()
export class XhsBrowserPluginReplyAdapter implements PlatformReplyAdapter {
  constructor(private readonly xhsBridgeService: XhsBridgeService) {}

  async execute(request: PlatformReplyRequest): Promise<PlatformReplyResult> {
    const result = await this.xhsBridgeService.callExtension<{
      success?: boolean
      replyId?: string
      screenshotDataUrl?: string
      needHumanAssist?: boolean
      verificationReason?: string
      message?: string
    }>('post_comment_reply', {
      noteId: request.postId,
      postUrl: request.postUrl,
      commentId: request.commentId,
      content: request.replyContent,
      visibleTab: true,
      screenshotPolicy: 'failure',
    }, 90000)

    return {
      success: Boolean(result.success),
      platformReplyId: result.replyId || '',
      screenshotDataUrl: result.screenshotDataUrl || '',
      needHumanAssist: Boolean(result.needHumanAssist),
      failureReason: result.verificationReason || result.message || '',
    }
  }
}
```

- [ ] **Step 3: Create adapter registry**

Create `registry.ts`:

```ts
import { Injectable } from '@nestjs/common'
import { AppException, ResponseCode } from '@yikart/common'
import { XhsBrowserPluginReplyAdapter } from './xhs-browser-plugin-reply.adapter'
import type { PlatformReplyAdapter } from './index'

@Injectable()
export class PlatformReplyAdapterRegistry {
  constructor(private readonly xhsAdapter: XhsBrowserPluginReplyAdapter) {}

  get(platform: string): PlatformReplyAdapter {
    if (platform === 'xhs') return this.xhsAdapter
    throw new AppException(ResponseCode.PlatformNotSupported)
  }
}
```

Register `PlatformReplyAdapterRegistry` as a provider together with `XhsBrowserPluginReplyAdapter`. This keeps platform dispatch explicit and prevents `ReplyTaskExecutorService` from hard-coding adapter construction.

### Task 8: Implement Reply Task Executor And Worker

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-task-executor.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-task-executor.service.spec.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/workers/lead-reply-task.consumer.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts`
- Use: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-task-screenshot.service.ts`

- [ ] **Step 1: Write executor tests**

Test cases:

```ts
it('marks task success and records reply result')
it('marks task human_required when adapter reports human assist')
it('marks task failed when adapter throws')
it('does not execute cancelled task')
it('uploads screenshot evidence when adapter returns screenshotDataUrl')
```

- [ ] **Step 2: Implement executor**

Executor behavior:

1. Load task by id.
2. If status is `cancelled`, return without platform call.
3. If `task.platform !== 'xhs'`, mark `human_required`, append `reply_task_human_required`, and return without calling the registry. This keeps batch audit rows from becoming failed worker jobs.
4. Mark `running`.
5. Resolve adapter by platform through `PlatformReplyAdapterRegistry`.
6. Call adapter.
7. If `adapterResult.screenshotDataUrl` is not empty:
   - call `ReplyTaskScreenshotService.uploadScreenshot(userId, task.id, adapterResult.screenshotDataUrl)`.
   - store the returned URL on `lead_reply_task.screenshotUrl`.
   - if upload fails, keep the reply task status based on the platform result and store the upload error in `lastError`; do not persist the data URL.
8. On success:
   - mark task `success`.
   - call existing `ReplyExecutionService.recordResult()` using the contract below.
   - do not append `reply_executed` here because `recordResult()` already appends it.
9. On `needHumanAssist`:
   - mark task `human_required`.
   - append activity `reply_task_human_required`.
10. On thrown error:
   - mark task `failed`.
   - call `ReplyExecutionService.recordResult()` with `status: 'failed'` when the platform call reached execution; otherwise append only a task-level failure activity to avoid duplicate `reply_failed` timeline entries.

Record result contract:

```ts
await this.replyExecutionService.recordResult(userId, task.leadId, {
  replyContent: task.replyContent,
  status: adapterResult.success ? 'success' : 'failed',
  executionMode: 'platform_adapter',
  failureReason: adapterResult.failureReason || '',
}, operatorId)
```

Do not pass `platformReplyId` or `screenshotUrl` to `ReplyExecutionService.recordResult()` unless `ReplyResultDto` and `reply_comment_record.schema.ts` are extended first. Store platform evidence on `lead_reply_task.platformReplyId` and `lead_reply_task.screenshotUrl`.

Naming map:

| Object | Field | Values | Meaning |
|---|---|---|---|
| `lead_reply_task` | `executorKind` | `browser_plugin` | How the task is executed. |
| `reply_comment_record` | `executionMode` | `manual`, `platform_adapter` | How the reply result is recorded. Existing schema accepts only these values. |

- [ ] **Step 3: Implement rate delay**

In the worker, serialize jobs by rate key:

```ts
const MIN_REPLY_INTERVAL_MS = 15000
const lastExecutionByRateKey = new Map<string, number>()

async function waitForRateKey(rateKey: string) {
  const now = Date.now()
  const last = lastExecutionByRateKey.get(rateKey) || 0
  const waitMs = Math.max(0, last + MIN_REPLY_INTERVAL_MS - now)
  if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs))
  lastExecutionByRateKey.set(rateKey, Date.now())
}
```

The first implementation is process-local. This is acceptable for local MVP only. Batch auto-reply must remain disabled outside local/dev until this limiter is replaced with Redis-based coordination or BullMQ group/rate configuration that works across worker instances.

- [ ] **Step 4: Register services and worker**

In `acquisition.module.ts`, add providers:

```ts
ReplyAutomationService,
ReplyTaskExecutorService,
ReplyTaskScreenshotService,
LeadReplyTaskConsumer,
XhsBrowserPluginReplyAdapter,
PlatformReplyAdapterRegistry,
```

Ensure `XhsBridgeModule` is already imported. It is currently imported by acquisition module for data collection, so reuse it.

### Task 9: Add Frontend API Helpers

**Files:**
- Modify: `project/aitoearn-web/src/api/leads.ts`

- [ ] **Step 1: Add task types**

```ts
export type LeadReplyTaskStatus = 'pending' | 'queued' | 'running' | 'success' | 'failed' | 'blocked' | 'human_required' | 'cancelled'

export interface LeadReplyTaskItem {
  id: string
  leadId: string
  platform: AcquisitionPlatform
  accountId: string
  postId: string
  postUrl: string
  commentId: string
  replyContent: string
  replyStyle: LeadReplyStyle
  status: LeadReplyTaskStatus
  executorKind: 'browser_plugin'
  attemptCount: number
  lastError?: string
  platformReplyId?: string
  screenshotUrl?: string
  startedAt?: string
  finishedAt?: string
  createdAt?: string
  updatedAt?: string
}
```

`AcquisitionPlatform` currently resolves to `'xhs' | 'douyin' | 'kwai'` in `src/api/acquisition.ts`, matching the task schema enum. Re-check this type if new platforms are added before implementation.

- [ ] **Step 2: Add API helpers**

```ts
export async function autoReplyLead(id: string, data: { regenerate?: boolean; dryRun?: boolean; requireSuggestionReview?: boolean } = {}) {
  const response = await http.post<{ task: LeadReplyTaskItem | null; lead: LeadItem; dryRun?: boolean }>(`acquisition/leads/${id}/auto-reply`, data)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'auto reply lead failed')
  return response.data
}

export async function batchAutoReplyLeads(params: Record<string, string | number | boolean | undefined>) {
  const response = await http.post<{ matched: number; queued: number; blocked: number; skipped: number; failed: number; taskIds: string[] }>('acquisition/leads/auto-reply/batch', params)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'batch auto reply leads failed')
  return response.data
}

export async function listLeadReplyTasks(id: string) {
  const response = await http.get<{ list: LeadReplyTaskItem[]; total: number }>(`acquisition/leads/${id}/reply-tasks`)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'list lead reply tasks failed')
  return response.data
}

export async function cancelLeadReplyTask(taskId: string) {
  const response = await http.post<LeadReplyTaskItem>(`acquisition/leads/reply-tasks/${taskId}/cancel`)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'cancel lead reply task failed')
  return response.data
}

export async function retryLeadReplyTask(taskId: string) {
  const response = await http.post<LeadReplyTaskItem>(`acquisition/leads/reply-tasks/${taskId}/retry`)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'retry lead reply task failed')
  return response.data
}
```

### Task 10: Add Lead UI Controls

**Files:**
- Modify: `project/aitoearn-web/src/app/[lng]/leads/LeadsPage/index.tsx`
- Modify: `project/aitoearn-web/src/app/[lng]/leads/components/LeadToolbar/index.tsx`
- Modify: `project/aitoearn-web/src/app/[lng]/leads/components/LeadDetailDrawer/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/leads/components/ReplyTaskStatusTag/index.tsx`
- Modify: `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json`
- Modify: `project/aitoearn-web/src/app/i18n/locales/en/route.json`

- [ ] **Step 1: Add status tag component**

Create:

```tsx
import { Tag } from 'antd'
import type { LeadReplyTaskStatus } from '@/api/leads'

const STATUS_COLOR: Record<LeadReplyTaskStatus, string> = {
  pending: 'default',
  queued: 'processing',
  running: 'blue',
  success: 'green',
  failed: 'red',
  blocked: 'red',
  human_required: 'gold',
  cancelled: 'default',
}

interface ReplyTaskStatusTagProps {
  status: LeadReplyTaskStatus
  label: string
}

export default function ReplyTaskStatusTag({ status, label }: ReplyTaskStatusTagProps) {
  return <Tag color={STATUS_COLOR[status]}>{label}</Tag>
}
```

- [ ] **Step 2: Add single-lead action**

In `LeadDetailDrawer`, add a primary action button next to `生成`:

```tsx
<Button
  type="primary"
  loading={autoReplying}
  onClick={onAutoReply}
>
  {labels.ui.generateAndReply}
</Button>
```

Keep the existing `生成` button for users who want review only.

- [ ] **Step 3: Wire action in `LeadsPage`**

Import `autoReplyLead` and add:

```tsx
onAutoReply={async () => {
  if (!activeLead) return
  await autoReplyLead(activeLead.id, { regenerate: false })
  message.success(labels.ui.autoReplyQueued)
  await refreshDetail()
}}
```

- [ ] **Step 4: Add batch toolbar action**

In `LeadToolbar`, add a button:

```tsx
<Button
  style={softBluePillButtonStyle}
  icon={<ThunderboltOutlined />}
  loading={autoReplying}
  onClick={onBatchAutoReply}
>
  {labels.ui.batchAutoReply}
</Button>
```

In `LeadsPage`, call:

```tsx
const result = await batchAutoReplyLeads({
  ...buildFilterParams(),
  onlyPending: true,
  limit: 20,
})
message.success(t('leads.autoReply.batchQueued', {
  matched: result.matched,
  queued: result.queued,
  blocked: result.blocked,
  failed: result.failed,
}))
await fetchLeads(1, pageSize)
```

- [ ] **Step 5: Add i18n keys**

Chinese:

```json
"leads.actions.generateAndReply": "生成并回复",
"leads.actions.batchAutoReply": "批量自动回复",
"leads.autoReply.queued": "已创建自动回复任务",
"leads.autoReply.batchQueued": "已匹配 {{matched}} 条，入队 {{queued}} 条，拦截 {{blocked}} 条，失败 {{failed}} 条",
"leads.replyTask.status.pending": "待创建",
"leads.replyTask.status.queued": "排队中",
"leads.replyTask.status.running": "回复中",
"leads.replyTask.status.success": "已回复",
"leads.replyTask.status.failed": "失败",
"leads.replyTask.status.blocked": "已拦截",
"leads.replyTask.status.human_required": "需人工处理",
"leads.replyTask.status.cancelled": "已取消"
```

English:

```json
"leads.actions.generateAndReply": "Generate & Reply",
"leads.actions.batchAutoReply": "Batch Auto Reply",
"leads.autoReply.queued": "Auto-reply task created",
"leads.autoReply.batchQueued": "Matched {{matched}}, queued {{queued}}, blocked {{blocked}}, failed {{failed}}",
"leads.replyTask.status.pending": "Pending",
"leads.replyTask.status.queued": "Queued",
"leads.replyTask.status.running": "Replying",
"leads.replyTask.status.success": "Replied",
"leads.replyTask.status.failed": "Failed",
"leads.replyTask.status.blocked": "Blocked",
"leads.replyTask.status.human_required": "Human Required",
"leads.replyTask.status.cancelled": "Cancelled"
```

### Task 11: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run extension helper tests**

Run:

```bash
node --test project/aitoearn-extension/xhs-bridge/tests/reply-payload.test.mjs
```

Expected: all helper tests pass.

- [ ] **Step 2: Run backend unit tests**

Run:

```bash
cd project/aitoearn-backend
  pnpm exec vitest run \
    apps/aitoearn-server/src/core/acquisition/leads/reply-automation.service.spec.ts \
    apps/aitoearn-server/src/core/acquisition/leads/reply-task-executor.service.spec.ts \
    apps/aitoearn-server/src/core/acquisition/leads/reply-task-screenshot.service.spec.ts \
    apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge-hub.spec.ts
```

Expected: all tests pass.

- [ ] **Step 3: Run backend build**

Run:

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build passes.

- [ ] **Step 4: Run frontend checks**

Run:

```bash
cd project/aitoearn-web
pnpm run type-check
pnpm build
```

Expected: both pass.

- [ ] **Step 5: Restart local stack**

Run from repo root:

```bash
./scripts/local-stop.sh
rm -rf project/aitoearn-web/.next
./scripts/local-start.sh --skip-build
```

Expected:

```text
aitoearn-server is listening on port 3002
aitoearn-ai is listening on port 3010
local API proxy is listening on port 7001
frontend is listening on port 6061
```

- [ ] **Step 6: Manual end-to-end smoke test**

1. Load `project/aitoearn-extension/xhs-bridge` in Chrome.
2. Confirm extension popup shows bridge connected.
3. Open `http://127.0.0.1:6061/zh-CN/leads`.
4. Filter to one Xiaohongshu post with one pending lead.
5. Open lead detail.
6. Click `生成并回复`.
7. Watch Xiaohongshu tab become active.
8. Confirm one reply appears under the target comment.
9. Return to AitoBee.
10. Confirm lead timeline includes:
    - `reply_task_created`
    - `reply_task_queued`
    - `reply_task_running`
	    - `reply_executed`
	11. Confirm lead stage becomes `replied` and status becomes `in_progress`.
12. Force one failure case, such as logged-out Xiaohongshu or a blocked request, and confirm `lead_reply_task.screenshotUrl` is an OBS/CDN URL while no base64 data URL is stored in MongoDB.

## Rollout Controls

Initial defaults:

```ts
const AUTO_REPLY_DEFAULT_LIMIT = 20
const AUTO_REPLY_MAX_LIMIT = 100
const MIN_REPLY_INTERVAL_MS = 15000
const BULLMQ_MAX_ATTEMPTS = 2
```

Retry timing:

- Normal per-account spacing is controlled by `MIN_REPLY_INTERVAL_MS`.
- Failed BullMQ jobs retry after `backoff.delay = 30000`.
- In failure + retry scenarios, the effective interval between platform write attempts is `max(MIN_REPLY_INTERVAL_MS, BullMQ backoff delay)`. Preserve this behavior when replacing the process-local limiter with Redis.

Enablement:

1. Keep feature visible only on local/dev until one real account smoke test passes.
2. Require an explicit operator click for every batch.
3. Keep `dryRun` available from API for safe preflight.
4. Do not run scheduled unattended auto-reply jobs in this phase.
5. Do not enable batch auto-reply in production until the process-local limiter is replaced with a Redis-backed limiter.
6. Do not enable batch auto-reply until the Xiaohongshu execution path proves signed requests work or a DOM automation fallback is implemented and smoke-tested.
7. Keep screenshot capture policy at `failure` by default. Do not switch to `always` until OBS upload cost and task volume are reviewed.

## Failure Handling Matrix

| Condition | Task status | Operator message |
|---|---|---|
| XHS Bridge disconnected | `failed` | 浏览器插件未连接，请启动插件后重试。 |
| Lead platform is not XHS | `human_required` in batch, `ResponseCode.PlatformNotSupported` in single | 当前平台暂不支持插件自动回复。 |
| Suggestion blocked by safety | `blocked` | 回复内容命中安全规则，需人工编辑。 |
| Missing `postId`, `postUrl`, or `commentId` | `human_required` | 线索缺少平台评论定位信息。 |
| XHS signed request path is unavailable | `human_required` | 当前小红书页面请求签名不可用，需要人工处理或切换 DOM 自动化。 |
| XHS API returns non-success | `human_required` | 平台拒绝发布，可能需要登录、验证或权限处理。 |
| Screenshot upload fails | Preserve platform-derived status, add `lastError` | 回复状态不因截图上传失败而回滚，截图稍后可重试采集。 |
| Worker throws unexpected error | `failed` | 自动回复失败，可查看任务错误后重试。 |
| Operator cancels before running | `cancelled` | 已取消。 |

## Self-Review Checklist

- The plan uses the existing browser plugin path and does not move platform cookies into the backend.
- The first executable platform is Xiaohongshu, matching the current `xhs-bridge` host permission and WebSocket bridge.
- Backend owns task state and auditability.
- Extension owns only the platform write action.
- Existing `reply-suggestion` and `reply-result` concepts are reused instead of duplicated.
- Tests cover helper validation, backend safety gates, and execution state transitions.
- Verification includes local stack restart because `pnpm build` can invalidate the dev `.next` cache.
- `LeadStatsQuerySchema` already exists in `acquisition-leads.dto.ts`; if it changes before implementation, re-check the batch DTO inheritance before coding.
- `lead_reply_task.executorKind` and `reply_comment_record.executionMode` are intentionally different fields. Do not write `browser_plugin` into `reply_comment_record.executionMode`; that schema currently accepts only `manual` and `platform_adapter`.
- `AcquisitionPlatform` currently matches the task schema enum (`xhs`, `douyin`, `kwai`). If a new platform is added, update both the frontend type and backend task schema together.
- Screenshot base64 is transient between extension and backend only. OBS persistence goes through `AssetsService.uploadFromBuffer()`, and MongoDB stores only `screenshotUrl`.
