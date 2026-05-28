# Work Data Monitoring and Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the real `/work-data` product page: manage monitored posts, ingest posts from manual links and published content, fetch post/comment snapshots, display fetched works and comments, and expose capability/source status for XHS, Douyin, and Kwai.

**Architecture:** Add a monitored-post aggregate on top of the existing `post_snapshot` and `comment_snapshot` collections. Backend owns monitored-post CRUD, fetch orchestration, snapshot query APIs, publish-backfill integration, and account strategy checks; frontend replaces the roadmap placeholder with a real Work Data page that calls these APIs and renders post list, detail, comments, and source labels.

**Tech Stack:** NestJS, Mongoose repositories from `@yikart/channel-db`, BullMQ via `@yikart/aitoearn-queue`, existing acquisition providers, Zod DTOs with `createZodDto`, `@ApiDoc`, Next.js App Router, Zustand/local component state, existing `@/utils/request`, Tailwind/Radix/Ant Design conventions, Lucide icons, pnpm/Nx/Vitest.

---

## Current Context

- Existing Phase 0/1 pieces:
  - `project/aitoearn-backend/libs/channel-db/src/schemas/post-snapshot.schema.ts`
  - `project/aitoearn-backend/libs/channel-db/src/schemas/comment-snapshot.schema.ts`
  - `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.controller.ts`
  - `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.service.ts`
  - `project/aitoearn-web/src/api/acquisition.ts`
- Existing gaps:
  - No monitored-post master record.
  - `/work-data` is still a roadmap page.
  - There is no post list API, post detail API, post snapshot history API, or paginated comment query API.
  - Published content is not consistently added to monitored posts.
  - Account strategy from Phase 2 (`AccountOpsConfig`) is not checked before fetch/sync.

## File Structure

### Backend Data Layer

