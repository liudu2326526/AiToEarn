# Acquisition Phase 1 Collection Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core acquisition collection pipeline so XHS and Douyin work links can be fetched, normalized, persisted to `post_snapshot` and `comment_snapshot`, and surfaced with account-level comment capability status.

**Architecture:** Add an `acquisition` NestJS module that owns provider orchestration, snapshot persistence, queue consumers, and status APIs. XHS uses the existing local XHS Bridge plus Chrome extension, upgraded with backend-callable bridge commands. Douyin uses official Open Platform comment APIs through `DouyinApiService`; when `item.comment` is unavailable, the system records a permission status instead of pretending comments can be fetched. Frontend Phase 1 only adds status cards and trigger/read UI over the Phase 0 route shell.

**Tech Stack:** NestJS, Mongoose repositories from `@yikart/channel-db`, BullMQ, Redlock, Zod DTOs, Next.js App Router, Zustand/light client state, XHS Bridge WebSocket, pnpm/Nx/Vitest

---

## Preconditions

- Phase 0 plan is implemented.
- These Phase 0 schemas and repositories exist and are exported:
  - `PostSnapshotRepository`
  - `CommentSnapshotRepository`
  - `AccountOpsConfigRepository`
- These Phase 0 queues exist in `QueueName` and `QueueService`:
  - `AcquisitionCommentFetch`
  - `AcquisitionPostBackfill`
- `SensitiveWordModule` exists but is not used directly in Phase 1.
- XHS Chrome extension path remains `project/aitoearn-extension/xhs-bridge`.

---

## File Structure

### Backend Acquisition Module (`project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/`)

| File | Responsibility |
|---|---|
| `acquisition.module.ts` | Register acquisition controller, services, providers, and consumers. |
| `acquisition.controller.ts` | Public authenticated endpoints for manual fetch, status, and snapshot reads. |
| `acquisition.dto.ts` | Zod DTOs for fetch requests, status requests, and snapshot list queries. |
| `acquisition.constants.ts` | Platform, data-source, capability-status, and failure-reason constants. |
| `acquisition.types.ts` | Internal normalized post/comment/provider contracts. |
| `acquisition.service.ts` | Orchestrate provider selection, job enqueueing, and immediate fetch APIs. |
| `snapshot-persistence.service.ts` | Upsert post snapshots and comment snapshots with normalized metrics. |
| `comment-capability.service.ts` | Compute and persist account comment capability status. |
| `providers/acquisition-provider.interface.ts` | Common provider contract. |
| `providers/xhs/xhs-bridge-acquisition.provider.ts` | Fetch XHS post/comment data through backend XHS Bridge commands. |
| `providers/xhs/xhs-extractors.ts` | Browser-side JS extraction strings used by the bridge. |
| `providers/douyin/douyin-acquisition.provider.ts` | Fetch Douyin post/comment data through official Open Platform APIs. |
| `workers/acquisition-comment-fetch.consumer.ts` | Process `acquisition_comment_fetch` jobs with account-level locking. |
| `workers/acquisition-post-backfill.consumer.ts` | Process `acquisition_post_backfill` jobs after publishing completes. |
| `*.spec.ts` | Focused unit tests for status, persistence, bridge orchestration, and provider normalization. |

### Existing Backend Files

| File | Responsibility |
|---|---|
| `apps/aitoearn-server/src/app.module.ts` | Import `AcquisitionModule`. |
| `apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge.module.ts` | Export `XhsBridgeService` so acquisition providers can inject it. |
| `apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge-hub.ts` | Add backend-callable direct extension command API. |
| `apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge.service.ts` | Expose bridge status and command methods to backend services. |
| `apps/aitoearn-server/src/core/channel/libs/douyin/douyin-api.service.ts` | Add official Douyin comment list and reply-list API wrappers. |
| `apps/aitoearn-server/src/core/channel/libs/douyin/common.ts` | Add Douyin comment response interfaces. |
| `apps/aitoearn-server/src/core/channel/platforms/douyin/douyin.module.ts` | Use existing export of `DouyinService`; import this module from `AcquisitionModule`. |
| `apps/aitoearn-server/src/core/channel/publishing/providers/base.service.ts` | Enqueue acquisition post backfill after publish completion. |
| `libs/channel-db/src/schemas/account-ops-config.schema.ts` | Add comment capability status fields. |
| `libs/channel-db/src/repositories/account-ops-config.repository.ts` | Add `upsertByAccountId()` and `updateCommentCapability()` helpers. |
| `libs/channel-db/src/repositories/post-snapshot.repository.ts` | Add append-only `createSnapshot()` and list helpers. |
| `libs/channel-db/src/repositories/comment-snapshot.repository.ts` | Add `bulkUpsertByCommentId()` and list helpers. |

### Frontend Files

| File | Responsibility |
|---|---|
| `project/aitoearn-web/src/api/acquisition.ts` | Client API wrappers for status and manual fetch. |
| `project/aitoearn-web/src/app/[lng]/acquisition/acquisitionPageCore.tsx` | Add status cards and manual work-link fetch panel to Phase 0 shell. |
| `project/aitoearn-web/src/app/[lng]/acquisition/components/CommentCapabilityCards/index.tsx` | Platform/account capability summary cards. |
| `project/aitoearn-web/src/app/[lng]/acquisition/components/WorkFetchPanel/index.tsx` | Work link input, fetch action, and fetch result summary. |

---

## Design Decisions

1. **XHS source of truth:** XHS collection is plugin/Bridge based. Do not describe it as official OpenAPI.
2. **Douyin source of truth:** Douyin collection uses official Open Platform APIs. A missing `item.comment` permission produces `permission_required`, not a fake success.
3. **Kwai:** Kwai comment fetching is not implemented in Phase 1. Its status is returned as `pending_confirmation`.
4. **Persistence:** Post snapshots are append-only history entries. Each fetch creates a new `post_snapshot` record with `fetchedAt` and `fetchDate`. Comment snapshots are bulk-upserted by `{ platform, accountId, postId, commentId, parentCommentId }`.
5. **Queue locking:** Consumers use a short Redis/Redlock key per `platform:accountId` so one account is not scraped concurrently.
6. **Publishing hook:** Every successful publish completion with `workLink` and `dataId` enqueues `AcquisitionPostBackfill`; the backfill consumer decides whether the platform is supported.

---

## Implementation Tasks

### Task 1: Extend Phase 0 Repositories for Snapshot Persistence and Status

**Files:**
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/account-ops-config.schema.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/account-ops-config.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/post-snapshot.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/comment-snapshot.repository.ts`

If Phase 0 was implemented before this review correction, also add `fetchDate` to `PostSnapshot` and `xsecToken` to `CommentSnapshot` as described in the Phase 0 plan. `fetchDate` is the UTC `YYYY-MM-DD` bucket derived from `fetchedAt`; `xsecToken` stores the XHS comment token when available.

- [ ] **Step 1: Add comment capability fields to `AccountOpsConfig`**

Add this enum and fields to `account-ops-config.schema.ts`:

```ts
export enum CommentFetchCapabilityStatus {
  NotConfigured = 'not_configured',
  PendingAuthorization = 'pending_authorization',
  PermissionRequired = 'permission_required',
  Ready = 'ready',
  Failed = 'failed',
  ManualRequired = 'manual_required',
  PendingConfirmation = 'pending_confirmation',
}

// inside AccountOpsConfig
@Prop({
  required: true,
  enum: CommentFetchCapabilityStatus,
  default: CommentFetchCapabilityStatus.NotConfigured,
  index: true,
})
commentFetchStatus: CommentFetchCapabilityStatus

@Prop({ type: String, default: '' })
commentFetchStatusReason: string

@Prop({ type: Date, default: null })
commentFetchCheckedAt?: Date

@Prop({ type: Object, default: {} })
commentFetchMeta: Record<string, unknown>
```

- [ ] **Step 2: Add `AccountOpsConfigRepository` helpers**

Add these methods:

```ts
import { CommentFetchCapabilityStatus } from '../schemas'

async upsertByAccountId(accountId: string, data: Partial<AccountOpsConfig>) {
  return await this.updateOne(
    { accountId },
    {
      $set: data,
      $setOnInsert: { accountId },
    },
    { upsert: true },
  )
}

async updateCommentCapability(
  accountId: string,
  status: CommentFetchCapabilityStatus,
  reason = '',
  meta: Record<string, unknown> = {},
) {
  return await this.upsertByAccountId(accountId, {
    commentFetchStatus: status,
    commentFetchStatusReason: reason,
    commentFetchCheckedAt: new Date(),
    commentFetchMeta: meta,
  })
}
```

- [ ] **Step 3: Add `PostSnapshotRepository.createSnapshot()`**

```ts
async createSnapshot(data: Partial<PostSnapshot> & {
  platform: string
  accountId: string
  postId: string
  fetchedAt: Date
  fetchDate: string
}) {
  return await this.create(data)
}

