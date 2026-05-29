# Leads Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/leads` roadmap page with a real lead-tracking workspace that turns fetched comments and later private messages into assignable leads, supports stage/status operations, AI reply suggestions, and an auditable timeline.

**Architecture:** Build `leads` as a focused sub-domain inside the existing `acquisition` module. The backend owns lead materialization from authorized `monitored_post` records plus their `comment_snapshot` rows, lead CRUD/state transitions, assignment logs, AI suggestion generation, safety checks, and reply-result records; the frontend owns the operator UI at `/[lng]/leads`, using existing `work-data` comments as the first real data source and showing private-message capability status instead of pretending unsupported platforms are ready.

**Tech Stack:** NestJS, Mongoose repositories from `@yikart/channel-db`, Zod DTOs with `createZodDto`, `@ApiDoc`, existing `SensitiveWordService`, existing `@yikart/aitoearn-ai-client`, Next.js App Router, `http.get`/`http.post` request helpers, Ant Design, Tailwind, Lucide/Ant icons, pnpm, Nx, Vitest.

---

## Current State

- `/zh-CN/leads` currently renders `AcquisitionRoadmapPage type="leads"` from `project/aitoearn-web/src/app/[lng]/leads/page.tsx`.
- `work-data` already has real monitored-post and comment snapshot APIs:
  - `GET /acquisition/work-data/monitored-posts`
  - `GET /acquisition/work-data/monitored-posts/:id/comments`
- `comment_snapshot` stores `platform`, `accountId`, `postId`, `commentId`, `parentCommentId`, `userName`, `userAvatar`, `content`, `likeCount`, `commentedAt`, `fetchBatch`, and `dataSource`.
- `comment_snapshot` does not store `userId`. Lead materialization must never query it as a global source; it must first resolve current-user-owned monitored posts or account ownership, then query comments by that authorized `{ platform, accountId, postId }` identity.
- `lead` and `lead_activity_log` schemas exist, but they are too thin for production use:
  - `lead` has no `userId`, `sourceType`, `sourceContent`, `userAvatar`, `suggestedReply`, or `lastReplyRecordId`.
  - `LeadRepository` and `LeadActivityLogRepository` only inherit `BaseRepository`.
- `replyCommentRecord` exists for comment reply history, but it is not linked to leads and has no explicit execution status.

## MVP Scope

This plan builds a useful first version:

1. Public-comment leads from `comment_snapshot`.
2. Lead list filters: platform, account, work, stage, status, assignee, keyword.
3. Lead detail drawer: source comment, work context, suggested reply, timeline.
4. Assignment flow: claim, assign, transfer, batch assign.
5. Stage flow: new comment, replied, messaged, WeChat guided, WeChat added, lost.
6. AI reply suggestion with sensitive-word blocking before public reply use.
7. Reply execution result recording, with XHS/Douyin/Kwai shown as `manual_required` in capability/preflight status until concrete platform reply adapters are available.
8. Private-message section shows real capability state and an empty-state guide; direct private-message ingestion is not claimed as ready in this plan.

## File Structure