| File | Responsibility |
|---|---|
| `project/aitoearn-backend/libs/channel-db/src/schemas/monitored-post.schema.ts` | Master record for posts under monitoring. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/monitored-post.repository.ts` | Upsert/list/detail/update-status operations for monitored posts. |
| `project/aitoearn-backend/libs/channel-db/src/schemas/monitored-post-fetch-log.schema.ts` | Fetch attempt log used for daily account limits and debugging. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/monitored-post-fetch-log.repository.ts` | Count and write monitored-post fetch attempts. |
| `project/aitoearn-backend/libs/channel-db/src/schemas/index.ts` | Register `MonitoredPost` schema. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/index.ts` | Export/register `MonitoredPostRepository`. |

### Backend Acquisition Module

| File | Responsibility |
|---|---|
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.dto.ts` | Zod DTOs for monitored-post APIs and snapshot query APIs. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.vo.ts` | VO schemas for frontend response contracts. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.service.ts` | Monitored-post CRUD, fetch orchestration, snapshot list/detail, comments pagination. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.controller.ts` | `/acquisition/work-data/*` REST endpoints. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts` | Register work-data service/controller. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/snapshot-persistence.service.ts` | Update monitored-post latest snapshot status after fetch. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/workers/acquisition-post-backfill.consumer.ts` | Ensure published/backfilled works enter monitored posts. |

### Frontend

| File | Responsibility |
|---|---|
| `project/aitoearn-web/src/api/workData.ts` | Work Data API wrappers and response types. |
| `project/aitoearn-web/src/app/[lng]/work-data/page.tsx` | Mount the real page instead of roadmap. |
| `project/aitoearn-web/src/app/[lng]/work-data/WorkDataPage/index.tsx` | Page composition, filters, table, drawer state. |
| `project/aitoearn-web/src/app/[lng]/work-data/components/PostMonitorToolbar/index.tsx` | Platform/account/source/status filters and add button. |
| `project/aitoearn-web/src/app/[lng]/work-data/components/AddMonitoredPostDialog/index.tsx` | Manual link entry. |
| `project/aitoearn-web/src/app/[lng]/work-data/components/MonitoredPostTable/index.tsx` | Monitored post list. |
| `project/aitoearn-web/src/app/[lng]/work-data/components/PostDetailDrawer/index.tsx` | Post snapshot details, comments, fetch history. |
| `project/aitoearn-web/src/app/[lng]/work-data/components/DataSourceBadge/index.tsx` | Consistent data-source labels. |
| `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json` | Chinese labels. |
| `project/aitoearn-web/src/app/i18n/locales/en/route.json` | English labels. |

---

## Task 1: Add `MonitoredPost` Schema and Repository

**Files:**
- Create: `project/aitoearn-backend/libs/channel-db/src/schemas/monitored-post.schema.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/repositories/monitored-post.repository.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/schemas/monitored-post-fetch-log.schema.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/repositories/monitored-post-fetch-log.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/index.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/index.ts`
- Test: `project/aitoearn-backend/libs/channel-db/src/repositories/monitored-post.repository.spec.ts`

- [ ] **Step 1: Write failing repository tests**

Create `monitored-post.repository.spec.ts` covering:

```ts
describe('MonitoredPostRepository', () => {
  it('upserts the same platform/account/postId into one monitored post', async () => {
    const first = await repository.upsertByIdentity({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
      postUrl: 'https://www.xiaohongshu.com/explore/post-1',
      source: 'manual',
      monitorStatus: 'active',
    })

    const second = await repository.upsertByIdentity({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
      postUrl: 'https://www.xiaohongshu.com/explore/post-1?xsec_token=abc',
      source: 'manual',
      monitorStatus: 'active',
    })

    expect(String(second.id)).toBe(String(first.id))
    expect(second.postUrl).toContain('xsec_token=abc')
  })
})
```

- [ ] **Step 2: Run test and verify it fails**

```bash
cd project/aitoearn-backend
pnpm exec vitest run libs/channel-db/src/repositories/monitored-post.repository.spec.ts
```

Expected: FAIL because `MonitoredPostRepository` does not exist.

- [ ] **Step 3: Add schema**

Create `monitored-post.schema.ts`:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export type MonitoredPostSource = 'manual' | 'published_backfill' | 'demo_seed'
export type MonitoredPostStatus = 'active' | 'paused' | 'failed' | 'archived'
export type MonitoredPostFetchStatus = 'idle' | 'fetching' | 'ready' | 'failed' | 'permission_required' | 'not_configured' | 'pending_confirmation'

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'monitored_post' })
export class MonitoredPost extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  userId: string

  @Prop({ required: true, index: true, type: String })
  platform: string

  @Prop({ required: true, index: true, type: String })
  accountId: string

  @Prop({ required: true, index: true, type: String })
  postId: string

  @Prop({ required: true, type: String })
  postUrl: string

  @Prop({ type: String, default: '' })
  title: string

  @Prop({ type: String, default: '' })
  cover: string

  @Prop({ required: true, index: true, type: String })
  source: MonitoredPostSource

  @Prop({ required: true, index: true, type: String, default: 'active' })
  monitorStatus: MonitoredPostStatus

  @Prop({ required: true, index: true, type: String, default: 'idle' })
  fetchStatus: MonitoredPostFetchStatus

  @Prop({ type: String, default: '' })
  capabilityReason: string

  @Prop({ type: String, default: '' })
  latestPostSnapshotId: string

  @Prop({ type: Date, default: null, index: true })
  lastFetchedAt?: Date

  @Prop({ type: Date, default: null, index: true })
  nextFetchAt?: Date

  @Prop({ type: Object, default: {} })
  latestMetrics: Record<string, number>

  @Prop({ type: Number, default: 0 })
  latestCommentCount: number

  @Prop({ type: String, default: '' })
  lastFetchBatch: string
}

export const MonitoredPostSchema = SchemaFactory.createForClass(MonitoredPost)
MonitoredPostSchema.index({ userId: 1, platform: 1, accountId: 1, postId: 1 }, { unique: true })
```

- [ ] **Step 4: Add repository**

Create `monitored-post.repository.ts`:

```ts
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { FilterQuery, Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { MonitoredPost } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class MonitoredPostRepository extends BaseRepository<MonitoredPost> {
  constructor(
    @InjectModel(MonitoredPost.name, DB_CONNECTION_NAME) private monitoredPostModel: Model<MonitoredPost>,
  ) {
    super(monitoredPostModel)
  }

  async upsertByIdentity(data: Partial<MonitoredPost> & {
    userId: string
    platform: string
    accountId: string
    postId: string
    postUrl: string
    source: string
  }) {
    const { monitorStatus, fetchStatus, ...setData } = data
    return await this.monitoredPostModel.findOneAndUpdate(
      { userId: data.userId, platform: data.platform, accountId: data.accountId, postId: data.postId },
      {
        $set: setData,
        $setOnInsert: {
          monitorStatus: monitorStatus || 'active',
          fetchStatus: fetchStatus || 'idle',
        },
      },
      { new: true, upsert: true },
    )
  }

  async listByFilter(filter: FilterQuery<MonitoredPost>, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize
    const [items, total] = await Promise.all([
      this.monitoredPostModel.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(pageSize).lean(),
      this.monitoredPostModel.countDocuments(filter),
    ])
    return { items, total, page, pageSize }
  }

  async updateFetchResult(id: string, data: Partial<MonitoredPost>) {
    return await this.monitoredPostModel.findByIdAndUpdate(id, { $set: data }, { new: true })
  }

  async findByIdentity(userId: string, platform: string, accountId: string, postId: string) {
    return await this.monitoredPostModel.findOne({ userId, platform, accountId, postId })
  }
}
```

- [ ] **Step 5: Add fetch log schema and repository**

Create `monitored-post-fetch-log.schema.ts`:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'monitored_post_fetch_log' })
export class MonitoredPostFetchLog extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  userId: string

  @Prop({ required: true, index: true, type: String })
  monitoredPostId: string

  @Prop({ required: true, index: true, type: String })
  accountId: string

  @Prop({ required: true, index: true, type: String })
  platform: string

  @Prop({ required: true, index: true, type: String })
  fetchStatus: string

  @Prop({ type: String, default: '' })
  fetchBatch: string

  @Prop({ type: String, default: '' })
  reason: string

  @Prop({ required: true, index: true, type: Date })
  fetchedAt: Date
}

export const MonitoredPostFetchLogSchema = SchemaFactory.createForClass(MonitoredPostFetchLog)
MonitoredPostFetchLogSchema.index({ userId: 1, accountId: 1, fetchedAt: -1 })
```

Create `monitored-post-fetch-log.repository.ts`:

```ts
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { MonitoredPostFetchLog } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class MonitoredPostFetchLogRepository extends BaseRepository<MonitoredPostFetchLog> {
  constructor(
    @InjectModel(MonitoredPostFetchLog.name, DB_CONNECTION_NAME) private fetchLogModel: Model<MonitoredPostFetchLog>,
  ) {
    super(fetchLogModel)
  }

  async countAccountFetchesSince(userId: string, accountId: string, since: Date) {
    return await this.fetchLogModel.countDocuments({
      userId,
      accountId,
      fetchedAt: { $gte: since },
    })
  }

  async record(data: {
    userId: string
    monitoredPostId: string
    accountId: string
    platform: string
    fetchStatus: string
    fetchBatch?: string
    reason?: string
  }) {
    return await this.create({
      ...data,
      fetchBatch: data.fetchBatch || '',
      reason: data.reason || '',
      fetchedAt: new Date(),
    })
  }
}
```

- [ ] **Step 6: Register schemas and repositories**

Add imports/exports and array entries in:

```ts
// libs/channel-db/src/schemas/index.ts
import { MonitoredPost, MonitoredPostSchema } from './monitored-post.schema'
import { MonitoredPostFetchLog, MonitoredPostFetchLogSchema } from './monitored-post-fetch-log.schema'

export { MonitoredPost, MonitoredPostSchema, MonitoredPostFetchLog, MonitoredPostFetchLogSchema }

schemas.push({ name: MonitoredPost.name, schema: MonitoredPostSchema })
schemas.push({ name: MonitoredPostFetchLog.name, schema: MonitoredPostFetchLogSchema })
```

```ts
// libs/channel-db/src/repositories/index.ts
import { MonitoredPostRepository } from './monitored-post.repository'
import { MonitoredPostFetchLogRepository } from './monitored-post-fetch-log.repository'

export { MonitoredPostRepository, MonitoredPostFetchLogRepository }

repositories.push(MonitoredPostRepository)
repositories.push(MonitoredPostFetchLogRepository)
```

- [ ] **Step 7: Verify repository test passes**

```bash
cd project/aitoearn-backend
pnpm exec vitest run libs/channel-db/src/repositories/monitored-post.repository.spec.ts
```

Expected: PASS.

---

## Task 2: Add Work Data Backend APIs

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.dto.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.vo.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.controller.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/post-snapshot.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/comment-snapshot.repository.ts`

- [ ] **Step 1: Write failing service tests**

Create `work-data.service.spec.ts` with tests for:

```ts
it('creates a manual monitored post and extracts xhs postId from url', async () => {
  const result = await service.createManual('user-1', {
    platform: 'xhs',
    accountId: 'account-1',
    postUrl: 'https://www.xiaohongshu.com/explore/abc123?xsec_token=token',
  })

  expect(result.userId).toBe('user-1')
  expect(result.postId).toBe('abc123')
  expect(result.source).toBe('manual')
})
```

```ts
it('lists comments with pagination and data source only for the current user', async () => {
  const result = await service.listComments('user-1', 'monitored-post-id', {
    page: 1,
    pageSize: 20,
  })

  expect(result.items[0]).toMatchObject({
    content: expect.any(String),
    dataSource: expect.any(String),
  })
})
```

- [ ] **Step 2: Add DTOs**

`work-data.dto.ts` should use explicit `z.enum`, not `z.nativeEnum`:

```ts
import { createZodDto } from '@yikart/common'
import { z } from 'zod'

export const WorkDataPlatformSchema = z.enum(['xhs', 'douyin', 'kwai']).describe('平台')

export const CreateMonitoredPostSchema = z.object({
  platform: WorkDataPlatformSchema.describe('平台'),
  accountId: z.string().min(1).describe('账号 ID'),
  postUrl: z.url().describe('作品链接'),
  postId: z.string().optional().describe('作品 ID'),
})
export class CreateMonitoredPostDto extends createZodDto(CreateMonitoredPostSchema, 'CreateMonitoredPostDto') {}

export const ListMonitoredPostQuerySchema = z.object({
  platform: WorkDataPlatformSchema.optional().describe('平台'),
  accountId: z.string().optional().describe('账号 ID'),
  source: z.enum(['manual', 'published_backfill', 'demo_seed']).optional().describe('来源'),
  monitorStatus: z.enum(['active', 'paused', 'failed', 'archived']).optional().describe('监控状态'),
  fetchStatus: z.enum(['idle', 'fetching', 'ready', 'failed', 'permission_required', 'not_configured', 'pending_confirmation']).optional().describe('抓取状态'),
  keyword: z.string().optional().describe('标题或链接关键词'),
  page: z.coerce.number().int().min(1).default(1).describe('页码'),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).describe('每页数量'),
})
export class ListMonitoredPostQueryDto extends createZodDto(ListMonitoredPostQuerySchema, 'ListMonitoredPostQueryDto') {}

export const SnapshotHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('返回数量'),
})
export class SnapshotHistoryQueryDto extends createZodDto(SnapshotHistoryQuerySchema, 'SnapshotHistoryQueryDto') {}

export const WorkCommentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('页码'),
  pageSize: z.coerce.number().int().min(1).max(200).default(50).describe('每页数量'),
  keyword: z.string().optional().describe('评论关键词'),
  parentCommentId: z.string().optional().describe('父评论 ID'),
  dataSource: z.string().optional().describe('数据来源'),
  fetchBatch: z.string().optional().describe('抓取批次'),
})
export class WorkCommentQueryDto extends createZodDto(WorkCommentQuerySchema, 'WorkCommentQueryDto') {}
```

- [ ] **Step 3: Add controller endpoints**

`work-data.controller.ts`:

```ts
@ApiTags('Acquisition Work Data')
@Controller('/acquisition/work-data')
export class WorkDataController {
  constructor(private readonly workDataService: WorkDataService) {}

  @ApiDoc({ summary: 'Create monitored post manually', body: CreateMonitoredPostDto.schema })
  @Post('/monitored-posts')
  async createManual(@GetToken() token: TokenInfo, @Body() body: CreateMonitoredPostDto) {
    return await this.workDataService.createManual(token.id, body)
  }

  @ApiDoc({ summary: 'List monitored posts', query: ListMonitoredPostQueryDto.schema })
  @Get('/monitored-posts')
  async list(@GetToken() token: TokenInfo, @Query() query: ListMonitoredPostQueryDto) {
    return await this.workDataService.listMonitoredPosts(token.id, query)
  }

  @ApiDoc({ summary: 'Get monitored post detail' })
  @Get('/monitored-posts/:id')
  async detail(@GetToken() token: TokenInfo, @Param('id') id: string) {
    return await this.workDataService.getDetail(token.id, id)
  }

  @ApiDoc({ summary: 'Fetch monitored post now' })
  @Post('/monitored-posts/:id/fetch')
  async fetchNow(@GetToken() token: TokenInfo, @Param('id') id: string) {
    return await this.workDataService.fetchNow(token.id, id)
  }

  @ApiDoc({ summary: 'List post snapshot history', query: SnapshotHistoryQueryDto.schema })
  @Get('/monitored-posts/:id/snapshots')
  async snapshots(@GetToken() token: TokenInfo, @Param('id') id: string, @Query() query: SnapshotHistoryQueryDto) {
    return await this.workDataService.listSnapshots(token.id, id, query.limit)
  }

  @ApiDoc({ summary: 'List monitored post comments', query: WorkCommentQueryDto.schema })
  @Get('/monitored-posts/:id/comments')
  async comments(@GetToken() token: TokenInfo, @Param('id') id: string, @Query() query: WorkCommentQueryDto) {
    return await this.workDataService.listComments(token.id, id, query)
  }
}
```

- [ ] **Step 4: Add service behavior**

`WorkDataService` should:

- create/upsert monitored post from manual link;
- store `userId` on every monitored post and force all list/detail/snapshot/comment queries to filter by `userId`;
- list monitored posts with filters, always merging `{ userId }` into the repository filter;
- call existing `AcquisitionService.fetchNow()` when user clicks fetch;
- update `MonitoredPost.fetchStatus`, `lastFetchedAt`, `lastFetchBatch`, `latestMetrics`, `latestCommentCount`;
- read `PostSnapshotRepository.listByPost()` for history;
- read enhanced `CommentSnapshotRepository.listByPostPaged()` for comments.

Use one explicit parser helper for the three planned platforms:

```ts
private extractPostId(platform: string, postUrl: string, explicitPostId?: string) {
  if (explicitPostId) return explicitPostId

  const url = new URL(postUrl)
  if (platform === 'xhs') {
    const match = url.pathname.match(/\/(?:explore|discovery\/item)\/([^/?#]+)/)
    if (match?.[1]) return match[1]
  }

  if (platform === 'douyin') {
    const modalId = url.searchParams.get('modal_id')
    if (modalId) return modalId
    const match = url.pathname.match(/\/video\/([^/?#]+)/)
    if (match?.[1]) return match[1]
  }

  if (platform === 'kwai') {
    const photoId = url.searchParams.get('photoId') || url.searchParams.get('photo_id')
    if (photoId) return photoId
    const match = url.pathname.match(/\/short-video\/([^/?#]+)/)
    if (match?.[1]) return match[1]
  }

  throw new BadRequestException('Cannot parse postId from postUrl; pass postId explicitly.')
}
```

- [ ] **Step 5: Enhance snapshot repositories**

Add to `PostSnapshotRepository`:

```ts
async findLatest(accountId: string, platform: string, postId: string) {
  return await this.findOne({ accountId, platform, postId }, { sort: { fetchedAt: -1 } })
}
```

Add to `CommentSnapshotRepository`:

```ts
async listByPostPaged(filter: {
  accountId: string
  platform: string
  postId: string
  keyword?: string
  parentCommentId?: string
  dataSource?: string
  fetchBatch?: string
  page: number
  pageSize: number
}) {
  const query: Record<string, unknown> = {
    accountId: filter.accountId,
    platform: filter.platform,
    postId: filter.postId,
  }
  if (filter.keyword) query.content = { $regex: filter.keyword, $options: 'i' }
  if (filter.parentCommentId !== undefined) query.parentCommentId = filter.parentCommentId
  if (filter.dataSource) query.dataSource = filter.dataSource
  if (filter.fetchBatch) query.fetchBatch = filter.fetchBatch

  const skip = (filter.page - 1) * filter.pageSize
  const [items, total] = await Promise.all([
    this.commentSnapshotModel.find(query).sort({ commentedAt: -1, likeCount: -1 }).skip(skip).limit(filter.pageSize).lean(),
    this.commentSnapshotModel.countDocuments(query),
  ])
  return { items, total, page: filter.page, pageSize: filter.pageSize }
}
```

- [ ] **Step 6: Register module**

In `acquisition.module.ts`:

```ts
import { WorkDataController } from './work-data/work-data.controller'
import { WorkDataService } from './work-data/work-data.service'

controllers: [
  AcquisitionController,
  AcquisitionContentController,
  WorkDataController,
],
providers: [
  WorkDataService,
]
```

- [ ] **Step 7: Verify backend tests**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/work-data/work-data.service.spec.ts
pnpm nx run aitoearn-server:build
```

Expected: tests and build pass.

---

## Task 3: Integrate Published Content Backfill

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/workers/acquisition-post-backfill.consumer.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.service.ts`
- Inspect existing publish completion flow before editing:
  - `project/aitoearn-backend/apps/aitoearn-server/src/core/channel/publishing`
  - `project/aitoearn-backend/apps/aitoearn-server/src/core/channel/publish.service.ts`

- [ ] **Step 1: Write failing worker/service test**

Test that a published post with `postUrl` becomes a monitored post:

```ts
it('creates monitored post from published backfill job', async () => {
  await service.upsertFromPublishedBackfill({
    userId: 'user-1',
    platform: 'xhs',
    accountId: 'account-1',
    postUrl: 'https://www.xiaohongshu.com/explore/post-1',
    postId: 'post-1',
  })

  const result = await monitoredPostRepository.findByIdentity('user-1', 'xhs', 'account-1', 'post-1')
  expect(result?.source).toBe('published_backfill')
})
```

- [ ] **Step 2: Add `upsertFromPublishedBackfill()`**

```ts
async upsertFromPublishedBackfill(data: {
  userId: string
  platform: string
  accountId: string
  postUrl: string
  postId?: string
}) {
  const postId = this.extractPostId(data.platform, data.postUrl, data.postId)
  return await this.monitoredPostRepository.upsertByIdentity({
    userId: data.userId,
    platform: data.platform,
    accountId: data.accountId,
    postId,
    postUrl: data.postUrl,
    source: 'published_backfill',
    monitorStatus: 'active',
    fetchStatus: 'idle',
  })
}
```

- [ ] **Step 3: Wire the post-backfill consumer**

When `AcquisitionPostBackfillConsumer` receives a job with resolved `postUrl`, call `upsertFromPublishedBackfill()`. If post URL is not available yet, keep the job retry/backoff path and set a clear failure reason.

- [ ] **Step 4: Verify**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/work-data/work-data.service.spec.ts
pnpm nx run aitoearn-server:build
```

Expected: published backfill test passes.

---

## Task 4: Respect Phase 2 Account Operation Strategy

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.service.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/acquisition-content.dto.ts` only if existing DTO lacks fields already in Phase 2 plan.
- Use existing repository: `AccountOpsConfigRepository`
- Use new repository from Task 1: `MonitoredPostFetchLogRepository`

- [ ] **Step 1: Write failing test for disabled comment fetch**

```ts
it('does not fetch when account config disables comment fetch', async () => {
  accountOpsConfigRepository.getByAccountId.mockResolvedValue({
    accountId: 'account-1',
    enableCommentFetch: false,
  })

  const result = await service.fetchNow('user-1', 'monitored-post-id')

  expect(result.fetchStatus).toBe('not_configured')
  expect(acquisitionService.fetchNow).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Add config guard**

Before fetching:

```ts
const config = await this.accountOpsConfigRepository.getByAccountId(post.accountId)
if (config && config.enableCommentFetch === false) {
  const updated = await this.monitoredPostRepository.updateFetchResult(post.id, {
    fetchStatus: 'not_configured',
    capabilityReason: 'Comment fetch is disabled by account operation config',
  })
  await this.monitoredPostFetchLogRepository.record({
    userId,
    monitoredPostId: post.id,
    accountId: post.accountId,
    platform: post.platform,
    fetchStatus: 'not_configured',
    reason: 'Comment fetch is disabled by account operation config',
  })
  return updated
}
```

- [ ] **Step 3: Apply daily fetch limit**

Use `MonitoredPostFetchLogRepository` instead of `MonitoredPost.lastFetchedAt`; the latter only stores the latest fetch and cannot count same-day attempts.

```ts
if (config?.dailyCommentFetchLimit !== undefined && config.dailyCommentFetchLimit >= 0) {
  const startOfUtcDay = new Date()
  startOfUtcDay.setUTCHours(0, 0, 0, 0)
  const usedToday = await this.monitoredPostFetchLogRepository.countAccountFetchesSince(userId, post.accountId, startOfUtcDay)

  if (usedToday >= config.dailyCommentFetchLimit) {
    const reason = 'daily comment fetch limit reached'
    const updated = await this.monitoredPostRepository.updateFetchResult(post.id, {
      fetchStatus: 'not_configured',
      capabilityReason: reason,
    })
    await this.monitoredPostFetchLogRepository.record({
      userId,
      monitoredPostId: post.id,
      accountId: post.accountId,
      platform: post.platform,
      fetchStatus: 'not_configured',
      reason,
    })
    return updated
  }
}
```

- [ ] **Step 4: Verify**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/work-data/work-data.service.spec.ts
```

Expected: account strategy guard tests pass.

---

## Task 5: Add Frontend Work Data API Client

**Files:**
- Create: `project/aitoearn-web/src/api/workData.ts`

- [ ] **Step 1: Add API types and wrappers**

```ts
import http from '@/utils/request'
import type { AcquisitionDataSource, AcquisitionPlatform } from './acquisition'

export type MonitoredPostStatus = 'active' | 'paused' | 'failed' | 'archived'
export type MonitoredPostFetchStatus = 'idle' | 'fetching' | 'ready' | 'failed' | 'permission_required' | 'not_configured' | 'pending_confirmation'

export interface MonitoredPostItem {
  id: string
  userId: string
  platform: AcquisitionPlatform
  accountId: string
  postId: string
  postUrl: string
  title: string
  cover: string
  source: 'manual' | 'published_backfill' | 'demo_seed'
  monitorStatus: MonitoredPostStatus
  fetchStatus: MonitoredPostFetchStatus
  capabilityReason: string
  latestMetrics: Record<string, number>
  latestCommentCount: number
  lastFetchedAt?: string
  updatedAt?: string
}

export interface WorkDataListResponse {
  items: MonitoredPostItem[]
  total: number
  page: number
  pageSize: number
}

export interface WorkCommentItem {
  id: string
  commentId: string
  parentCommentId: string
  userName: string
  userAvatar: string
  content: string
  likeCount: number
  ipLocation: string
  commentedAt?: string
  fetchBatch: string
  dataSource: AcquisitionDataSource | string
}

export async function listMonitoredPosts(params: Record<string, string | number | undefined>) {
  const response = await http.get<WorkDataListResponse>('acquisition/work-data/monitored-posts', params)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'list monitored posts failed')
  return response.data
}

export async function createMonitoredPost(data: { platform: AcquisitionPlatform, accountId: string, postUrl: string, postId?: string }) {
  const response = await http.post<MonitoredPostItem>('acquisition/work-data/monitored-posts', data)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'create monitored post failed')
  return response.data
}

export async function fetchMonitoredPost(id: string) {
  const response = await http.post<MonitoredPostItem>(`acquisition/work-data/monitored-posts/${id}/fetch`)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'fetch monitored post failed')
  return response.data
}

export async function listMonitoredPostComments(id: string, params: Record<string, string | number | undefined>) {
  const response = await http.get<{ items: WorkCommentItem[], total: number, page: number, pageSize: number }>(
    `acquisition/work-data/monitored-posts/${id}/comments`,
    params,
  )
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'list monitored post comments failed')
  return response.data
}
```

- [ ] **Step 2: Type-check**

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: type check passes.

---

## Task 6: Replace `/work-data` Roadmap with Real Page

**Files:**
- Modify: `project/aitoearn-web/src/app/[lng]/work-data/page.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/work-data/WorkDataPage/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/work-data/components/PostMonitorToolbar/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/work-data/components/AddMonitoredPostDialog/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/work-data/components/MonitoredPostTable/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/work-data/components/PostDetailDrawer/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/work-data/components/DataSourceBadge/index.tsx`
- Modify: `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json`
- Modify: `project/aitoearn-web/src/app/i18n/locales/en/route.json`

- [ ] **Step 1: Mount new page**

```tsx
import WorkDataPage from './WorkDataPage'

export default function Page() {
  return <WorkDataPage />
}
```

- [ ] **Step 2: Add page layout**

`WorkDataPage/index.tsx` should render:

- header with title, description, and add button;
- summary cards: monitored post count, ready/failed count, comments count, pending capability count;
- filter toolbar;
- monitored post table;
- detail drawer with tabs for snapshots/comments/logs.

Use dense operational styling, not marketing cards.

- [ ] **Step 3: Add table columns**

Columns:

- 作品：cover + title + postUrl;
- 平台/账号;
- 来源;
- 监控状态;
- 抓取状态;
- 最新指标;
- 评论数;
- 最近抓取时间;
- 操作：抓取、查看详情、暂停/恢复.

- [ ] **Step 4: Add detail drawer**

The drawer should include:

- post snapshot summary;
- metrics grid;
- comment list with pagination and keyword filter;
- data source badge per snapshot/comment;
- fetch batch visible in comment row.

- [ ] **Step 5: Add source badge mapping**

Reuse and replace the existing `acquisition.pages.workData.*` keys in `route.json`; do not create a second parallel key tree for the same `/work-data` page. After `AcquisitionRoadmapPage` no longer renders `workData`, remove any `workData` roadmap-only keys that are no longer referenced.

```ts
const sourceLabelMap = {
  xhs_plugin_api: '小红书插件接口',
  xhs_bridge_capture: 'Bridge 页面捕获',
  douyin_open_api: '抖音 OpenAPI',
  manual_snapshot: '人工快照',
  demo_seed: '演示数据',
}
```

Also add English labels in `en/route.json`.

- [ ] **Step 6: Verify frontend**

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: type check passes.

---

## Task 7: Improve Platform Capability UX

**Files:**
- Modify: `project/aitoearn-web/src/app/[lng]/work-data/WorkDataPage/index.tsx`
- Modify: `project/aitoearn-web/src/app/[lng]/work-data/components/PostMonitorToolbar/index.tsx`
- Modify: `project/aitoearn-web/src/api/acquisition.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/comment-capability.service.ts` only if returned status is missing display metadata.

- [ ] **Step 1: Add capability panel**

Show three platform rows:

- 小红书：插件/Bridge connected or not configured.
- 抖音：ready / permission required for `item.comment`.
- 快手：pending confirmation.

- [ ] **Step 2: Add guarded CTA**

For `permission_required`, show a CTA text:

```ts
'当前账号缺少评论读取权限，请在平台开放后台申请 item.comment 后重新授权。'
```

For XHS not configured:

```ts
'请先安装并连接浏览器插件，或启动本地 XHS Bridge。'
```

For Kwai pending:

```ts
'快手评论读取能力待确认，当前仅允许记录监控作品，不执行真实评论抓取。'
```

- [ ] **Step 3: Verify states manually**

Use `/acquisition/capability?platform=xhs&accountId=...`, `/douyin`, `/kwai` and confirm UI labels match backend status.

---

## Task 8: Worker and Manual Fetch Behavior

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/workers/acquisition-comment-fetch.consumer.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.service.ts`

- [ ] **Step 1: Ensure manual fetch sets `fetching` first**

Before calling provider:

```ts
await this.monitoredPostRepository.updateFetchResult(post.id, {
  fetchStatus: 'fetching',
  capabilityReason: '',
})
```

- [ ] **Step 2: Ensure all result states update monitored post**

Map acquisition result:

| Capability | `fetchStatus` |
|---|---|
| `ready` | `ready` |
| `permission_required` | `permission_required` |
| `not_configured` | `not_configured` |
| `pending_confirmation` | `pending_confirmation` |
| `failed` | `failed` |

- [ ] **Step 3: Queue fetch uses monitored-post ID**

When adding future queued fetch support, include monitored-post ID in the queue payload or re-resolve by `platform/accountId/postId`.

- [ ] **Step 4: Verify worker**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/workers/acquisition-comment-fetch.consumer.spec.ts
```

Expected: consumer updates monitored-post status after success/failure.

---

## Task 9: End-to-End Verification

- [ ] **Backend build**

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build passes.

- [ ] **Frontend type check**

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: type check passes.

- [ ] **Manual browser verification**

Open:

```text
http://127.0.0.1:6061/zh-CN/work-data
```

Verify:

- Page is no longer a roadmap placeholder.
- User can add a monitored post manually.
- List shows monitored post with source `manual`.
- Clicking fetch updates fetch status.
- Detail drawer shows snapshots and comments.
- Comment rows show data source and fetch batch.
- XHS/Douyin/Kwai capability states are visible.

- [ ] **API smoke test**

```bash
curl -s 'http://127.0.0.1:7001/api/acquisition/work-data/monitored-posts?page=1&pageSize=20'
```

Expected: response has `items`, `total`, `page`, `pageSize`.

---

## Implementation Order

1. Task 1: `MonitoredPost` schema and repository.
2. Task 2: backend Work Data APIs.
3. Task 3: published content backfill into monitored posts.
4. Task 4: account operation strategy guards.
5. Task 5: frontend API client.
6. Task 6: real `/work-data` page.
7. Task 7: capability UX.
8. Task 8: worker/manual fetch status hardening.
9. Task 9: verification.

## Non-Goals

- Do not implement Phase 3 lead materialization in this plan.
- Do not implement public comment reply execution here.
- Do not replace the existing publishing calendar.
- Do not remove old `/xhs-data`; only stop depending on it for Work Data.
- Do not claim Kwai comment fetch is ready until platform capability is confirmed.

## Acceptance Criteria

- `/work-data` is a real operational page, not a feature roadmap.
- Monitored posts can come from manual input and published-content backfill.
- Every monitored post has platform, account, post URL, source, status, latest fetch info.
- Post snapshot history and paginated comments are visible in UI.
- Comments show data source and fetch batch.
- XHS, Douyin, and Kwai capability states are explicit.
- Account operation config can disable or limit fetch behavior.
- Backend and frontend verification commands pass.