async listByPost(accountId: string, platform: string, postId: string, limit = 20) {
  return await this.find(
    { accountId, platform, postId },
    { sort: { fetchedAt: -1 }, limit },
  )
}
```

- [ ] **Step 4: Add `CommentSnapshotRepository.bulkUpsertByCommentId()`**

```ts
async bulkUpsertByCommentId(items: Array<Partial<CommentSnapshot> & {
  platform: string
  accountId: string
  postId: string
  commentId: string
}>) {
  if (items.length === 0) {
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 }
  }

  const ops = items.map(item => ({
    updateOne: {
      filter: {
        platform: item.platform,
        accountId: item.accountId,
        postId: item.postId,
        commentId: item.commentId,
        parentCommentId: item.parentCommentId || '',
      },
      update: { $set: item },
      upsert: true,
    },
  }))

  return await this.model.bulkWrite(ops)
}

async listByPost(accountId: string, platform: string, postId: string, limit = 100) {
  return await this.find(
    { accountId, platform, postId },
    { sort: { likeCount: -1, commentedAt: -1 }, limit },
  )
}
```

- [ ] **Step 5: Verify backend build**

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build passes.

---

### Task 2: Add Backend-Callable XHS Bridge Commands

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge-hub.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge.service.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge-hub.spec.ts`

- [ ] **Step 1: Extend hub types and direct request storage**

Add:

```ts
interface DirectRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}
```

Add field:

```ts
private readonly directRequests = new Map<string, DirectRequest>()
```

- [ ] **Step 2: Add status and direct command methods**

Add public methods:

```ts
getStatus() {
  return {
    extensionConnected: this.isExtensionConnected(),
  }
}

async callExtension<T = unknown>(
  method: string,
  params?: Record<string, unknown>,
  timeoutMs = this.requestTimeoutMs,
): Promise<T> {
  if (!this.extensionSocket || !this.isOpen(this.extensionSocket)) {
    throw new Error('AitoBee XHS Chrome 扩展未连接')
  }

  const id = `server-${method}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      this.directRequests.delete(id)
      reject(new Error(`XHS Bridge 命令超时：${method}`))
    }, timeoutMs)

    this.directRequests.set(id, {
      resolve: value => resolve(value as T),
      reject,
      timer,
    })

    this.send(this.extensionSocket!, {
      id,
      method,
      ...(params ? { params } : {}),
    })
  })
}
```

- [ ] **Step 3: Resolve direct requests in `handleExtensionMessage()`**

Before checking `pendingRequests`, add:

```ts
const direct = this.directRequests.get(message.id)
if (direct) {
  clearTimeout(direct.timer)
  this.directRequests.delete(message.id)
  if (message.error) {
    direct.reject(new Error(message.error))
  }
  else {
    direct.resolve(message.result)
  }
  return
}
```

- [ ] **Step 4: Expose methods from `XhsBridgeService`**

Add:

```ts
getStatus() {
  return this.hub.getStatus()
}

async callExtension<T = unknown>(method: string, params?: Record<string, unknown>, timeoutMs?: number) {
  return await this.hub.callExtension<T>(method, params, timeoutMs)
}
```

- [ ] **Step 5: Export `XhsBridgeService` from `XhsBridgeModule`**

Current module registration only provides the service locally. Add `exports` so `AcquisitionModule` can inject it through `XhsBridgeModule`:

```ts
@Module({
  providers: [XhsBridgeService],
  exports: [XhsBridgeService],
})
export class XhsBridgeModule {}
```

The extension-side bridge already supports `navigate`, `wait_for_load`, `wait_dom_stable`, and `evaluate` commands in `project/aitoearn-extension/xhs-bridge/background.js`; no new extension command is required for Phase 1.

- [ ] **Step 6: Add hub tests**

Add tests that connect a fake extension socket, call `hub.callExtension('evaluate', { expression: '1+1' })`, assert the extension receives a command, then simulate extension response and assert the promise resolves with `2`.

```ts
it('allows backend services to call the connected extension directly', async () => {
  const hub = new XhsBridgeHub({ requestTimeoutMs: 1000 })
  const extension = createSocket()
  hub.connectExtension(extension)

  const promise = hub.callExtension('evaluate', { expression: '1 + 1' })
  const sent = JSON.parse(extension.sent[0])
  expect(sent.method).toBe('evaluate')
  expect(sent.params).toEqual({ expression: '1 + 1' })

  hub.handleExtensionMessage(extension, JSON.stringify({ id: sent.id, result: 2 }))
  await expect(promise).resolves.toBe(2)
})
```

- [ ] **Step 7: Verify bridge tests**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge-hub.spec.ts
```

Expected: all XHS bridge hub tests pass.

---

### Task 3: Add Acquisition Module Contracts

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.constants.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.types.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.dto.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/app.module.ts`

- [ ] **Step 1: Add constants**

```ts
export enum AcquisitionPlatform {
  Xhs = 'xhs',
  Douyin = 'douyin',
  Kwai = 'kwai',
}

export enum AcquisitionDataSource {
  XhsPluginApi = 'xhs_plugin_api',
  XhsBridgeCapture = 'xhs_bridge_capture',
  DouyinOpenApi = 'douyin_open_api',
  ManualSnapshot = 'manual_snapshot',
  DemoSeed = 'demo_seed',
}

export enum AcquisitionCapabilityStatus {
  NotConfigured = 'not_configured',
  PendingAuthorization = 'pending_authorization',
  PermissionRequired = 'permission_required',
  Ready = 'ready',
  Failed = 'failed',
  ManualRequired = 'manual_required',
  PendingConfirmation = 'pending_confirmation',
}

export const ACQUISITION_PROVIDERS = Symbol('ACQUISITION_PROVIDERS')
```

- [ ] **Step 2: Add provider types**

```ts
import { AcquisitionCapabilityStatus, AcquisitionDataSource, AcquisitionPlatform } from './acquisition.constants'

export interface NormalizedPostSnapshot {
  platform: AcquisitionPlatform
  accountId: string
  postId: string
  postUrl: string
  title: string
  cover: string
  metrics: {
    raw: Record<string, unknown>
    normalized: Record<string, number>
  }
  fetchedAt: Date
  fetchDate: string
  dataSource: AcquisitionDataSource
}

export interface NormalizedCommentSnapshot {
  platform: AcquisitionPlatform
  accountId: string
  postId: string
  commentId: string
  parentCommentId: string
  xsecToken?: string
  userName: string
  userAvatar: string
  content: string
  likeCount: number
  ipLocation: string
  commentedAt?: Date
  fetchBatch: string
  dataSource: AcquisitionDataSource
}

export interface AcquisitionFetchRequest {
  userId: string
  accountId: string
  platform: AcquisitionPlatform
  postUrl: string
  postId?: string
  cursor?: string
  fetchBatch: string
}

export interface AcquisitionFetchResult {
  post?: NormalizedPostSnapshot
  comments: NormalizedCommentSnapshot[]
  cursor: string
  hasMore: boolean
  capabilityStatus: AcquisitionCapabilityStatus
  capabilityReason: string
}
```

- [ ] **Step 3: Add DTOs**

```ts
import { createZodDto } from '@yikart/common'
import { z } from 'zod'

export const acquisitionPlatformSchema = z
  .enum(['xhs', 'douyin', 'kwai'])
  .describe('采集平台')

export const fetchWorkSchema = z.object({
  accountId: z.string().min(1).describe('平台账号 ID'),
  platform: acquisitionPlatformSchema,
  postUrl: z.string().url().describe('作品链接'),
  postId: z.string().optional().describe('平台作品 ID，无法从链接稳定解析时由前端或发布回填传入'),
  cursor: z.string().optional().describe('评论分页游标'),
})

export const enqueueCommentFetchSchema = fetchWorkSchema.extend({
  fetchBatch: z.string().optional().describe('采集批次 ID，不传则后端生成'),
})

export const capabilityStatusQuerySchema = z.object({
  accountId: z.string().optional().describe('平台账号 ID'),
  platform: acquisitionPlatformSchema.optional().describe('采集平台'),
})