| File | Responsibility |
|---|---|
| `project/aitoearn-backend/libs/channel-db/src/schemas/lead.schema.ts` | Extend lead source, ownership, reply suggestion fields, and dedupe indexes. |
| `project/aitoearn-backend/libs/channel-db/src/schemas/lead-activity-log.schema.ts` | Add actions for materialization, batch assignment, suggestion, reply result, and private-message placeholder events. |
| `project/aitoearn-backend/libs/channel-db/src/schemas/reply-comment-record.schema.ts` | Link reply results to leads and store execution status/failure reason. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/lead.repository.ts` | Add list, get-by-user, upsert-from-comment, assignment, stage, and suggestion helpers. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/lead-activity-log.repository.ts` | Add append/list helpers for lead timeline. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/comment-snapshot.repository.ts` | Add query helper for comment lead materialization by one already-authorized monitored post identity. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/acquisition-leads.dto.ts` | Zod DTOs for list/materialize/assignment/stage/note/suggestion/reply APIs. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-materialization.service.ts` | Convert snapshots into deduped leads. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-management.service.ts` | Lead list/detail/state/assignment/timeline behavior. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-suggestion.service.ts` | Generate safe reply suggestions and persist suggestion status. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-execution.service.ts` | Prepare/record reply execution results. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/acquisition-leads.controller.ts` | `/acquisition/leads/*` authenticated REST endpoints. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts` | Register lead services/controller. |
| `project/aitoearn-web/src/api/leads.ts` | Frontend API wrappers for lead endpoints. |
| `project/aitoearn-web/src/app/[lng]/leads/page.tsx` | Replace roadmap page with `LeadsPage`. |
| `project/aitoearn-web/src/app/[lng]/leads/LeadsPage/index.tsx` | Page composition, stats, filters, table, drawer state. |
| `project/aitoearn-web/src/app/[lng]/leads/components/LeadToolbar/index.tsx` | Filters, materialize button, batch assignment entry. |
| `project/aitoearn-web/src/app/[lng]/leads/components/LeadTable/index.tsx` | Main lead list with row selection and quick actions. |
| `project/aitoearn-web/src/app/[lng]/leads/components/LeadDetailDrawer/index.tsx` | Detail, source comment, suggestion composer, timeline. |
| `project/aitoearn-web/src/app/[lng]/leads/components/LeadStageTag/index.tsx` | Shared stage/status display. |
| `project/aitoearn-web/src/app/[lng]/leads/components/PrivateMessageStatusPanel/index.tsx` | Honest private-message capability/status panel. |
| `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json` | Add lead page labels. |
| `project/aitoearn-web/src/app/i18n/locales/en/route.json` | Add English lead page labels. |

## API Contract

Backend route prefix: `@Controller('/acquisition/leads')`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | List leads with filters and pagination. |
| `GET` | `/private-message/capability` | Return DM capability status by platform/account. |
| `POST` | `/materialize` | Create/update leads from existing comment snapshots. |
| `PATCH` | `/batch-assignee` | Batch assign selected leads. |
| `GET` | `/:id` | Get lead detail. |
| `GET` | `/:id/timeline` | Get lead activity timeline. |
| `POST` | `/:id/claim` | Assign current user as owner. |
| `PATCH` | `/:id/assignee` | Assign or transfer a lead. |
| `PATCH` | `/:id/stage` | Change funnel stage and derived status. |
| `POST` | `/:id/notes` | Append an operator note to the timeline. |
| `POST` | `/:id/reply-suggestion` | Generate and persist a safe public reply suggestion. |
| `POST` | `/:id/reply-result` | Record platform/manual reply execution result. |

## Data Rules

- Every lead must store `userId`; all list/detail/update queries filter by current `token.id`.
- `comment_snapshot` has no `userId`; every materialization request must resolve monitored posts with `MonitoredPostRepository` under the current `token.id` before reading comments.
- Public-comment lead identity is `{ userId, platform, accountId, postId, commentId, parentCommentId }`. Enforce it with a compound unique index on `lead`; single-field indexes are not enough for atomic upsert dedupe.
- `stage` is the funnel position. `status` is the working state:
  - `new_comment` -> `pending`
  - `replied`, `messaged`, `wechat_guided` -> `in_progress`
  - `wechat_added` -> `converted`
  - `lost` -> `lost`
- Public reply suggestions must pass `SensitiveWordService.check()`. If a suggestion hits phone, URL, WeChat, or configured sensitive words, store it as `blocked` and do not offer one-click public reply.
- `invalid` is a reserved/manual status for later moderation or operator invalidation flows. Normal stage transitions in this MVP must not derive `invalid` from `STAGE_STATUS_MAP`.
- Private-message capabilities are represented as status, not fake data:
  - `ready` when a provider exists and account credentials are valid.
  - `manual_required` when platform only supports manual operation.
  - `permission_required` when official scope is missing.
  - `not_supported` when the platform has no available DM route.

## Tasks

### Task 1: Extend Lead Storage

**Files:**
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/lead.schema.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/lead-activity-log.schema.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/reply-comment-record.schema.ts`

- [ ] **Step 1: Add lead source and suggestion fields**

Add these enums/classes to `lead.schema.ts`:

```ts
export enum LeadSourceType {
  PublicComment = 'public_comment',
  PrivateMessage = 'private_message',
  Manual = 'manual',
}

export enum LeadSuggestionStatus {
  Empty = 'empty',
  Generated = 'generated',
  Blocked = 'blocked',
  Edited = 'edited',
}

@Schema({ _id: false })
export class LeadSuggestedReply {
  @Prop({ type: String, default: '' })
  content: string

  @Prop({ type: String, default: '' })
  model: string

  @Prop({ required: true, enum: LeadSuggestionStatus, default: LeadSuggestionStatus.Empty, type: String })
  status: LeadSuggestionStatus

  @Prop({ type: [String], default: [] })
  riskHits: string[]

  @Prop({ type: Date, default: null })
  generatedAt?: Date
}

export const LeadSuggestedReplySchema = SchemaFactory.createForClass(LeadSuggestedReply)
```

Add these fields to `Lead`:

```ts
@Prop({ required: true, index: true, type: String })
userId: string

@Prop({ required: true, enum: LeadSourceType, default: LeadSourceType.PublicComment, index: true, type: String })
sourceType: LeadSourceType

@Prop({ type: String, default: '' })
userAvatar: string

@Prop({ type: String, default: '' })
sourceContent: string

@Prop({ type: String, default: '', index: true })
parentCommentId: string

@Prop({ type: LeadSuggestedReplySchema, default: () => ({}) })
suggestedReply: LeadSuggestedReply

@Prop({ type: String, default: '' })
lastReplyRecordId: string
```

After creating `LeadSchema`, add the compound unique index used by comment materialization:

```ts
LeadSchema.index(
  { userId: 1, platform: 1, accountId: 1, postId: 1, commentId: 1, parentCommentId: 1 },
  { unique: true, name: 'uniq_lead_public_comment_identity' },
)
```

If an existing environment already has duplicate `lead` rows, clean or merge duplicates before enabling this unique index.

- [ ] **Step 2: Add activity actions**

Extend `LeadActivityAction`:

```ts
Materialized = 'materialized',
BatchAssigned = 'batch_assigned',
ReplySuggested = 'reply_suggested',
ReplyExecuted = 'reply_executed',
ReplyFailed = 'reply_failed',
PrivateMessageStatusChecked = 'private_message_status_checked',
```

Add `userId` to `LeadActivityLog` so timelines can be queried with a direct ownership filter, not only through a prior lead lookup:

```ts
@Prop({ required: true, index: true, type: String })
userId: string
```

- [ ] **Step 3: Link reply records to leads**

Add these optional fields to `ReplyCommentRecord`:

```ts
@Prop({ type: String, default: '', index: true })
leadId: string

@Prop({ type: String, enum: ['xhs', 'douyin', 'kwai'], default: '', index: true })
platform: string

@Prop({ type: String, enum: ['success', 'failed'], default: 'success', index: true })
status: 'success' | 'failed'

@Prop({ type: String, enum: ['manual', 'platform_adapter'], default: 'manual', index: true })
executionMode: 'manual' | 'platform_adapter'

@Prop({ type: String, default: '' })
failureReason: string
```

- [ ] **Step 4: Run schema type check**

Run:

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: TypeScript build reaches Nest compile without schema type errors.

### Task 2: Add Lead Repositories

**Files:**
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/lead.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/lead-activity-log.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/comment-snapshot.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/reply-comment-record.repository.ts`

- [ ] **Step 1: Add lead list/upsert helpers**

Implement public methods on `LeadRepository`. Keep the injected model as a repository field (`private readonly leadModel`) so helpers that need atomic upsert can use the concrete Mongoose model while still inheriting shared `BaseRepository` helpers:

```ts
@Injectable()
export class LeadRepository extends BaseRepository<Lead> {
  constructor(
    @InjectModel(Lead.name, DB_CONNECTION_NAME) private readonly leadModel: Model<Lead>,
  ) {
    super(leadModel)
  }

async listByUser(userId: string, filter: {
  platform?: string
  accountId?: string
  postId?: string
  stage?: string
  status?: string
  assignee?: string
  keyword?: string
  page: number
  pageSize: number
}) {
  const query: Record<string, unknown> = { userId }
  if (filter.platform) query.platform = filter.platform
  if (filter.accountId) query.accountId = filter.accountId
  if (filter.postId) query.postId = filter.postId
  if (filter.stage) query.stage = filter.stage
  if (filter.status) query.status = filter.status
  if (filter.assignee !== undefined) query.assignee = filter.assignee
  if (filter.keyword) {
    query.$or = [
      { userName: { $regex: filter.keyword, $options: 'i' } },
      { sourceContent: { $regex: filter.keyword, $options: 'i' } },
    ]
  }
  return await this.findWithPagination({
    page: filter.page,
    pageSize: filter.pageSize,
    filter: query,
    options: { sort: { lastFollowUpAt: -1, updatedAt: -1 } },
  })
}

async getByIdAndUser(id: string, userId: string) {
  return await this.findOne({ _id: id, userId } as any)
}

async upsertFromComment(input: {
  userId: string
  platform: string
  accountId: string
  postId: string
  commentId: string
  parentCommentId: string
  userName: string
  userAvatar: string
  sourceContent: string
}): Promise<{ lead: Lead | null; created: boolean }> {
  const identity = {
    userId: input.userId,
    platform: input.platform,
    accountId: input.accountId,
    postId: input.postId,
    commentId: input.commentId,
    parentCommentId: input.parentCommentId || '',
  }

  const result = await this.leadModel.findOneAndUpdate(
    identity,
    {
      $setOnInsert: {
        ...input,
        sourceType: 'public_comment',
        stage: 'new_comment',
        status: 'pending',
        lastFollowUpAt: new Date(),
      },
      $set: {
        userName: input.userName,
        userAvatar: input.userAvatar,
        sourceContent: input.sourceContent,
      },
    } as any,
    {
      new: true,
      upsert: true,
      includeResultMetadata: true,
    } as any,
  ).lean({ virtuals: true }).exec() as any

  const value = result?.value || null
  const lead = value ? { ...value, id: value.id || String(value._id) } : null

  return {
    lead,
    created: Boolean(result?.lastErrorObject?.upserted),
  }
}
}
```

- [ ] **Step 2: Add timeline helpers**

Implement in `LeadActivityLogRepository`:

```ts
async append(data: {
  userId: string
  leadId: string
  action: string
  operatorId: string
  fromValue?: string
  toValue?: string
  note?: string
}) {
  return await this.create({
    userId: data.userId,
    leadId: data.leadId,
    action: data.action as any,
    operatorId: data.operatorId,
    fromValue: data.fromValue || '',
    toValue: data.toValue || '',
    note: data.note || '',
  })
}

async listByLeadId(userId: string, leadId: string, limit = 100) {
  return await this.find({ userId, leadId } as any, { sort: { createdAt: -1 }, limit })
}
```

- [ ] **Step 3: Add comment snapshot materialization query**

Implement in `CommentSnapshotRepository`:

```ts
async listForLeadMaterializationByPost(filter: {
  platform: string
  accountId: string
  postId: string
  fetchBatch?: string
  limit: number
}) {
  const query: Record<string, unknown> = {
    platform: filter.platform,
    accountId: filter.accountId,
    postId: filter.postId,
  }
  if (filter.fetchBatch) query.fetchBatch = filter.fetchBatch
  return await this.find(query, {
    sort: { commentedAt: -1, createdAt: -1 },
    limit: filter.limit,
  })
}
```

- [ ] **Step 4: Add reply result helper**

Implement in `ReplyCommentRecordRepository`:

```ts
import { AccountType } from '@yikart/common'

async addLeadReplyResult(data: Partial<ReplyCommentRecord> & {
  userId: string
  accountId: string
  leadId: string
  platform: string
  type: AccountType
  commentId: string
  commentContent: string
  replyContent: string
  status: 'success' | 'failed'
  executionMode: 'manual' | 'platform_adapter'
}) {
  return await this.add(data)
}
```

- [ ] **Step 5: Run repository specs**

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run libs/channel-db/src/repositories/comment-snapshot.repository.spec.ts
pnpm nx run aitoearn-server:build
```

Expected: tests pass and build succeeds.

### Task 3: Add Backend Lead APIs

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/acquisition-leads.dto.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-materialization.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-management.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-suggestion.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-execution.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/acquisition-leads.controller.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts`
- Modify: `project/aitoearn-backend/libs/common/src/enums/response-code.enum.ts`
- Modify: `project/aitoearn-backend/libs/common/src/i18n/messages.ts`

- [ ] **Step 1: Add response codes**

Add:

```ts
LeadNotFound = 18620,
LeadReplyBlocked = 18621,
LeadStageInvalid = 18622,
```

Add messages:

```ts
[ResponseCode.LeadNotFound]: {
  'en-US': 'Lead not found',
  'zh-CN': '线索未找到',
},
[ResponseCode.LeadReplyBlocked]: {
  'en-US': 'Lead reply was blocked by safety rules',
  'zh-CN': '回复内容命中安全规则，已阻止',
},
[ResponseCode.LeadStageInvalid]: {
  'en-US': 'Invalid lead stage',
  'zh-CN': '线索阶段无效',
},
```

- [ ] **Step 2: Create DTOs**

Use Zod DTOs:

```ts
import { createZodDto } from '@yikart/common'
import { z } from 'zod'

export const LeadListQuerySchema = z.object({
  platform: z.string().optional(),
  accountId: z.string().optional(),
  postId: z.string().optional(),
  stage: z.enum(['new_comment', 'replied', 'messaged', 'wechat_guided', 'wechat_added', 'lost']).optional(),
  status: z.enum(['pending', 'in_progress', 'converted', 'lost', 'invalid']).optional(),
  assignee: z.string().optional(),
  keyword: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export class LeadListQueryDto extends createZodDto(LeadListQuerySchema, 'LeadListQueryDto') {}

export const MaterializeLeadsSchema = z.object({
  monitoredPostId: z.string().optional(),
  platform: z.enum(['xhs', 'douyin', 'kwai']).optional(),
  accountId: z.string().optional(),
  postId: z.string().optional(),
  fetchBatch: z.string().optional(),
  postLimit: z.coerce.number().int().min(1).max(100).default(20),
  commentLimit: z.coerce.number().int().min(1).max(500).default(100),
  totalCommentLimit: z.coerce.number().int().min(1).max(500).default(100),
})

export class MaterializeLeadsDto extends createZodDto(MaterializeLeadsSchema, 'MaterializeLeadsDto') {}

export class UpdateLeadAssigneeDto extends createZodDto(
  z.object({ assignee: z.string().default('') }),
  'UpdateLeadAssigneeDto',
) {}

export class BatchAssignLeadsDto extends createZodDto(
  z.object({ leadIds: z.array(z.string()).min(1).max(100), assignee: z.string().default('') }),
  'BatchAssignLeadsDto',
) {}

export class UpdateLeadStageDto extends createZodDto(
  z.object({ stage: z.enum(['new_comment', 'replied', 'messaged', 'wechat_guided', 'wechat_added', 'lost']) }),
  'UpdateLeadStageDto',
) {}

export class AddLeadNoteDto extends createZodDto(
  z.object({ note: z.string().min(1).max(1000) }),
  'AddLeadNoteDto',
) {}

export class ReplyResultDto extends createZodDto(
  z.object({
    replyContent: z.string().min(1).max(1000),
    status: z.enum(['success', 'failed']),
    executionMode: z.enum(['manual', 'platform_adapter']).default('manual'),
    failureReason: z.string().optional(),
  }),
  'ReplyResultDto',
) {}

export class PrivateMessageCapabilityQueryDto extends createZodDto(
  z.object({
    platform: z.enum(['xhs', 'douyin', 'kwai']).optional(),
    accountId: z.string().optional(),
  }),
  'PrivateMessageCapabilityQueryDto',
) {}
```

- [ ] **Step 3: Implement materialization service**

`LeadMaterializationService.materialize(userId, dto, operatorId)` must resolve current-user-owned monitored posts before reading comments. Do not query `comment_snapshot` directly from request filters, because `comment_snapshot` has no `userId`.

```ts
let monitoredPosts: Array<MonitoredPost | null> = []

if (dto.monitoredPostId) {
  const post = await this.monitoredPostRepository.getByIdAndUser(dto.monitoredPostId, userId)
  if (!post) throw new AppException(ResponseCode.MonitoredPostNotFound)
  monitoredPosts = [post]
} else {
  // MonitoredPostRepository.listWithPagination returns a [list, total] tuple in this codebase.
  const [posts] = await this.monitoredPostRepository.listWithPagination(userId, {
    ...(dto.platform && { platform: dto.platform }),
    ...(dto.accountId && { accountId: dto.accountId }),
    ...(dto.postId && { postId: dto.postId }),
    monitorStatus: 'active',
  }, 1, dto.postLimit)
  monitoredPosts = posts
}

const resolvedMonitoredPosts = monitoredPosts.filter((post): post is MonitoredPost => Boolean(post))

let createdOrUpdated = 0
let totalScanned = 0
let remainingComments = dto.totalCommentLimit

for (const post of resolvedMonitoredPosts) {
  if (remainingComments <= 0) break

  const comments = await this.commentSnapshotRepository.listForLeadMaterializationByPost({
    platform: post.platform,
    accountId: post.accountId,
    postId: post.postId,
    fetchBatch: dto.fetchBatch,
    limit: Math.min(dto.commentLimit, remainingComments),
  })

  totalScanned += comments.length
  remainingComments -= comments.length

  for (const comment of comments) {
    const result = await this.leadRepository.upsertFromComment({
      userId,
      platform: comment.platform,
      accountId: comment.accountId,
      postId: comment.postId,
      commentId: comment.commentId,
      parentCommentId: comment.parentCommentId || '',
      userName: comment.userName || '',
      userAvatar: comment.userAvatar || '',
      sourceContent: comment.content || '',
    })

    if (result?.lead?.id) {
      createdOrUpdated += 1
      if (result.created) {
        await this.leadActivityLogRepository.append({
          userId,
          leadId: result.lead.id,
          action: 'materialized',
          operatorId,
          note: `Materialized from comment ${comment.commentId}`,
        })
      }
    }
  }
}

return { totalScanned, materialized: createdOrUpdated }
```

`LeadRepository.upsertFromComment()` should return `{ lead, created }`. Use `includeResultMetadata` and `lastErrorObject.upserted` for `created` so concurrent materialization of the same comment does not append duplicate `materialized` timeline entries. Add a unit test that asserts the first call returns `created: true`, the second call returns `created: false`, and only one materialization log is appended.

- [ ] **Step 4: Implement stage/status transitions**

In `LeadManagementService`, use this mapping:

```ts
const STAGE_STATUS_MAP = {
  new_comment: 'pending',
  replied: 'in_progress',
  messaged: 'in_progress',
  wechat_guided: 'in_progress',
  wechat_added: 'converted',
  lost: 'lost',
} as const
```

Every mutating method must:

1. Load by `{ _id, userId }`.
2. Throw `new AppException(ResponseCode.LeadNotFound)` when missing.
3. Update the lead.
4. Append `LeadActivityLog`.

- [ ] **Step 5: Implement reply suggestion**

First implementation can use deterministic prompt rules through the AI client. It must load the lead by current user before generating or saving anything:

```ts
const lead = await this.leadRepository.getByIdAndUser(id, userId)
if (!lead) throw new AppException(ResponseCode.LeadNotFound)
```

Before saving a usable suggestion:

```ts
const safety = this.sensitiveWordService.check(reply)
const riskHits = safety.hits || []
const blocked = riskHits.length > 0 || /微信|VX|V信|手机号|电话|http|www\./i.test(reply)

await this.leadRepository.updateById(lead.id, {
  suggestedReply: {
    content: reply,
    model: modelName,
    status: blocked ? 'blocked' : 'generated',
    riskHits,
    generatedAt: new Date(),
  },
} as any)
```

If blocked, return the suggestion with `status: 'blocked'`; do not throw unless the caller requests execution.

- [ ] **Step 6: Implement reply execution and private-message capability methods**

`ReplyExecutionService.recordResult()` must load the lead by `{ _id, userId }`, map `lead.platform` to the required `ReplyCommentRecord.type`, create the reply record, update `lastReplyRecordId`, and append the timeline.

```ts
const ACCOUNT_TYPE_BY_PLATFORM = {
  xhs: AccountType.Xhs,
  douyin: AccountType.Douyin,
  kwai: AccountType.KWAI,
} as const

const lead = await this.leadRepository.getByIdAndUser(id, userId)
if (!lead) throw new AppException(ResponseCode.LeadNotFound)

const type = ACCOUNT_TYPE_BY_PLATFORM[lead.platform as keyof typeof ACCOUNT_TYPE_BY_PLATFORM]
if (!type) throw new AppException(ResponseCode.PlatformNotSupported)

const record = await this.replyCommentRecordRepository.addLeadReplyResult({
  userId,
  accountId: lead.accountId,
  leadId: lead.id,
  platform: lead.platform,
  type,
  worksId: lead.postId,
  commentId: lead.commentId,
  commentContent: lead.sourceContent,
  replyContent: body.replyContent,
  status: body.status,
  executionMode: body.executionMode,
  failureReason: body.failureReason || '',
})

await this.leadRepository.updateById(lead.id, {
  lastReplyRecordId: record.id,
  ...(body.status === 'success' && { stage: 'replied', status: 'in_progress' }),
} as any)

await this.leadActivityLogRepository.append({
  userId,
  leadId: lead.id,
  action: body.status === 'failed' ? 'reply_failed' : 'reply_executed',
  operatorId,
  note: body.failureReason || body.replyContent,
})
```

`LeadManagementService.privateMessageCapability()` should return explicit capability rows, not fake conversations:

```ts
async privateMessageCapability(userId: string, query: PrivateMessageCapabilityQueryDto) {
  void userId
  const platforms = query.platform ? [query.platform] : ['xhs', 'douyin', 'kwai']
  return {
    list: platforms.map(platform => ({
      platform,
      accountId: query.accountId || '',
      status: platform === 'douyin' ? 'permission_required' : platform === 'xhs' ? 'manual_required' : 'not_supported',
      reason: platform === 'douyin'
        ? 'Douyin private-message ingestion requires confirmed Open Platform IM scope and callback support.'
        : platform === 'xhs'
          ? 'XHS private-message ingestion is not implemented in the local bridge yet.'
          : 'Kwai private-message ingestion provider is not implemented yet.',
    })),
  }
}
```

- [ ] **Step 7: Implement controller**

Controller skeleton:

```ts
@ApiTags('Acquisition Leads')
@Controller('/acquisition/leads')
export class AcquisitionLeadsController {
  constructor(
    private readonly materializationService: LeadMaterializationService,
    private readonly leadManagementService: LeadManagementService,
    private readonly replySuggestionService: ReplySuggestionService,
    private readonly replyExecutionService: ReplyExecutionService,
  ) {}

  @Get('/private-message/capability')
  async privateMessageCapability(@GetToken() token: TokenInfo, @Query() query: PrivateMessageCapabilityQueryDto) {
    return await this.leadManagementService.privateMessageCapability(token.id, query)
  }

  @Get('/')
  async list(@GetToken() token: TokenInfo, @Query() query: LeadListQueryDto) {
    const [list, total] = await this.leadManagementService.list(token.id, query)
    return {
      list,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    }
  }

  @Post('/materialize')
  async materialize(@GetToken() token: TokenInfo, @Body() body: MaterializeLeadsDto) {
    return await this.materializationService.materialize(token.id, body, token.id)
  }

  @Get('/:id')
  async detail(@GetToken() token: TokenInfo, @Param('id') id: string) {
    return await this.leadManagementService.detail(token.id, id)
  }

  @Get('/:id/timeline')
  async timeline(@GetToken() token: TokenInfo, @Param('id') id: string) {
    return await this.leadManagementService.timeline(token.id, id)
  }

  @Post('/:id/claim')
  async claim(@GetToken() token: TokenInfo, @Param('id') id: string) {
    return await this.leadManagementService.assign(token.id, id, token.id, token.id)
  }

  @Patch('/batch-assignee')
  async batchAssign(@GetToken() token: TokenInfo, @Body() body: BatchAssignLeadsDto) {
    return await this.leadManagementService.batchAssign(token.id, body.leadIds, body.assignee, token.id)
  }

  @Patch('/:id/assignee')
  async assign(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: UpdateLeadAssigneeDto) {
    return await this.leadManagementService.assign(token.id, id, body.assignee, token.id)
  }

  @Patch('/:id/stage')
  async stage(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: UpdateLeadStageDto) {
    return await this.leadManagementService.changeStage(token.id, id, body.stage, token.id)
  }

  @Post('/:id/notes')
  async note(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: AddLeadNoteDto) {
    return await this.leadManagementService.addNote(token.id, id, body.note, token.id)
  }

  @Post('/:id/reply-suggestion')
  async suggestion(@GetToken() token: TokenInfo, @Param('id') id: string) {
    return await this.replySuggestionService.generate(token.id, id, token.id)
  }

  @Post('/:id/reply-result')
  async replyResult(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: ReplyResultDto) {
    return await this.replyExecutionService.recordResult(token.id, id, body, token.id)
  }
}
```

Keep static routes before dynamic routes: `/private-message/capability` before `/:id`, and `/batch-assignee` before `/:id/assignee`. This keeps route resolution stable if the underlying HTTP adapter changes matching behavior.

- [ ] **Step 8: Register module**

Add controller and services to `AcquisitionModule` without removing existing providers:

```ts
controllers: [
  AcquisitionController,
  AcquisitionContentController,
  WorkDataController,
  AcquisitionLeadsController,
],
providers: [
  // existing providers...
  LeadMaterializationService,
  LeadManagementService,
  ReplySuggestionService,
  ReplyExecutionService,
],
```

- [ ] **Step 9: Add backend tests**

Create focused specs:

```bash
project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-materialization.service.spec.ts
project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-management.service.spec.ts
project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-suggestion.service.spec.ts
```

Minimum assertions:

- Materialization dedupes by comment identity.
- Materialization cannot create leads from a monitored post owned by a different `userId`.
- Materialization honors `totalCommentLimit` globally across multiple monitored posts, not per post.
- List/detail never returns another user's lead.
- List returns `list`, `total`, `page`, `pageSize`, and `totalPages`.
- Timeline cannot return activity logs for another user's lead.
- Reply suggestion cannot update another user's lead.
- Stage change updates both `stage` and `status`.
- Batch assign appends one log per lead.
- Risky AI suggestion stores `blocked`.
- Reply result persists required `ReplyCommentRecord.type`, stores `executionMode`, and updates `lastReplyRecordId`.
- Private-message capability returns explicit non-ready statuses without creating message records.

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/leads
pnpm nx run aitoearn-server:build
```

Expected: specs pass and build succeeds.

### Task 4: Add Frontend API Layer

**Files:**
- Create: `project/aitoearn-web/src/api/leads.ts`

- [ ] **Step 1: Add types and wrappers**

Use the same request style as `workData.ts`. The current `project/aitoearn-web/src/utils/request.ts` exposes `http.patch<T>()`, so keep the backend assignment/stage endpoints as `PATCH`. If implementing from an older branch where `patch` is missing, add the same wrapper to `request.ts` instead of changing these endpoints to `POST`.

```ts
import http from '@/utils/request'
import type { AcquisitionPlatform } from './acquisition'

export type LeadStage = 'new_comment' | 'replied' | 'messaged' | 'wechat_guided' | 'wechat_added' | 'lost'
export type LeadStatus = 'pending' | 'in_progress' | 'converted' | 'lost' | 'invalid'

export interface LeadItem {
  id: string
  platform: AcquisitionPlatform
  accountId: string
  postId: string
  commentId: string
  parentCommentId: string
  userName: string
  userAvatar: string
  sourceContent: string
  stage: LeadStage
  status: LeadStatus
  assignee: string
  suggestedReply?: {
    content: string
    model: string
    status: 'empty' | 'generated' | 'blocked' | 'edited'
    riskHits: string[]
    generatedAt?: string
  }
  lastFollowUpAt?: string
  updatedAt?: string
}

export interface LeadActivityItem {
  id: string
  leadId: string
  action: string
  operatorId: string
  fromValue: string
  toValue: string
  note: string
  createdAt?: string
}

export interface LeadListResponse {
  list: LeadItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function listLeads(params: Record<string, string | number | undefined>) {
  const response = await http.get<LeadListResponse>('acquisition/leads', params)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'list leads failed')
  return response.data
}

export async function getLeadDetail(id: string) {
  const response = await http.get<LeadItem>(`acquisition/leads/${id}`)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'get lead detail failed')
  return response.data
}

export async function listLeadTimeline(id: string) {
  const response = await http.get<LeadActivityItem[]>(`acquisition/leads/${id}/timeline`)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'list lead timeline failed')
  return response.data
}

export async function materializeLeads(data: {
  monitoredPostId?: string
  platform?: AcquisitionPlatform
  accountId?: string
  postId?: string
  fetchBatch?: string
  postLimit?: number
  commentLimit?: number
  totalCommentLimit?: number
}) {
  const response = await http.post<{ totalScanned: number; materialized: number }>('acquisition/leads/materialize', data)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'materialize leads failed')
  return response.data
}

export async function claimLead(id: string) {
  const response = await http.post<LeadItem>(`acquisition/leads/${id}/claim`)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'claim lead failed')
  return response.data
}

export async function getPrivateMessageCapability(params: { platform?: AcquisitionPlatform; accountId?: string }) {
  const response = await http.get<{
    list: Array<{ platform: AcquisitionPlatform; accountId?: string; status: 'ready' | 'manual_required' | 'permission_required' | 'not_supported'; reason: string }>
  }>('acquisition/leads/private-message/capability', params)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'get private message capability failed')
  return response.data
}

export async function updateLeadStage(id: string, stage: LeadStage) {
  const response = await http.patch<LeadItem>(`acquisition/leads/${id}/stage`, { stage })
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'update lead stage failed')
  return response.data
}

export async function updateLeadAssignee(id: string, assignee: string) {
  const response = await http.patch<LeadItem>(`acquisition/leads/${id}/assignee`, { assignee })
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'update lead assignee failed')
  return response.data
}

export async function batchAssignLeads(leadIds: string[], assignee: string) {
  const response = await http.patch<{ updated: number }>('acquisition/leads/batch-assignee', { leadIds, assignee })
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'batch assign leads failed')
  return response.data
}

export async function generateLeadReplySuggestion(id: string) {
  const response = await http.post<LeadItem>(`acquisition/leads/${id}/reply-suggestion`)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'generate reply suggestion failed')
  return response.data
}

export async function addLeadNote(id: string, note: string) {
  const response = await http.post<LeadActivityItem>(`acquisition/leads/${id}/notes`, { note })
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'add lead note failed')
  return response.data
}

export async function recordLeadReplyResult(id: string, data: {
  replyContent: string
  status: 'success' | 'failed'
  executionMode?: 'manual' | 'platform_adapter'
  failureReason?: string
}) {
  const response = await http.post<LeadItem>(`acquisition/leads/${id}/reply-result`, data)
  if (!response || String(response.code) !== '0') throw new Error(response?.message || 'record lead reply result failed')
  return response.data
}
```

- [ ] **Step 2: Run frontend type check**

Run:

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: type check passes.

### Task 5: Replace `/leads` Roadmap With Real Page

**Files:**
- Modify: `project/aitoearn-web/src/app/[lng]/leads/page.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/leads/LeadsPage/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/leads/components/LeadToolbar/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/leads/components/LeadTable/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/leads/components/LeadDetailDrawer/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/leads/components/LeadStageTag/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/leads/components/PrivateMessageStatusPanel/index.tsx`
- Modify: `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json`
- Modify: `project/aitoearn-web/src/app/i18n/locales/en/route.json`

- [ ] **Step 1: Swap route entry**

Replace roadmap import:

```tsx
import LeadsPage from './LeadsPage'

export default function Page() {
  return <LeadsPage />
}
```

- [ ] **Step 2: Build page layout**

`LeadsPage` should mirror the restrained operational style of `WorkDataPage`:

- top stats: total, pending, in progress, converted;
- private-message capability panel;
- toolbar filters;
- table;
- detail drawer.

Use `Card` radius `8`, avoid nested cards, and keep the layout dense enough for operators.

- [ ] **Step 3: Add toolbar**

Toolbar controls:

- platform select: all/xhs/douyin/kwai;
- stage select;
- status select;
- keyword search;
- `生成线索` button calling `materializeLeads({ postLimit: 20, commentLimit: 100, totalCommentLimit: 100 })`;
- `批量分配` action enabled when rows are selected.

- [ ] **Step 4: Add table**

Columns:

- platform/account;
- source user;
- source comment, two-line clamp;
- stage/status;
- assignee;
- last follow-up;
- actions: detail, claim, stage menu.

- [ ] **Step 5: Add detail drawer**

Tabs or sections:

- source comment and work identity;
- AI reply suggestion with risk warning;
- stage operations;
- timeline.

Do not add a public reply submit button until `reply-execution.service` can return a concrete platform adapter status. For MVP, show `记录已回复` and record via `reply-result` with `{ status: 'success', executionMode: 'manual' }`, or `{ status: 'failed', executionMode: 'manual', failureReason }` when the operator records a failed/manual attempt. Keep `manual_required` only in capability/preflight UI, not as a reply result.

- [ ] **Step 6: Add private-message status panel**

Render platform capability honestly:

- XHS: `manual_required` unless local bridge implements DM fetch.
- Douyin: `permission_required` until Open Platform DM/IM scope is configured.
- Kwai: `not_supported` until provider is implemented.

The panel should not display fake conversations.

- [ ] **Step 7: Add i18n keys**

Add `leads.*` keys in both `zh-CN/route.json` and `en/route.json` for page title, filters, stats, table columns, actions, empty states, and errors.

- [ ] **Step 8: Verify frontend**

Run:

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: type check passes.

Open:

```text
http://127.0.0.1:6061/zh-CN/leads
```

Expected:

- page is no longer roadmap-only;
- materialize button can create leads from existing `comment_snapshot`;
- list refresh shows created leads;
- detail drawer opens without console errors.

### Task 6: Wire Work Data to Leads

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.service.ts`
- Modify: `project/aitoearn-web/src/app/[lng]/work-data/components/PostDetailDrawer/index.tsx`

- [ ] **Step 1: Trigger optional materialization after successful fetch**

After `WorkDataService.updateMonitoredPostFromFetchResult()` writes a ready fetch log, enqueue or call materialization for that post identity. This method exists in the current `WorkDataService`; keep this integration inside that method so both direct fetch and worker fetch paths share it.

```ts
if (fetchStatus === 'ready') {
  const monitoredPostId = post.id || String((post as any)._id)
  await this.leadMaterializationService.materialize(userId, {
    monitoredPostId,
    fetchBatch: result.fetchBatch,
    commentLimit: 100,
    totalCommentLimit: 100,
  }, userId)
}
```

`MonitoredPost` normally has the `id` virtual because channel-db schemas use `DEFAULT_SCHEMA_OPTIONS`, but use the `post.id || String((post as any)._id)` fallback in this internal path so a future lean/non-lean repository change does not break materialization.

If direct service injection creates a circular dependency, keep materialization manual in `/leads` for this task and add a queue job in a separate follow-up. Do not introduce a hidden circular import.

- [ ] **Step 2: Add work-data CTA**

In `PostDetailDrawer`, add a small action near comments:

```text
生成线索
```

Call `materializeLeads({ monitoredPostId: post.id, commentLimit: 100, totalCommentLimit: 100 })` and show the returned count. Prefer `monitoredPostId` here because it lets the backend perform an exact `getByIdAndUser()` ownership check before touching `comment_snapshot`.

- [ ] **Step 3: Verify data path**

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/leads apps/aitoearn-server/src/core/acquisition/work-data/work-data.service.spec.ts
pnpm nx run aitoearn-server:build

cd ../aitoearn-web
pnpm run type-check
```

Expected:

- fetched comments can be materialized;
- repeated materialization does not duplicate leads;
- work-data drawer CTA refreshes lead count.

### Task 7: End-to-End Verification

**Files:**
- No new files.

- [ ] **Step 1: Ensure services are running**

Expected local URLs:

```text
Web: http://127.0.0.1:6061/zh-CN
API proxy: http://127.0.0.1:7001/api
Backend: http://127.0.0.1:3002
MongoDB: 127.0.0.1:27017
Redis: 127.0.0.1:6379
```

- [ ] **Step 2: Seed path from real data**

Use the existing XHS publish/fetch flow or manually add a monitored XHS work in `/work-data`, fetch comments, then open `/leads` and click `生成线索`.

Expected:

- `comment_snapshot` has at least one record;
- `lead` collection gets deduped lead records with `userId`;
- `/leads` displays them.

- [ ] **Step 3: Exercise operator workflow**

Actions:

1. Claim one lead.
2. Change stage to `replied`.
3. Generate AI suggestion.
4. Add a note.
5. Record a manual reply result.

Expected:

- list updates after each action;
- drawer timeline shows every operation;
- blocked suggestions show risk hits and cannot be treated as safe public replies.

- [ ] **Step 4: Run final checks**

Run:

```bash
git diff --check

cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/leads
pnpm nx run aitoearn-server:build

cd ../aitoearn-web
pnpm run type-check
```

Expected:

- no whitespace errors;
- backend tests pass;
- backend build passes;
- frontend type check passes.

## Risks and Guardrails

- Do not claim private-message ingestion is complete until a real XHS/Douyin/Kwai DM provider exists and is verified with logged-in accounts or official API scopes.
- Do not execute public replies automatically. Keep manual confirmation or manual-result recording in MVP.
- Do not create leads without `userId`; that would leak data across users.
- Do not materialize from all historical comments by default. Keep separate caps: `postLimit <= 100`, `commentLimit <= 500`, and `totalCommentLimit <= 500`; UI defaults should scan at most 100 comments total.
- Do not bypass the unified frontend request layer.

## Self-Review

- Spec coverage: the plan covers storage, repository helpers, backend APIs, frontend page, work-data linkage, private-message capability state, and end-to-end verification.
- Placeholder scan: no unresolved implementation placeholders remain.
- Type consistency: stages, statuses, route names, and API helper names are consistent across backend and frontend sections.
- Scope check: MVP is public-comment lead tracking first; private-message ingestion is represented as honest capability status, not fake data.