export class FetchWorkDto extends createZodDto(fetchWorkSchema) {}
export class EnqueueCommentFetchDto extends createZodDto(enqueueCommentFetchSchema) {}
export class CapabilityStatusQueryDto extends createZodDto(capabilityStatusQuerySchema) {}
```

- [ ] **Step 4: Add empty module registration**

```ts
import { Module } from '@nestjs/common'
import { DouyinApiModule } from '../channel/libs/douyin/douyin-api.module'
import { DouyinModule } from '../channel/platforms/douyin/douyin.module'
import { XhsBridgeModule } from '../xhs-bridge/xhs-bridge.module'

@Module({
  imports: [XhsBridgeModule, DouyinModule, DouyinApiModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class AcquisitionModule {}
```

Import `AcquisitionModule` in `app.module.ts` and add it to the root `imports`.

- [ ] **Step 5: Verify backend build**

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build passes.

---

### Task 4: Add Snapshot Persistence Service

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/snapshot-persistence.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/snapshot-persistence.service.spec.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts`

- [ ] **Step 1: Write unit tests**

Create tests with mocked repositories:

```ts
import { AcquisitionCapabilityStatus, AcquisitionDataSource, AcquisitionPlatform } from './acquisition.constants'
import { SnapshotPersistenceService } from './snapshot-persistence.service'

describe('SnapshotPersistenceService', () => {
  const postSnapshotRepository = { createSnapshot: vi.fn() }
  const commentSnapshotRepository = { bulkUpsertByCommentId: vi.fn() }
  const service = new SnapshotPersistenceService(
    postSnapshotRepository as any,
    commentSnapshotRepository as any,
  )

  beforeEach(() => vi.clearAllMocks())

  it('persists post and comments using repository upserts', async () => {
    const fetchedAt = new Date('2026-05-28T00:00:00.000Z')
    await service.persistFetchResult({
      post: {
        platform: AcquisitionPlatform.Xhs,
        accountId: 'account-1',
        postId: 'post-1',
        postUrl: 'https://www.xiaohongshu.com/explore/post-1',
        title: 'title',
        cover: 'cover.jpg',
        metrics: { raw: { likedCount: '12' }, normalized: { likeCount: 12 } },
        fetchedAt,
        fetchDate: '2026-05-28',
        dataSource: AcquisitionDataSource.XhsBridgeCapture,
      },
      comments: [{
        platform: AcquisitionPlatform.Xhs,
        accountId: 'account-1',
        postId: 'post-1',
        commentId: 'comment-1',
        parentCommentId: '',
        xsecToken: 'token-1',
        userName: 'user',
        userAvatar: '',
        content: '想看尺码',
        likeCount: 3,
        ipLocation: '上海',
        commentedAt: fetchedAt,
        fetchBatch: 'batch-1',
        dataSource: AcquisitionDataSource.XhsBridgeCapture,
      }],
      cursor: '',
      hasMore: false,
      capabilityStatus: AcquisitionCapabilityStatus.Ready,
      capabilityReason: '',
    })

    expect(postSnapshotRepository.createSnapshot).toHaveBeenCalledTimes(1)
    expect(commentSnapshotRepository.bulkUpsertByCommentId).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ commentId: 'comment-1', content: '想看尺码' }),
    ]))
  })
})
```

- [ ] **Step 2: Implement service**

```ts
import { Injectable } from '@nestjs/common'
import { CommentSnapshotRepository, PostSnapshotRepository } from '@yikart/channel-db'
import { AcquisitionFetchResult } from './acquisition.types'

@Injectable()
export class SnapshotPersistenceService {
  constructor(
    private readonly postSnapshotRepository: PostSnapshotRepository,
    private readonly commentSnapshotRepository: CommentSnapshotRepository,
  ) {}

  async persistFetchResult(result: AcquisitionFetchResult) {
    const post = result.post
    if (post) {
      await this.postSnapshotRepository.createSnapshot(post)
    }

    if (result.comments.length > 0) {
      await this.commentSnapshotRepository.bulkUpsertByCommentId(result.comments)
    }

    return {
      postSaved: !!post,
      commentsSaved: result.comments.length,
    }
  }
}
```

- [ ] **Step 3: Register service in module**

Add `SnapshotPersistenceService` to `providers` and `exports`.

- [ ] **Step 4: Verify tests**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/snapshot-persistence.service.spec.ts
```

Expected: test passes.

---

### Task 5: Implement XHS Acquisition Provider

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/providers/acquisition-provider.interface.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/providers/xhs/xhs-extractors.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/providers/xhs/xhs-bridge-acquisition.provider.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/providers/xhs/xhs-bridge-acquisition.provider.spec.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts`

- [ ] **Step 1: Add provider interface**

```ts
import { AcquisitionCapabilityStatus } from '../acquisition.constants'
import { AcquisitionFetchRequest, AcquisitionFetchResult } from '../acquisition.types'

export interface AcquisitionProvider {
  fetchWorkAndComments(request: AcquisitionFetchRequest): Promise<AcquisitionFetchResult>
  getCapabilityStatus(accountId: string): Promise<{
    status: AcquisitionCapabilityStatus
    reason: string
    meta?: Record<string, unknown>
  }>
}
```

- [ ] **Step 2: Add extractor scripts**

Create `xhs-extractors.ts` with browser-evaluated scripts:

```ts
export function buildXhsNoteUrl(postId: string, postUrl: string): string {
  const url = new URL(postUrl)
  return url.toString()
}

export const XHS_EXPAND_COMMENTS_SCRIPT = `
(() => {
  const texts = ['查看更多回复', '展开更多回复', '更多回复'];
  const buttons = Array.from(document.querySelectorAll('button, span, div'));
  let clicked = 0;
  for (const el of buttons) {
    const text = (el.textContent || '').trim();
    if (texts.some(item => text.includes(item))) {
      el.click();
      clicked += 1;
    }
  }
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
  return { clicked };
})()
`

export const XHS_EXTRACT_DETAIL_SCRIPT = `
(() => {
  const state = window.__INITIAL_STATE__;
  if (!state?.note?.noteDetailMap) return null;
  return JSON.stringify(state.note.noteDetailMap);
})()
`
```

- [ ] **Step 3: Implement provider**

```ts
import { Injectable } from '@nestjs/common'
import { XhsBridgeService } from '../../../xhs-bridge/xhs-bridge.service'
import { AcquisitionCapabilityStatus, AcquisitionDataSource, AcquisitionPlatform } from '../../acquisition.constants'
import { AcquisitionFetchRequest, AcquisitionFetchResult, NormalizedCommentSnapshot } from '../../acquisition.types'
import { AcquisitionProvider } from '../acquisition-provider.interface'
import { XHS_EXPAND_COMMENTS_SCRIPT, XHS_EXTRACT_DETAIL_SCRIPT } from './xhs-extractors'

@Injectable()
export class XhsBridgeAcquisitionProvider implements AcquisitionProvider {
  constructor(private readonly xhsBridgeService: XhsBridgeService) {}

  async getCapabilityStatus(_accountId: string) {
    const status = this.xhsBridgeService.getStatus()
    return status.extensionConnected
      ? { status: AcquisitionCapabilityStatus.Ready, reason: '' }
      : { status: AcquisitionCapabilityStatus.NotConfigured, reason: 'XHS Bridge extension is not connected' }
  }

  async fetchWorkAndComments(request: AcquisitionFetchRequest): Promise<AcquisitionFetchResult> {
    const capability = await this.getCapabilityStatus(request.accountId)
    if (capability.status !== AcquisitionCapabilityStatus.Ready) {
      return { comments: [], cursor: request.cursor || '', hasMore: false, capabilityStatus: capability.status, capabilityReason: capability.reason }
    }

    await this.xhsBridgeService.callExtension('navigate', { url: request.postUrl })
    await this.xhsBridgeService.callExtension('wait_for_load', { timeout: 60000 }, 70000)
    await this.xhsBridgeService.callExtension('evaluate', { expression: XHS_EXPAND_COMMENTS_SCRIPT }, 30000)
    const raw = await this.xhsBridgeService.callExtension<string | null>('evaluate', { expression: XHS_EXTRACT_DETAIL_SCRIPT }, 30000)
    if (!raw) {
      return { comments: [], cursor: '', hasMore: false, capabilityStatus: AcquisitionCapabilityStatus.Failed, capabilityReason: 'XHS page did not expose note detail data' }
    }

    try {
      return this.normalizeCapturedState(request, raw)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { comments: [], cursor: '', hasMore: false, capabilityStatus: AcquisitionCapabilityStatus.Failed, capabilityReason: `XHS page data parse failed: ${message}` }
    }
  }

  private normalizeCapturedState(request: AcquisitionFetchRequest, raw: string): AcquisitionFetchResult {
    const parsed = JSON.parse(raw) as Record<string, any>
    const first = Object.values(parsed)[0] as any
    const note = first?.note || {}
    const postId = note.noteId || note.note_id || request.postId || ''
    const comments = this.normalizeComments(request, first?.comments, postId)
    const interactInfo = note.interactInfo || note.interact_info || {}
    const fetchedAt = new Date()

    return {
      post: {
        platform: AcquisitionPlatform.Xhs,
        accountId: request.accountId,
        postId,
        postUrl: request.postUrl,
        title: note.title || '',
        cover: note.imageList?.[0]?.url || note.image_list?.[0]?.url || '',
        metrics: {
          raw: interactInfo,
          normalized: {
            likeCount: Number(interactInfo.likedCount || 0),
            collectCount: Number(interactInfo.collectedCount || 0),
            commentCount: Number(interactInfo.commentCount || comments.length),
            shareCount: Number(interactInfo.sharedCount || 0),
          },
        },
        fetchedAt,
        fetchDate: fetchedAt.toISOString().slice(0, 10),
        dataSource: AcquisitionDataSource.XhsBridgeCapture,
      },
      comments,
      cursor: first?.comments?.cursor || '',
      hasMore: Boolean(first?.comments?.hasMore || first?.comments?.has_more),
      capabilityStatus: AcquisitionCapabilityStatus.Ready,
      capabilityReason: '',
    }
  }

  private normalizeComments(request: AcquisitionFetchRequest, payload: any, postId: string): NormalizedCommentSnapshot[] {
    const list = Array.isArray(payload) ? payload : payload?.list || []
    const xsecToken = this.extractXsecToken(request.postUrl)
    return list.map((comment: any) => ({
      platform: AcquisitionPlatform.Xhs,
      accountId: request.accountId,
      postId,
      commentId: comment.id || '',
      parentCommentId: '',
      xsecToken,
      userName: comment.user?.nickname || comment.userInfo?.nickname || comment.user_info?.nickname || '',
      userAvatar: comment.user?.avatar || comment.userInfo?.image || comment.user_info?.image || '',
      content: comment.content || '',
      likeCount: Number(comment.likeCount || comment.like_count || 0),
      ipLocation: comment.ipLocation || comment.ip_location || '',
      commentedAt: comment.createTime || comment.create_time ? new Date(comment.createTime || comment.create_time) : undefined,
      fetchBatch: request.fetchBatch,
      dataSource: AcquisitionDataSource.XhsBridgeCapture,
    }))
  }

  private extractXsecToken(postUrl: string): string {
    try {
      return new URL(postUrl).searchParams.get('xsec_token') || ''
    }
    catch {
      return ''
    }
  }
}
```

- [ ] **Step 4: Add provider tests**

Mock `XhsBridgeService` with `getStatus()` returning connected and `callExtension()` returning a serialized note state. Assert normalized result has one post and one comment.

- [ ] **Step 5: Register provider**

Add `XhsBridgeAcquisitionProvider` to `providers`.

- [ ] **Step 6: Verify tests**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/providers/xhs/xhs-bridge-acquisition.provider.spec.ts
```

Expected: tests pass.

---

### Task 5A: Complete XHS Real Comment DOM Capture (Phase 1 Remaining)

**Why this task exists:**

The current Phase 1 implementation can connect to the XHS Bridge, open an XHS note page, and persist the post snapshot, but it can still return `ready / postSaved=true / commentsSaved=0` even when the page visibly contains comments. The observed live page had `.comment-item` nodes and text such as `共 591 条评论`, while the current extractor initializes `comments: []` and only extracts note metadata. This is a Phase 1 collection gap, not a Phase 2/3 task.

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/providers/xhs/xhs-extractors.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/providers/xhs/xhs-bridge-acquisition.provider.ts`
- Create or update: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/providers/xhs/xhs-bridge-acquisition.provider.spec.ts`
- Optional if extension command compatibility changes: `project/aitoearn-extension/xhs-bridge/background.js`

- [ ] **Step 1: Add a failing provider test for DOM-captured comments**

Create or extend `xhs-bridge-acquisition.provider.spec.ts` with a test where the Bridge returns the same shape that the DOM extractor must produce:

```ts
import { describe, expect, it, vi } from 'vitest'
import { AcquisitionCapabilityStatus, AcquisitionDataSource } from '../../acquisition.constants'
import { XhsBridgeAcquisitionProvider } from './xhs-bridge-acquisition.provider'

describe('XhsBridgeAcquisitionProvider real comment capture', () => {
  it('normalizes comments captured from XHS DOM comment items', async () => {
    const xhsBridgeService = {
      getStatus: vi.fn(() => ({ extensionConnected: true })),
      callExtension: vi.fn()
        .mockResolvedValueOnce({ tabId: 1 })
        .mockResolvedValueOnce({ loaded: true })
        .mockResolvedValueOnce({ stable: true })
        .mockResolvedValueOnce(JSON.stringify({
          location: 'https://www.xiaohongshu.com/explore/note-1?xsec_token=token-1',
          note: {
            title: '德比斯你收敛一点，你看看第二名多矜持！！',
            cover: 'https://example.com/cover.jpg',
            commentCount: 591,
          },
          comments: [
            {
              id: 'dom:note-1:0',
              userName: '王子',
              userAvatar: '',
              content: '事实就是张雪现在的车队叫埃文兄弟车队',
              likeCount: 420,
              ipLocation: '江西',
              commentedAtText: '05-19',
              xsecToken: 'token-1',
              parentCommentId: '',
            },
            {
              id: 'dom:note-1:1',
              userName: '赵金贵',
              userAvatar: '',
              content: '49年入国军',
              likeCount: 321,
              ipLocation: '北京',
              commentedAtText: '05-19',
              xsecToken: 'token-1',
              parentCommentId: 'dom:note-1:0',
            },
          ],
          hasMore: true,
        })),
    }

    const provider = new XhsBridgeAcquisitionProvider(xhsBridgeService as any)
    const result = await provider.fetchWorkAndComments({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: '',
      postUrl: 'https://www.xiaohongshu.com/explore/note-1?xsec_token=token-1',
      fetchBatch: 'batch-1',
    } as any)

    expect(result.capabilityStatus).toBe(AcquisitionCapabilityStatus.Ready)
    expect(result.post?.title).toContain('德比斯')
    expect(result.post?.metrics.normalized.commentCount).toBe(591)
    expect(result.comments).toHaveLength(2)
    expect(result.comments[0]).toEqual(expect.objectContaining({
      commentId: 'dom:note-1:0',
      userName: '王子',
      content: '事实就是张雪现在的车队叫埃文兄弟车队',
      likeCount: 420,
      ipLocation: '江西',
      xsecToken: 'token-1',
      dataSource: AcquisitionDataSource.XhsBridgeCapture,
    }))
    expect(result.comments[1]).toEqual(expect.objectContaining({
      parentCommentId: 'dom:note-1:0',
      userName: '赵金贵',
      content: '49年入国军',
    }))
  })
})
```

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/providers/xhs/xhs-bridge-acquisition.provider.spec.ts
```

Expected: FAIL until the provider accepts DOM-captured `comments[]` fields and maps `commentedAtText` safely.

- [ ] **Step 2: Replace the placeholder extractor with real DOM capture**

Update `xhs-extractors.ts` so the browser-evaluated script extracts comment rows from the actual rendered page. Keep it read-only: no private APIs, no localStorage/cookie inspection, and no mutation except scrolling/clicking expand controls in the separate expand script.

```ts
export const XHS_EXPAND_COMMENTS_SCRIPT = `
(async () => {
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const expandTexts = ['查看更多回复', '展开更多回复', '更多回复', '展开'];
  let clicked = 0;

  for (let round = 0; round < 3; round += 1) {
    const controls = Array.from(document.querySelectorAll('button, span, div'));
    for (const el of controls) {
      const text = (el.textContent || '').trim();
      if (text && expandTexts.some(item => text.includes(item))) {
        el.click();
        clicked += 1;
      }
    }
    const scroller = document.querySelector('.note-scroller') || document.scrollingElement || document.documentElement;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'instant' });
    await sleep(800);
  }

  return { clicked };
})()
`

export const XHS_CAPTURE_NOTE_STATE_EXPRESSION = `
(() => {
  const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
  const getXsecToken = () => {
    try {
      return new URL(window.location.href).searchParams.get('xsec_token') || '';
    }
    catch {
      return '';
    }
  };
  const parseLikeCount = (text) => {
    const matches = String(text || '').match(/\\d+(?:\\.\\d+)?\\s*w?|\\d+(?:\\.\\d+)?\\s*万?/gi) || [];
    const raw = matches[matches.length - 1] || '0';
    const numeric = Number(raw.replace(/[^\\d.]/g, ''));
    if (!Number.isFinite(numeric)) return 0;
    return /w|万/i.test(raw) ? Math.round(numeric * 10000) : Math.round(numeric);
  };
  const parseCommentText = (el) => {
    const lines = String(el.innerText || el.textContent || '')
      .split('\\n')
      .map(item => item.trim())
      .filter(Boolean)
      .filter(item => !['回复', '查看更多回复', '展开更多回复'].includes(item));

    const userName = lines[0] || '';
    const metaIndex = lines.findIndex(item => /(?:\\d{2}-\\d{2}|\\d+天前|昨天|今天|北京|上海|广东|浙江|江苏|江西|山东|河南|四川|福建|湖北|湖南|重庆|天津|河北|山西|陕西|辽宁|吉林|黑龙江|安徽|云南|贵州|广西|海南|甘肃|青海|宁夏|新疆|西藏|内蒙古)/.test(item));
    const contentLines = lines.slice(1, metaIndex > 1 ? metaIndex : lines.length);
    const metaText = metaIndex >= 0 ? lines[metaIndex] : '';

    return {
      userName,
      content: clean(contentLines.join(' ')),
      metaText,
      likeCount: parseLikeCount(lines.join(' ')),
    };
  };
  const parseMeta = (metaText) => {
    const dateMatch = String(metaText || '').match(/\\d{2}-\\d{2}|\\d+天前|昨天|今天/);
    const ipLocation = clean(String(metaText || '').replace(dateMatch?.[0] || '', ''));
    return {
      commentedAtText: dateMatch?.[0] || '',
      ipLocation,
    };
  };
  const noteId = window.location.pathname.match(/(?:explore|discovery\\/item)\\/([^/?#]+)/)?.[1] || '';
  const xsecToken = getXsecToken();
  const title = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
    || document.querySelector('title')?.textContent
    || '';
  const cover = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
  const commentCountText = document.querySelector('.comments-el, .comments-container')?.textContent || '';
  const commentCountMatch = commentCountText.match(/共\\s*(\\d+)\\s*条评论/);
  const commentCount = commentCountMatch ? Number(commentCountMatch[1]) : 0;

  const commentNodes = Array.from(document.querySelectorAll('.comment-item'));
  const comments = commentNodes.map((el, index) => {
    const parsed = parseCommentText(el);
    const meta = parseMeta(parsed.metaText);
    const isSub = String(el.className || '').includes('comment-item-sub');
    const parent = isSub ? el.closest('.parent-comment')?.querySelector('.comment-item:not(.comment-item-sub)') : null;
    const parentIndex = parent ? commentNodes.indexOf(parent) : -1;

    return {
      id: el.getAttribute('data-comment-id') || 'dom:' + noteId + ':' + index,
      parentCommentId: parentIndex >= 0 ? 'dom:' + noteId + ':' + parentIndex : '',
      userName: parsed.userName,
      userAvatar: el.querySelector('img')?.getAttribute('src') || '',
      content: parsed.content,
      likeCount: parsed.likeCount,
      ipLocation: meta.ipLocation,
      commentedAtText: meta.commentedAtText,
      xsecToken,
    };
  }).filter(item => item.userName && item.content);

  return JSON.stringify({
    location: window.location.href,
    note: { title: clean(title), cover, commentCount },
    comments,
    hasMore: Boolean(document.body.innerText.includes('查看更多评论') || document.body.innerText.includes('正在加载')),
  });
})()
`
```

- [ ] **Step 3: Update provider normalization for DOM-captured comments**

Update `XhsBridgeAcquisitionProvider` so it:

- calls `XHS_EXPAND_COMMENTS_SCRIPT` before `XHS_CAPTURE_NOTE_STATE_EXPRESSION`;
- accepts `state.note.commentCount` as normalized post metric;
- maps DOM-captured comment fields (`userName`, `userAvatar`, `commentedAtText`, `parentCommentId`) as well as API-like fields;
- keeps `xsecToken` from each comment first, then falls back to the note URL token;
- creates deterministic fallback comment IDs only when no platform/DOM id exists.

The comment normalizer must support this mapping:

```ts
private normalizeComments(request: AcquisitionFetchRequest, comments: unknown[], postId: string): NormalizedCommentSnapshot[] {
  const fallbackXsecToken = this.extractXsecToken(request.postUrl)
  return comments.map((item, index) => {
    const comment = item as XhsCommentLike & {
      userName?: string
      userAvatar?: string
      likeCount?: number
      ipLocation?: string
      commentedAtText?: string
      parentCommentId?: string
    }
    return {
      platform: AcquisitionPlatform.Xhs,
      accountId: request.accountId,
      postId,
      commentId: comment.id || comment.comment_id || \`dom:\${postId}:\${index}\`,
      parentCommentId: comment.parentCommentId || '',
      userName: comment.userName || comment.user?.nickname || comment.user_info?.nickname || '',
      userAvatar: comment.userAvatar || comment.user?.avatar || comment.user_info?.image || '',
      content: comment.content || comment.text || '',
      likeCount: Number(comment.likeCount ?? comment.like_count ?? comment.liked_count ?? 0),
      ipLocation: comment.ipLocation || comment.ip_location || '',
      xsecToken: comment.xsec_token || comment.xsecToken || fallbackXsecToken,
      commentedAt: this.toDate(comment.create_time) || this.toXhsRelativeDate(comment.commentedAtText),
      fetchBatch: request.fetchBatch || '',
      dataSource: AcquisitionDataSource.XhsBridgeCapture,
    }
  }).filter(comment => comment.userName && comment.content)
}
```

- [ ] **Step 4: Add date parsing for XHS DOM date text**

Add a helper that handles common XHS visible date formats without pretending precision the page does not expose:

```ts
private toXhsRelativeDate(value?: string) {
  if (!value) return undefined
  const now = new Date()
  if (value === '今天') return now
  if (value === '昨天') return new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const daysAgo = value.match(/^(\\d+)天前$/)
  if (daysAgo) {
    return new Date(now.getTime() - Number(daysAgo[1]) * 24 * 60 * 60 * 1000)
  }

  const monthDay = value.match(/^(\\d{2})-(\\d{2})$/)
  if (monthDay) {
    const year = now.getFullYear()
    return new Date(year, Number(monthDay[1]) - 1, Number(monthDay[2]))
  }

  return undefined
}
```

- [ ] **Step 5: Verify with unit tests**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/providers/xhs/xhs-bridge-acquisition.provider.spec.ts
```

Expected: provider test passes and proves DOM-captured comments are normalized into `NormalizedCommentSnapshot[]`.

- [ ] **Step 6: Verify with a live local smoke test**

Start local services and ensure the Chrome extension badge is `ON`, then use a logged-in XHS note page that visibly has comments:

```bash
./scripts/local-restart.sh --skip-build
```

Open:

```text
http://127.0.0.1:6061/zh-CN/acquisition
```

Manual fetch input:

- platform: `小红书`
- accountId: any configured local account id
- postUrl: a full `https://www.xiaohongshu.com/explore/<noteId>?xsec_token=...` URL
- postId: optional

Expected UI result:

- status is `ready`;
- post is `saved`;
- comments is greater than `0` for a page that visibly contains comments;
- latest comments display `dataSource = xhs_bridge_capture`.

- [ ] **Step 7: Verify persistence**

Query the local MongoDB collection for the fetched note:

```bash
mongosh 'mongodb://127.0.0.1:27017/aitoearn_channel' --eval '
db.comment_snapshot.find({
  platform: "xhs",
  postId: "<noteId>"
}, {
  commentId: 1,
  parentCommentId: 1,
  userName: 1,
  content: 1,
  likeCount: 1,
  ipLocation: 1,
  xsecToken: 1,
  dataSource: 1
}).limit(5).toArray()
'
```

Expected:

- at least one document exists for a note page that visibly has comments;
- `content` is not empty;
- `userName` is not empty;
- `dataSource` is `xhs_bridge_capture`;
- `xsecToken` is present when the source URL has `xsec_token`.

- [ ] **Step 8: Update final verification commands**

Run the standard Phase 1 verification:

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
pnpm exec vitest run \
  apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge-hub.spec.ts \
  apps/aitoearn-server/src/core/acquisition/providers/xhs/xhs-bridge-acquisition.provider.spec.ts
cd ../aitoearn-web
pnpm run type-check
cd ../..
git diff --check
```

Expected: all commands pass.

---

### Task 6: Implement Douyin Official Comment Provider

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/channel/libs/douyin/common.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/channel/libs/douyin/douyin-api.service.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/channel/platforms/douyin/douyin.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/providers/douyin/douyin-acquisition.provider.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/providers/douyin/douyin-acquisition.provider.spec.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts`

- [ ] **Step 1: Preserve Douyin authorization scope**

`DouyinAccessTokenInfo` already contains `scope: string`, and `saveOAuthCredential()` writes the full `accessTokenInfo` to Redis. The current durable fallback path can lose scope information because `getOAuth2Credential()` rebuilds credentials with `scopes: []`.

Update Douyin auth storage before implementing the provider:

```ts
// DouyinApiService.getAuthPage()
const scopes = ['user_info', 'data.external.user', 'item.comment'].join(',')
```

Only enable `item.comment` after the app has obtained this Open Platform permission. If the permission is not approved yet, keep the old scopes and the provider should report `permission_required`.

Persist and restore the raw token payload:

```ts
// DouyinService.saveOAuthCredential()
await this.oauth2CredentialRepository.upsertOne(accountId, this.platform, {
  accessToken: accessTokenInfo.access_token,
  refreshToken: accessTokenInfo.refresh_token,
  accessTokenExpiresAt: accessTokenInfo.expires_in,
  raw: JSON.stringify(accessTokenInfo),
})

// DouyinService.getAccountAuthInfo()
const cached = await this.redisService.getJson<DouyinAccessTokenInfo>(
  ChannelRedisKeys.accessToken('douyin', accountId),
)
if (cached) return cached

const credential = await this.oauth2CredentialRepository.getOne(accountId, this.platform)
if (!credential?.raw) return null
return JSON.parse(credential.raw) as DouyinAccessTokenInfo
```

Do not silently convert missing scope data to `scopes: []`; missing scope metadata should be treated as `permission_required` with a clear reason.

- [ ] **Step 2: Add Douyin response interfaces**

Add interfaces for `/item/comment/list` and `/item/comment/reply/list`:

```ts
export interface DouyinCommentItem {
  comment_id: string
  content: string
  create_time?: number
  digg_count?: number
  reply_comment_total?: number
  top?: boolean
  user?: {
    nickname?: string
    avatar?: string
    open_id?: string
  }
}

export interface DouyinCommentListResponse {
  comments?: DouyinCommentItem[]
  cursor?: number
  has_more?: boolean
  error_code?: number
  description?: string
}
```

- [ ] **Step 3: Add API methods to `DouyinApiService`**

```ts
async getVideoCommentList(
  accessToken: string,
  params: { openId: string, itemId: string, cursor?: number, count?: number },
): Promise<DouyinCommentListResponse> {
  const response = await axios.get<{ data: DouyinCommentListResponse, extra?: { error_code?: number, description?: string } }>(
    'https://open.douyin.com/item/comment/list',
    {
      params: {
        open_id: params.openId,
        item_id: params.itemId,
        cursor: params.cursor ?? 0,
        count: params.count ?? 20,
      },
      headers: {
        'access-token': accessToken,
      },
    },
  )
  const errorCode = response.data.extra?.error_code ?? response.data.data?.error_code ?? 0
  if (errorCode !== 0) {
    throw new Error(response.data.extra?.description || response.data.data?.description || 'douyin comment list failed')
  }
  return response.data.data
}

async getVideoCommentReplyList(
  accessToken: string,
  params: { openId: string, itemId: string, commentId: string, cursor?: number, count?: number },
): Promise<DouyinCommentListResponse> {
  const response = await axios.get<{ data: DouyinCommentListResponse, extra?: { error_code?: number, description?: string } }>(
    'https://open.douyin.com/item/comment/reply/list',
    {
      params: {
        open_id: params.openId,
        item_id: params.itemId,
        comment_id: params.commentId,
        cursor: params.cursor ?? 0,
        count: params.count ?? 20,
      },
      headers: {
        'access-token': accessToken,
      },
    },
  )
  const errorCode = response.data.extra?.error_code ?? response.data.data?.error_code ?? 0
  if (errorCode !== 0) {
    throw new Error(response.data.extra?.description || response.data.data?.description || 'douyin comment reply list failed')
  }
  return response.data.data
}
```

- [ ] **Step 4: Implement provider**

The provider loads account auth through `DouyinService.getAccountAuthInfo(accountId)`, returns `PermissionRequired` when token scopes are missing or the API returns permission errors, and normalizes comments into `NormalizedCommentSnapshot`.

```ts
@Injectable()
export class DouyinAcquisitionProvider implements AcquisitionProvider {
  constructor(
    private readonly douyinService: DouyinService,
    private readonly douyinApiService: DouyinApiService,
  ) {}

  async getCapabilityStatus(accountId: string) {
    const auth = await this.douyinService.getAccountAuthInfo(accountId)
    if (!auth) {
      return { status: AcquisitionCapabilityStatus.PendingAuthorization, reason: 'Douyin account is not authorized' }
    }
    const scopes = this.getScopes(auth)
    if (scopes.length === 0) {
      return { status: AcquisitionCapabilityStatus.PermissionRequired, reason: 'Douyin authorization scope is not recorded; re-auth is required' }
    }
    if (!scopes.includes('item.comment')) {
      return { status: AcquisitionCapabilityStatus.PermissionRequired, reason: 'Douyin account is missing item.comment scope' }
    }
    return { status: AcquisitionCapabilityStatus.Ready, reason: '' }
  }

  async fetchWorkAndComments(request: AcquisitionFetchRequest): Promise<AcquisitionFetchResult> {
    const capability = await this.getCapabilityStatus(request.accountId)
    if (capability.status !== AcquisitionCapabilityStatus.Ready) {
      return { comments: [], cursor: request.cursor || '', hasMore: false, capabilityStatus: capability.status, capabilityReason: capability.reason }
    }
    const auth = await this.douyinService.getAccountAuthInfo(request.accountId)
    if (!auth) {
      return { comments: [], cursor: request.cursor || '', hasMore: false, capabilityStatus: AcquisitionCapabilityStatus.PendingAuthorization, capabilityReason: 'Douyin account is not authorized' }
    }

    try {
      const response = await this.douyinApiService.getVideoCommentList(auth.access_token, {
        openId: auth.open_id,
        itemId: request.postId || this.parseDouyinVideoId(request.postUrl),
        cursor: request.cursor ? Number(request.cursor) : 0,
        count: 20,
      })
      const postId = request.postId || this.parseDouyinVideoId(request.postUrl)
      const fetchedAt = new Date()
      return {
        post: {
          platform: AcquisitionPlatform.Douyin,
          accountId: request.accountId,
          postId,
          postUrl: request.postUrl,
          title: '',
          cover: '',
          metrics: { raw: {}, normalized: { commentCount: response.comments?.length || 0 } },
          fetchedAt,
          fetchDate: fetchedAt.toISOString().slice(0, 10),
          dataSource: AcquisitionDataSource.DouyinOpenApi,
        },
        comments: (response.comments || []).map(comment => ({
          platform: AcquisitionPlatform.Douyin,
          accountId: request.accountId,
          postId,
          commentId: comment.comment_id,
          parentCommentId: '',
          userName: comment.user?.nickname || '',
          userAvatar: comment.user?.avatar || '',
          content: comment.content,
          likeCount: comment.digg_count || 0,
          ipLocation: '',
          commentedAt: comment.create_time ? new Date(comment.create_time * 1000) : undefined,
          fetchBatch: request.fetchBatch,
          dataSource: AcquisitionDataSource.DouyinOpenApi,
        })),
        cursor: String(response.cursor ?? ''),
        hasMore: !!response.has_more,
        capabilityStatus: AcquisitionCapabilityStatus.Ready,
        capabilityReason: '',
      }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const permission = message.includes('scope') || message.includes('permission') || message.includes('权限')
      return {
        comments: [],
        cursor: request.cursor || '',
        hasMore: false,
        capabilityStatus: permission ? AcquisitionCapabilityStatus.PermissionRequired : AcquisitionCapabilityStatus.Failed,
        capabilityReason: message,
      }
    }
  }

  private parseDouyinVideoId(postUrl: string): string {
    const match = postUrl.match(/video\\/(\\d+)/)
    return match?.[1] || ''
  }

  private getScopes(auth: Record<string, any>): string[] {
    const raw = auth.scope ?? auth.scopes ?? ''
    return (Array.isArray(raw) ? raw : String(raw).split(/[,\\s]+/)).filter(Boolean)
  }
}
```

- [ ] **Step 5: Add provider tests**

Mock `DouyinService.getAccountAuthInfo()` and `DouyinApiService.getVideoCommentList()` to assert:

- no auth returns `pending_authorization`;
- authorization with missing scope metadata returns `permission_required` and asks for re-auth;
- authorized account without `item.comment` returns `permission_required`;
- Redis miss with persisted raw token restores `item.comment` scope through `DouyinService.getAccountAuthInfo()`;
- successful API response normalizes comment snapshots;
- permission error returns `permission_required`.

- [ ] **Step 6: Verify tests**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/providers/douyin/douyin-acquisition.provider.spec.ts
```

Expected: tests pass.

---

### Task 7: Add Acquisition Orchestration, Controller, and Status API

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/comment-capability.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.controller.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.service.spec.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts`

- [ ] **Step 1: Implement capability service**

Import `CommentFetchCapabilityStatus` from `@yikart/channel-db` and map the acquisition enum explicitly.

```ts
@Injectable()
export class CommentCapabilityService {
  constructor(private readonly accountOpsConfigRepository: AccountOpsConfigRepository) {}

  async save(accountId: string, status: AcquisitionCapabilityStatus, reason = '', meta: Record<string, unknown> = {}) {
    const channelStatusMap: Record<AcquisitionCapabilityStatus, CommentFetchCapabilityStatus> = {
      [AcquisitionCapabilityStatus.NotConfigured]: CommentFetchCapabilityStatus.NotConfigured,
      [AcquisitionCapabilityStatus.PendingAuthorization]: CommentFetchCapabilityStatus.PendingAuthorization,
      [AcquisitionCapabilityStatus.PermissionRequired]: CommentFetchCapabilityStatus.PermissionRequired,
      [AcquisitionCapabilityStatus.Ready]: CommentFetchCapabilityStatus.Ready,
      [AcquisitionCapabilityStatus.Failed]: CommentFetchCapabilityStatus.Failed,
      [AcquisitionCapabilityStatus.ManualRequired]: CommentFetchCapabilityStatus.ManualRequired,
      [AcquisitionCapabilityStatus.PendingConfirmation]: CommentFetchCapabilityStatus.PendingConfirmation,
    }
    return await this.accountOpsConfigRepository.updateCommentCapability(accountId, channelStatusMap[status], reason, meta)
  }

  getKwaiPendingStatus() {
    return {
      status: AcquisitionCapabilityStatus.PendingConfirmation,
      reason: 'Kwai comment API permission is not confirmed for Phase 1',
    }
  }
}
```

- [ ] **Step 2: Implement acquisition service**

Import `Inject` from `@nestjs/common` and `ACQUISITION_PROVIDERS` from `acquisition.constants`.

```ts
@Injectable()
export class AcquisitionService {
  constructor(
    private readonly queueService: QueueService,
    private readonly snapshots: SnapshotPersistenceService,
    private readonly capability: CommentCapabilityService,
    @Inject(ACQUISITION_PROVIDERS)
    private readonly providers: Partial<Record<AcquisitionPlatform, AcquisitionProvider>>,
  ) {}

  async fetchNow(userId: string, dto: FetchWorkDto & { fetchBatch?: string }) {
    const fetchBatch = dto.fetchBatch || `manual:${Date.now()}`
    const provider = this.providers[dto.platform]
    if (!provider) {
      return { capabilityStatus: AcquisitionCapabilityStatus.PendingConfirmation, capabilityReason: 'platform is not supported in Phase 1', commentsSaved: 0 }
    }
    const result = await provider.fetchWorkAndComments({ userId, ...dto, fetchBatch })
    await this.capability.save(dto.accountId, result.capabilityStatus, result.capabilityReason, { platform: dto.platform })
    const saved = await this.snapshots.persistFetchResult(result)
    return {
      ...saved,
      dataSource: result.post?.dataSource || result.comments[0]?.dataSource,
      latestComments: result.comments.slice(0, 10).map(comment => ({
        commentId: comment.commentId,
        content: comment.content,
        dataSource: comment.dataSource,
      })),
      capabilityStatus: result.capabilityStatus,
      capabilityReason: result.capabilityReason,
      cursor: result.cursor,
      hasMore: result.hasMore,
    }
  }

  async enqueueCommentFetch(userId: string, dto: EnqueueCommentFetchDto) {
    const fetchBatch = dto.fetchBatch || `queue:${Date.now()}`
    return await this.queueService.addAcquisitionCommentFetchJob({ userId, fetchBatch, ...dto })
  }
}
```

- [ ] **Step 3: Implement controller**

```ts
import { ApiDoc } from '@yikart/common'

@ApiTags('获客/采集')
@Controller('/acquisition')
export class AcquisitionController {
  constructor(private readonly acquisitionService: AcquisitionService) {}

  @ApiDoc({ summary: '立即抓取作品评论', body: FetchWorkDto.schema })
  @Post('/works/fetch')
  async fetchNow(@GetToken() token: TokenInfo, @Body() dto: FetchWorkDto) {
    return await this.acquisitionService.fetchNow(token.id, dto)
  }

  @ApiDoc({ summary: '异步抓取作品评论', body: EnqueueCommentFetchDto.schema })
  @Post('/works/fetch/enqueue')
  async enqueue(@GetToken() token: TokenInfo, @Body() dto: EnqueueCommentFetchDto) {
    return await this.acquisitionService.enqueueCommentFetch(token.id, dto)
  }
}
```

- [ ] **Step 4: Register providers and controller**

Add controller and services to `AcquisitionModule`. Register providers through a token so adding Kwai or MediaCrawler later does not change the service constructor:

```ts
{
  provide: ACQUISITION_PROVIDERS,
  useFactory: (
    xhsProvider: XhsBridgeAcquisitionProvider,
    douyinProvider: DouyinAcquisitionProvider,
  ) => ({
    [AcquisitionPlatform.Xhs]: xhsProvider,
    [AcquisitionPlatform.Douyin]: douyinProvider,
  }),
  inject: [XhsBridgeAcquisitionProvider, DouyinAcquisitionProvider],
}
```

- [ ] **Step 5: Add service tests**

Test that `fetchNow()` calls the selected provider, persists snapshots, and saves capability status. Test unsupported `kwai` returns `pending_confirmation`.

- [ ] **Step 6: Verify tests**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/acquisition.service.spec.ts
```

Expected: tests pass.

---

### Task 8: Add Acquisition Queue Consumers

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/workers/acquisition-comment-fetch.consumer.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/workers/acquisition-post-backfill.consumer.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts`

- [ ] **Step 1: Implement comment fetch consumer**

Use `@QueueProcessor(QueueName.AcquisitionCommentFetch, { concurrency: 3 })`. Import `AcquisitionCommentFetchData` from `@yikart/aitoearn-queue`; Phase 0 defines this interface with `userId`, so do not add `& { userId: string }` locally. Acquire lock key `acquisition:comment-fetch:${platform}:${accountId}` for 120 seconds with `RedlockService`. When acquired, call `AcquisitionService.fetchNow(userId, dto)`. Release lock in `finally`.

```ts
import { randomUUID } from 'node:crypto'
import { AcquisitionCommentFetchData } from '@yikart/aitoearn-queue'
import { AcquisitionPlatform } from '../acquisition.constants'

@QueueProcessor(QueueName.AcquisitionCommentFetch, { concurrency: 3 })
export class AcquisitionCommentFetchConsumer extends WorkerHost {
  constructor(
    private readonly acquisitionService: AcquisitionService,
    private readonly redlockService: RedlockService,
  ) {
    super()
  }

  async process(job: Job<AcquisitionCommentFetchData>) {
    const lockKey = `acquisition:comment-fetch:${job.data.platform}:${job.data.accountId}`
    const lockValue = `${job.id || 'job'}:${randomUUID()}`
    const locked = await this.redlockService.acquireLock(lockKey, lockValue, 120)
    if (!locked) {
      throw new Error(`account collection is locked: ${lockKey}`)
    }
    try {
      const { userId, accountId, platform, postUrl, postId, cursor, fetchBatch } = job.data
      return await this.acquisitionService.fetchNow(userId, { accountId, platform: platform as AcquisitionPlatform, postUrl, postId, cursor, fetchBatch })
    }
    finally {
      await this.redlockService.releaseLock(lockKey, lockValue)
    }
  }
}
```

- [ ] **Step 2: Implement post backfill consumer**

Use `@QueueProcessor(QueueName.AcquisitionPostBackfill, { concurrency: 3 })`. It receives `accountId`, `platform`, and `postUrl`, then calls `fetchNow()` with `userId` loaded from the account record or included in job data. Unsupported platforms exit with `pending_confirmation`.

- [ ] **Step 3: Register consumers**

Add both consumers to `providers`.

- [ ] **Step 4: Verify backend build**

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build passes.

---

### Task 9: Enqueue Post Backfill After Publish Completion

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/channel/publishing/providers/base.service.ts`
- Modify: `project/aitoearn-backend/libs/aitoearn-queue/src/interfaces/acquisition.interface.ts`

- [ ] **Step 1: Ensure acquisition queue job data includes `userId`**

Phase 0 should already define `userId` on `AcquisitionCommentFetchData`. Confirm the local branch has both queue payloads typed this way before wiring consumers:

```ts
export interface AcquisitionCommentFetchData {
  userId: string
  accountId: string
  platform: string
  postId?: string
  postUrl: string
  cursor?: string
  fetchBatch: string
}

export interface AcquisitionPostBackfillData {
  userId: string
  accountId: string
  platform: string
  postId?: string
  postUrl: string
}
```

- [ ] **Step 2: Enqueue acquisition backfill from `completePublishTask()`**

Add a small mapping helper in the publishing base service instead of assuming `accountType` values are identical to `AcquisitionPlatform` values:

```ts
private toAcquisitionPlatform(accountType: unknown): 'xhs' | 'douyin' | 'kwai' | null {
  const value = String(accountType || '').toLowerCase()
  if (['xhs', 'xiaohongshu', 'rednote'].includes(value)) return 'xhs'
  if (['douyin', 'tiktok_cn'].includes(value)) return 'douyin'
  if (['kwai', 'kuaishou'].includes(value)) return 'kwai'
  return null
}
```

After `publishRecordService.completeById(...)`, add:

```ts
const acquisitionPlatform = this.toAcquisitionPlatform(newData.accountType)
if (acquisitionPlatform && newData.accountId && newData.userId && newData.workLink) {
  await this.queueService.addAcquisitionPostBackfillJob({
    userId: newData.userId,
    accountId: newData.accountId,
    platform: acquisitionPlatform,
    postId: dataId,
    postUrl: newData.workLink,
  })
}
```

- [ ] **Step 3: Verify publish provider tests**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/channel/publishing/providers/publishing-providers.spec.ts apps/aitoearn-server/src/core/channel/publishing/publishing.service.spec.ts
```

Expected: existing publishing tests pass. Update mocks to include `addAcquisitionPostBackfillJob` where a mocked `QueueService` is used.

---

### Task 10: Add Frontend Phase 1 Status and Fetch UI

**Files:**
- Create: `project/aitoearn-web/src/api/acquisition.ts`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/components/CommentCapabilityCards/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/components/WorkFetchPanel/index.tsx`
- Modify: `project/aitoearn-web/src/app/[lng]/acquisition/acquisitionPageCore.tsx`
- Modify: `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json`
- Modify: `project/aitoearn-web/src/app/i18n/locales/en/route.json`

- [ ] **Step 1: Add API wrappers**

```ts
import http from '@/utils/request'

export interface AcquisitionFetchRequest {
  accountId: string
  platform: 'xhs' | 'douyin' | 'kwai'
  postUrl: string
  postId?: string
  cursor?: string
}

export interface AcquisitionFetchResponse {
  postSaved: boolean
  commentsSaved: number
  dataSource?: 'xhs_plugin_api' | 'xhs_bridge_capture' | 'douyin_open_api' | 'manual_snapshot' | 'demo_seed'
  latestComments?: Array<{
    commentId: string
    content: string
    dataSource: string
  }>
  capabilityStatus: string
  capabilityReason: string
  cursor: string
  hasMore: boolean
}

export function fetchAcquisitionWork(data: AcquisitionFetchRequest) {
  return http.post<AcquisitionFetchResponse>('/acquisition/works/fetch', data)
}
```

- [ ] **Step 2: Add capability cards component**

Create `components/CommentCapabilityCards/index.tsx`.

Render three static Phase 1 cards:

- XHS: “插件/Bridge 真实网页会话”
- Douyin: “需 `item.comment` 授权”
- Kwai: “官方评论权限待确认”

Use compact cards, no nested cards.

- [ ] **Step 3: Add manual fetch panel**

Create `components/WorkFetchPanel/index.tsx`.

Fields:

- platform select: XHS/Douyin/Kwai
- accountId input
- postUrl input
- fetch button

On submit, call `fetchAcquisitionWork()`, then show `commentsSaved`, `capabilityStatus`, and `capabilityReason`.

Also show source provenance required by PRD acceptance:

- top-level source label from `dataSource` when present;
- per-comment `dataSource` for `latestComments`, with display text mapping `xhs_plugin_api` / `xhs_bridge_capture` / `manual_snapshot` / `demo_seed` / `douyin_open_api`.

- [ ] **Step 4: Mount components in the Data Dashboard tab**

In `AcquisitionPageCore`, place `CommentCapabilityCards` and `WorkFetchPanel` under the `dashboard` tab placeholder. Keep other tabs as placeholders.

Also replace Phase 0 hard-coded tab labels and placeholder copy with i18n keys. Existing route files use flat keys such as `header.acquisition`, so keep that style and add/confirm at least these keys under both `zh-CN/route.json` and `en/route.json`:

```json
{
  "acquisition.subtitle": "多平台服装 AI 获客工作台",
  "acquisition.tabs.dashboard": "数据看板",
  "acquisition.tabs.content": "内容管理",
  "acquisition.tabs.hooks": "引流管理",
  "acquisition.tabs.leads": "线索追踪",
  "acquisition.tabs.accounts": "多账号管理",
  "acquisition.placeholder": "Phase 1 路由骨架，后续阶段接入更多真实数据。"
}
```

- [ ] **Step 5: Verify frontend type check**

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: type check passes.

- [ ] **Step 6: Verify route manually**

```bash
cd project/aitoearn-web
pnpm dev
```

Open `http://localhost:6061/zh-CN/acquisition`. Expected: five tabs render; 数据看板 shows status cards and manual fetch panel.

---

### Task 11: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run backend build**

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build passes.

- [ ] **Step 2: Run focused backend tests**

```bash
cd project/aitoearn-backend
pnpm exec vitest run \
  apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge-hub.spec.ts \
  apps/aitoearn-server/src/core/acquisition/snapshot-persistence.service.spec.ts \
  apps/aitoearn-server/src/core/acquisition/acquisition.service.spec.ts \
  apps/aitoearn-server/src/core/acquisition/providers/xhs/xhs-bridge-acquisition.provider.spec.ts \
  apps/aitoearn-server/src/core/acquisition/providers/douyin/douyin-acquisition.provider.spec.ts
```

Expected: all focused tests pass.

- [ ] **Step 3: Run frontend type check**

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: type check passes.

- [ ] **Step 4: Run whitespace check**

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 5: Review changed files**

```bash
git status --short
```

Expected: changes are limited to Phase 1 backend acquisition, XHS bridge extension points, Douyin API wrappers, publishing backfill enqueue, and acquisition frontend UI.

---

## Acceptance Criteria

- XHS Bridge exposes backend-callable status and command APIs.
- `POST /acquisition/works/fetch` accepts XHS and Douyin work links and persists normalized snapshots.
- XHS comments are fetched through the Bridge path and stored in `comment_snapshot`.
- For a logged-in XHS note page that visibly contains `.comment-item` rows, a manual fetch must return `commentsSaved > 0`; `ready / postSaved=true / commentsSaved=0` is not acceptable unless the visible page has no comments.
- XHS comment snapshots include non-empty `userName`, non-empty `content`, stable `commentId`, `parentCommentId` for visible child replies when present, `likeCount`, `ipLocation` when visible, `xsecToken` when the source URL has it, and `dataSource = xhs_bridge_capture`.
- Douyin comments are fetched through official comment APIs when the authorized account has required permission.
- Douyin missing authorization/permission is persisted as account capability status instead of returning fake comment data.
- Post snapshots are written to `post_snapshot` with raw and normalized metrics.
- Comment snapshots are deduped by platform/account/post/comment/parent.
- `acquisition_comment_fetch` and `acquisition_post_backfill` consumers exist and use account-level locking.
- Publish completion enqueues post backfill when `workLink` exists.
- Acquisition page shows platform capability cards and a manual fetch panel.
- Backend build, focused tests, frontend type check, and `git diff --check` pass.

---

## Phase 1 Non-Goals

- Do not implement Kwai comment fetching.
- Do not implement MediaCrawler sidecar integration.
- Do not implement AI reply generation or human-confirmed reply execution.
- Do not implement lead auto-classification.
- Do not implement dashboard aggregates or funnel charts.
- Do not implement demo seed data.
