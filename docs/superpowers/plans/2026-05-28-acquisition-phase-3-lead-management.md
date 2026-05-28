# Acquisition Phase 3 Lead Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 3 lead-management loop for the acquisition workspace: turn persisted comment snapshots into leads, let operators filter/assign/transfer/stage leads, generate safe AI reply suggestions, execute public replies after manual confirmation, and record every action.

**Architecture:** Extend the Phase 0 `lead`, `lead_activity_log`, and `replyCommentRecord` data contracts with the fields Phase 3 needs, then add a focused lead sub-domain under the existing `acquisition` NestJS module. Backend owns lead materialization, state transitions, assignment logs, AI suggestion generation, safety validation, and reply-result persistence; frontend owns operator review and plugin-mediated reply execution for XHS/Douyin because those interaction APIs currently live in the browser plugin layer.

**Tech Stack:** NestJS, Mongoose repositories from `@yikart/channel-db`, Zod DTOs with `createZodDto`, `@ApiDoc`, `@yikart/aitoearn-ai-client`, existing `SensitiveWordService`, Next.js App Router, Zustand, Ant Design/Radix/Tailwind, pnpm/Nx/Vitest

---

## Preconditions

- Phase 0 data foundation exists:
  - `LeadRepository`
  - `LeadActivityLogRepository`
  - `CommentSnapshotRepository`
  - `ScriptTemplateRepository`
  - `AccountOpsConfigRepository`
  - `SensitiveWordModule`
- Phase 1 collection pipeline exists or is in progress:
  - real comment snapshots are persisted in `comment_snapshot`;
  - each comment snapshot includes `platform`, `accountId`, `postId`, `commentId`, `parentCommentId`, `content`, `userName`, `userAvatar`, `fetchBatch`, `dataSource`;
  - frontend acquisition route exists at `project/aitoearn-web/src/app/[lng]/acquisition/`.
- Phase 2 script-template CRUD may be incomplete. Phase 3 must still work with existing `script_template` records if present and fall back to deterministic built-in prompt rules when no enabled template matches.
- Phase 3 does not implement automatic private-message sending. It only records `messaged`, `wechat_guided`, and `wechat_added` stages after an operator confirms the action.

---

## File Structure

### Backend Data Layer

| File | Responsibility |
|---|---|
| `project/aitoearn-backend/libs/channel-db/src/schemas/lead.schema.ts` | Extend lead fields for source content, avatar, AI suggestion, reply state, and optimistic version. |
| `project/aitoearn-backend/libs/channel-db/src/schemas/lead-activity-log.schema.ts` | Extend action enum for reply generation/execution and batch assignment. |
| `project/aitoearn-backend/libs/channel-db/src/schemas/reply-comment-record.schema.ts` | Add optional `leadId`, `platform`, `status`, `failureReason`, and `screenshot` fields for Phase 3 reply result traceability. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/lead.repository.ts` | Add listing, upsert-from-comment, assignment, stage, and suggestion helpers. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/lead-activity-log.repository.ts` | Add append/list helpers for lead timelines. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/comment-snapshot.repository.ts` | Add query helpers for materializing leads from comments by account/post/batch. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/script-template.repository.ts` | Add `findEnabledForScene()` helper for reply suggestion template selection. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/reply-comment-record.repository.ts` | Add `addPhase3Result()` helper and include new filters. |

### Backend Acquisition Lead Module

| File | Responsibility |
|---|---|
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/acquisition-leads.constants.ts` | Lead action constants, reply execution status, and intent-scene mapping. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/acquisition-leads.dto.ts` | Zod DTOs for list, materialize, stage, assignment, notes, suggestion, reply prepare/result, and timeline APIs. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-intent.service.ts` | Deterministic clothing-comment intent classifier used for lead attribution and template scene selection. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-materialization.service.ts` | Convert comment snapshots into deduped lead records. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-management.service.ts` | List leads, change stages, assign/claim/transfer, batch assign, add notes, and build timeline. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-suggestion.service.ts` | Generate and persist safe AI/manual-template reply suggestions. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-execution.service.ts` | Prepare browser-plugin reply payloads and record execution results. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/acquisition-leads.controller.ts` | Authenticated REST endpoints for Phase 3 lead workflows. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/*.spec.ts` | Focused unit tests for materialization, state transitions, reply safety, and reply-result recording. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts` | Register Phase 3 lead services/controller and import `SensitiveWordModule`. |

### Frontend Acquisition Lead UI

| File | Responsibility |
|---|---|
| `project/aitoearn-web/src/api/acquisitionLeads.ts` | Client API wrappers for Phase 3 lead endpoints. |
| `project/aitoearn-web/src/api/types/acquisitionLeads.ts` | Lead, timeline, suggestion, and reply execution response types. |
| `project/aitoearn-web/src/app/[lng]/acquisition/components/LeadTrackingPanel/index.tsx` | Main lead-list panel mounted under the “线索追踪” tab. |
| `project/aitoearn-web/src/app/[lng]/acquisition/components/LeadDetailDrawer/index.tsx` | Timeline, source comment, AI suggestion, and stage actions. |
| `project/aitoearn-web/src/app/[lng]/acquisition/components/LeadAssignmentBar/index.tsx` | Batch assignment, claim, and assignee filter controls. |
| `project/aitoearn-web/src/app/[lng]/acquisition/components/LeadReplyComposer/index.tsx` | Generate suggestion, edit reply, safety warning, and manual execute button. |
| `project/aitoearn-web/src/app/[lng]/acquisition/useLeadTrackingStore.ts` | Page-local Zustand store for filters, pagination, selected lead, and optimistic refresh. |
| `project/aitoearn-web/src/app/[lng]/acquisition/acquisitionPageCore.tsx` | Mount `LeadTrackingPanel` under the leads tab. |
| `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json` | Add flat acquisition lead UI translation keys. |
| `project/aitoearn-web/src/app/i18n/locales/en/route.json` | Add English acquisition lead UI translation keys. |

---

## Design Decisions

1. **Lead creation source:** Phase 3 materializes leads from persisted `comment_snapshot` records, not directly from live platform APIs. This keeps retry behavior deterministic and lets demo seed comments produce the same lead pipeline.
2. **Dedup key:** one public-comment lead is unique by `{ platform, accountId, postId, commentId, parentCommentId }`. Repeated fetch batches update source fields and `lastFollowUpAt` only when meaningful data changed.
3. **Stage and status:** `stage` represents funnel position; `status` represents work state. A stage transition updates status deterministically:
   - `new_comment` -> `pending`
   - `replied` / `messaged` / `wechat_guided` -> `in_progress`
   - `wechat_added` -> `converted`
   - `lost` -> `lost`
4. **Public reply safety:** public comment suggestions and public reply execution must pass `SensitiveWordService.check()`. A public reply containing a phone number, URL, or WeChat variant is blocked. Private-message stages can store a WeChat-oriented suggestion only when `ScriptTemplate.platformConstraints.allowWechatId === true` and the operator confirms manually.
5. **Reply execution boundary:** XHS/Douyin plugin interactions happen in the browser. Backend returns a signed/validated reply payload; frontend calls `xhsInteraction.replyComment()` or `douyinInteraction.replyComment()`, then reports success/failure to backend.
6. **Kwai:** Phase 3 supports lead management for Kwai comments if Phase 1/seed data has Kwai comment snapshots, but public reply execution remains `manual_required` until Kwai comment reply capability is confirmed.
7. **Permissions:** Phase 3 uses current logged-in users as operators. It does not add a full role system; administrator-only checks are a Phase 3.5/Phase 4 hardening item unless the existing auth layer already exposes roles.

---

## Implementation Tasks

### Task 1: Extend Lead Data Contracts and Repositories

**Files:**
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/lead.schema.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/lead-activity-log.schema.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/reply-comment-record.schema.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/lead.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/lead-activity-log.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/comment-snapshot.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/script-template.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/reply-comment-record.repository.ts`

- [ ] **Step 1: Extend `Lead` schema**

Add these enums/subdocuments and fields to `lead.schema.ts`:

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
  templateId: string

  @Prop({ type: String, default: '' })
  model: string

  @Prop({ required: true, enum: LeadSuggestionStatus, default: LeadSuggestionStatus.Empty })
  status: LeadSuggestionStatus

  @Prop({ type: [String], default: [] })
  riskHits: string[]

  @Prop({ type: Date, default: null })
  generatedAt?: Date
}

const LeadSuggestedReplySchema = SchemaFactory.createForClass(LeadSuggestedReply)
```

Add these fields inside `Lead`:

```ts
@Prop({ required: true, enum: LeadSourceType, default: LeadSourceType.PublicComment, index: true })
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

@Prop({ type: Number, default: 0 })
version: number
```

- [ ] **Step 2: Extend activity and reply record schemas**

Add new actions to `LeadActivityAction`:

```ts
  BatchAssigned = 'batch_assigned',
  ReplySuggested = 'reply_suggested',
  ReplyExecuted = 'reply_executed',
  ReplyFailed = 'reply_failed',
```

Add optional fields to `ReplyCommentRecord`:

```ts
@Prop({ type: String, default: '', index: true })
leadId: string

@Prop({ type: String, default: '', index: true })
platform: string

@Prop({ type: String, default: 'success', index: true })
status: 'success' | 'failed' | 'manual_required'

@Prop({ type: String, default: '' })
failureReason: string

@Prop({ type: String, default: '' })
screenshot: string
```

- [ ] **Step 3: Add `LeadRepository` helpers**

```ts
import { FilterQuery, Model } from 'mongoose'
import {
  Lead,
  LeadSourceType,
  LeadStage,
  LeadStatus,
  LeadSuggestedReply,
} from '../schemas'

export interface LeadListQuery {
  platform?: string
  accountId?: string
  postId?: string
  stage?: LeadStage
  status?: LeadStatus
  assignee?: string
  keyword?: string
  page: number
  pageSize: number
}

export interface LeadFromCommentInput {
  platform: string
  accountId: string
  postId: string
  commentId: string
  parentCommentId?: string
  userName: string
  userAvatar?: string
  sourceContent: string
  attribution?: Lead['attribution']
}

async listLeads(query: LeadListQuery) {
  const filter: FilterQuery<Lead> = {
    ...(query.platform && { platform: query.platform }),
    ...(query.accountId && { accountId: query.accountId }),
    ...(query.postId && { postId: query.postId }),
    ...(query.stage && { stage: query.stage }),
    ...(query.status && { status: query.status }),
    ...(typeof query.assignee === 'string' && { assignee: query.assignee }),
    ...(query.keyword && {
      $or: [
        { userName: { $regex: query.keyword, $options: 'i' } },
        { sourceContent: { $regex: query.keyword, $options: 'i' } },
      ],
    }),
  }
  return await this.findWithPagination({
    page: query.page,
    pageSize: query.pageSize,
    filter,
    options: { sort: { lastFollowUpAt: -1, updatedAt: -1 } },
  })
}

async upsertFromComment(input: LeadFromCommentInput) {
  return await this.updateOne(
    {
      platform: input.platform,
      accountId: input.accountId,
      postId: input.postId,
      commentId: input.commentId,
      parentCommentId: input.parentCommentId || '',
    },
    {
      $set: {
        userName: input.userName,
        userAvatar: input.userAvatar || '',
        sourceType: LeadSourceType.PublicComment,
        sourceContent: input.sourceContent,
        attribution: input.attribution || {},
        lastFollowUpAt: new Date(),
      },
      $setOnInsert: {
        platform: input.platform,
        accountId: input.accountId,
        postId: input.postId,
        commentId: input.commentId,
        parentCommentId: input.parentCommentId || '',
        stage: LeadStage.NewComment,
        status: LeadStatus.Pending,
        assignee: '',
      },
      $inc: { version: 1 },
    },
    { upsert: true },
  )
}

async updateStage(id: string, stage: LeadStage, status: LeadStatus) {
  return await this.updateById(id, {
    $set: { stage, status, lastFollowUpAt: new Date() },
    $inc: { version: 1 },
  })
}

async updateAssignee(id: string, assignee: string) {
  return await this.updateById(id, {
    $set: { assignee, status: LeadStatus.InProgress, lastFollowUpAt: new Date() },
    $inc: { version: 1 },
  })
}

async batchUpdateAssignee(ids: string[], assignee: string) {
  return await this.model.updateMany(
    { _id: { $in: ids } },
    {
      $set: { assignee, status: LeadStatus.InProgress, lastFollowUpAt: new Date() },
      $inc: { version: 1 },
    },
  )
}

async saveSuggestedReply(id: string, suggestedReply: Partial<LeadSuggestedReply>) {
  return await this.updateById(id, {
    $set: { suggestedReply, lastFollowUpAt: new Date() },
    $inc: { version: 1 },
  })
}

async saveReplyRecordId(id: string, replyRecordId: string, stage: LeadStage, status: LeadStatus) {
  return await this.updateById(id, {
    $set: { lastReplyRecordId: replyRecordId, stage, status, lastFollowUpAt: new Date() },
    $inc: { version: 1 },
  })
}
```

- [ ] **Step 4: Add supporting repository helpers**

Add to `LeadActivityLogRepository`:

```ts
async append(data: Partial<LeadActivityLog>) {
  return await this.create(data)
}

async listByLeadId(leadId: string, limit = 100) {
  return await this.find(
    { leadId },
    { sort: { createdAt: -1 }, limit },
  )
}
```

Add to `CommentSnapshotRepository`:

```ts
async listForLeadMaterialization(params: {
  platform?: string
  accountId?: string
  postId?: string
  fetchBatch?: string
  limit?: number
}) {
  return await this.find(
    {
      ...(params.platform && { platform: params.platform }),
      ...(params.accountId && { accountId: params.accountId }),
      ...(params.postId && { postId: params.postId }),
      ...(params.fetchBatch && { fetchBatch: params.fetchBatch }),
    },
    { sort: { commentedAt: -1, createdAt: -1 }, limit: params.limit || 500 },
  )
}
```

Add to `ScriptTemplateRepository`:

```ts
async findEnabledForScene(scene: string, platform: string, category?: string, accountId?: string) {
  return await this.find(
    {
      scene,
      enabled: true,
      ...(category && {
        $or: [
          { applicableCategories: { $size: 0 } },
          { applicableCategories: category },
        ],
      }),
      $or: [
        { 'platformConstraints.blockedPlatforms': { $ne: platform } },
        { platformConstraints: { $exists: false } },
      ],
    },
    { sort: { updatedAt: -1 }, limit: 10 },
  )
}
```

Add to `ReplyCommentRecordRepository`:

```ts
async addPhase3Result(data: Partial<ReplyCommentRecord>) {
  return await this.create(data)
}
```

- [ ] **Step 5: Verify backend build**

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build passes after repository method signatures compile.

---

### Task 2: Add Phase 3 DTOs, Constants, and Controller Routes

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/acquisition-leads.constants.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/acquisition-leads.dto.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/acquisition-leads.controller.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts`

- [ ] **Step 1: Add constants**

```ts
import { LeadStage, LeadStatus } from '@yikart/channel-db'

export const LEAD_STAGE_STATUS_MAP: Record<LeadStage, LeadStatus> = {
  [LeadStage.NewComment]: LeadStatus.Pending,
  [LeadStage.Replied]: LeadStatus.InProgress,
  [LeadStage.Messaged]: LeadStatus.InProgress,
  [LeadStage.WechatGuided]: LeadStatus.InProgress,
  [LeadStage.WechatAdded]: LeadStatus.Converted,
  [LeadStage.Lost]: LeadStatus.Lost,
}

export enum AcquisitionReplyExecutionStatus {
  Ready = 'ready',
  ManualRequired = 'manual_required',
  Blocked = 'blocked',
}

export const COMMENT_INTENT_SCENE_MAP = {
  ask_price: 'comment_ask_price',
  ask_link: 'comment_ask_link',
  ask_size: 'comment_ask_size',
  praise: 'comment_praise',
  price_objection: 'comment_price_objection',
  negative: 'comment_negative',
  generic: 'comment_ask_link',
} as const
```

- [ ] **Step 2: Add DTOs**

```ts
import { createZodDto } from '@yikart/common'
import { z } from 'zod'

export const leadStageSchema = z
  .enum(['new_comment', 'replied', 'messaged', 'wechat_guided', 'wechat_added', 'lost'])
  .describe('线索阶段')

export const leadStatusSchema = z
  .enum(['pending', 'in_progress', 'converted', 'lost', 'invalid'])
  .describe('线索状态')

export const leadListQuerySchema = z.object({
  platform: z.enum(['xhs', 'douyin', 'kwai']).optional().describe('来源平台'),
  accountId: z.string().optional().describe('平台账号 ID'),
  postId: z.string().optional().describe('作品 ID'),
  stage: leadStageSchema.optional().describe('线索阶段'),
  status: leadStatusSchema.optional().describe('线索状态'),
  assignee: z.string().optional().describe('负责人用户 ID，空字符串表示未分配'),
  keyword: z.string().optional().describe('按用户昵称或评论内容搜索'),
  page: z.coerce.number().min(1).default(1).describe('页码'),
  pageSize: z.coerce.number().min(1).max(100).default(20).describe('每页数量'),
})

export const materializeLeadsSchema = z.object({
  platform: z.enum(['xhs', 'douyin', 'kwai']).optional().describe('来源平台'),
  accountId: z.string().optional().describe('平台账号 ID'),
  postId: z.string().optional().describe('作品 ID'),
  fetchBatch: z.string().optional().describe('评论抓取批次'),
  limit: z.number().min(1).max(1000).optional().describe('本次最多处理评论数'),
})

export const changeLeadStageSchema = z.object({
  stage: leadStageSchema.describe('目标阶段'),
  note: z.string().max(500).optional().describe('阶段变更备注'),
})

export const assignLeadSchema = z.object({
  assignee: z.string().min(1).describe('负责人用户 ID'),
  note: z.string().max(500).optional().describe('分配备注'),
})

export const batchAssignLeadSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(100).describe('线索 ID 列表'),
  assignee: z.string().min(1).describe('负责人用户 ID'),
  note: z.string().max(500).optional().describe('批量分配备注'),
})

export const transferLeadSchema = z.object({
  assignee: z.string().min(1).describe('新负责人用户 ID'),
  note: z.string().min(1).max(500).describe('转派备注'),
})

export const noteLeadSchema = z.object({
  note: z.string().min(1).max(1000).describe('跟进备注'),
})

export const suggestReplySchema = z.object({
  model: z.string().default('gpt-5.5').describe('用于生成建议回复的模型'),
  tone: z.enum(['friendly', 'professional', 'promotion', 'restrained']).default('friendly').describe('回复语气'),
  scene: z.string().optional().describe('指定话术场景，不传则根据评论内容识别'),
})

export const prepareReplySchema = z.object({
  content: z.string().min(1).max(500).describe('运营确认后的公开回复内容'),
})

export const recordReplyResultSchema = z.object({
  success: z.boolean().describe('插件或平台执行是否成功'),
  replyContent: z.string().min(1).max(500).describe('实际回复内容'),
  platformReplyId: z.string().optional().describe('平台返回的回复 ID'),
  failureReason: z.string().optional().describe('失败原因'),
  screenshot: z.string().optional().describe('失败或成功截图 URL'),
})

export class LeadListQueryDto extends createZodDto(leadListQuerySchema) {}
export class MaterializeLeadsDto extends createZodDto(materializeLeadsSchema) {}
export class ChangeLeadStageDto extends createZodDto(changeLeadStageSchema) {}
export class AssignLeadDto extends createZodDto(assignLeadSchema) {}
export class BatchAssignLeadDto extends createZodDto(batchAssignLeadSchema) {}
export class TransferLeadDto extends createZodDto(transferLeadSchema) {}
export class NoteLeadDto extends createZodDto(noteLeadSchema) {}
export class SuggestReplyDto extends createZodDto(suggestReplySchema) {}
export class PrepareReplyDto extends createZodDto(prepareReplySchema) {}
export class RecordReplyResultDto extends createZodDto(recordReplyResultSchema) {}
```

- [ ] **Step 3: Add controller routes**

```ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { GetToken, TokenInfo } from '@yikart/aitoearn-auth'
import { ApiDoc, ParseObjectIdPipe } from '@yikart/common'
import {
  AssignLeadDto,
  BatchAssignLeadDto,
  ChangeLeadStageDto,
  LeadListQueryDto,
  MaterializeLeadsDto,
  NoteLeadDto,
  PrepareReplyDto,
  RecordReplyResultDto,
  SuggestReplyDto,
  TransferLeadDto,
} from './acquisition-leads.dto'

@Controller('/acquisition/leads')
export class AcquisitionLeadsController {
  constructor(
    private readonly materialization: LeadMaterializationService,
    private readonly leads: LeadManagementService,
    private readonly suggestions: ReplySuggestionService,
    private readonly replyExecution: ReplyExecutionService,
  ) {}

  @ApiDoc({ summary: '物化评论线索', body: MaterializeLeadsDto.schema })
  @Post('/materialize')
  async materialize(@GetToken() token: TokenInfo, @Body() dto: MaterializeLeadsDto) {
    return await this.materialization.materialize(token.id, dto)
  }

  @ApiDoc({ summary: '查询线索列表', query: LeadListQueryDto.schema })
  @Get('/')
  async list(@GetToken() token: TokenInfo, @Query() query: LeadListQueryDto) {
    return await this.leads.list(token.id, query)
  }

  @ApiDoc({ summary: '查询线索详情' })
  @Get('/:leadId')
  async detail(@GetToken() token: TokenInfo, @Param('leadId', ParseObjectIdPipe) leadId: string) {
    return await this.leads.detail(token.id, leadId)
  }

  @ApiDoc({ summary: '查询线索时间线' })
  @Get('/:leadId/timeline')
  async timeline(@GetToken() token: TokenInfo, @Param('leadId', ParseObjectIdPipe) leadId: string) {
    return await this.leads.timeline(token.id, leadId)
  }

  @ApiDoc({ summary: '变更线索阶段', body: ChangeLeadStageDto.schema })
  @Post('/:leadId/stage')
  async changeStage(@GetToken() token: TokenInfo, @Param('leadId', ParseObjectIdPipe) leadId: string, @Body() dto: ChangeLeadStageDto) {
    return await this.leads.changeStage(token.id, leadId, dto)
  }

  @ApiDoc({ summary: '分配线索负责人', body: AssignLeadDto.schema })
  @Post('/:leadId/assign')
  async assign(@GetToken() token: TokenInfo, @Param('leadId', ParseObjectIdPipe) leadId: string, @Body() dto: AssignLeadDto) {
    return await this.leads.assign(token.id, leadId, dto)
  }

  @ApiDoc({ summary: '领取未分配线索' })
  @Post('/:leadId/claim')
  async claim(@GetToken() token: TokenInfo, @Param('leadId', ParseObjectIdPipe) leadId: string) {
    return await this.leads.claim(token.id, leadId)
  }

  @ApiDoc({ summary: '转派线索', body: TransferLeadDto.schema })
  @Post('/:leadId/transfer')
  async transfer(@GetToken() token: TokenInfo, @Param('leadId', ParseObjectIdPipe) leadId: string, @Body() dto: TransferLeadDto) {
    return await this.leads.transfer(token.id, leadId, dto)
  }

  @ApiDoc({ summary: '批量分配线索', body: BatchAssignLeadDto.schema })
  @Post('/batch-assign')
  async batchAssign(@GetToken() token: TokenInfo, @Body() dto: BatchAssignLeadDto) {
    return await this.leads.batchAssign(token.id, dto)
  }

  @ApiDoc({ summary: '添加线索备注', body: NoteLeadDto.schema })
  @Post('/:leadId/note')
  async note(@GetToken() token: TokenInfo, @Param('leadId', ParseObjectIdPipe) leadId: string, @Body() dto: NoteLeadDto) {
    return await this.leads.addNote(token.id, leadId, dto)
  }

  @ApiDoc({ summary: '生成 AI 建议回复', body: SuggestReplyDto.schema })
  @Post('/:leadId/suggest-reply')
  async suggestReply(@GetToken() token: TokenInfo, @Param('leadId', ParseObjectIdPipe) leadId: string, @Body() dto: SuggestReplyDto) {
    return await this.suggestions.generate(token.id, leadId, dto)
  }

  @ApiDoc({ summary: '准备人工确认后的公开回复', body: PrepareReplyDto.schema })
  @Post('/:leadId/reply/prepare')
  async prepareReply(@GetToken() token: TokenInfo, @Param('leadId', ParseObjectIdPipe) leadId: string, @Body() dto: PrepareReplyDto) {
    return await this.replyExecution.prepare(token.id, leadId, dto)
  }

  @ApiDoc({ summary: '回写公开回复执行结果', body: RecordReplyResultDto.schema })
  @Post('/:leadId/reply/result')
  async recordReplyResult(@GetToken() token: TokenInfo, @Param('leadId', ParseObjectIdPipe) leadId: string, @Body() dto: RecordReplyResultDto) {
    return await this.replyExecution.recordResult(token.id, leadId, dto)
  }
}
```

- [ ] **Step 4: Register controller and services**

In `acquisition.module.ts`, add:

```ts
imports: [
  // existing Phase 1 imports
  SensitiveWordModule,
],
controllers: [
  // existing controllers
  AcquisitionLeadsController,
],
providers: [
  // existing providers
  LeadIntentService,
  LeadMaterializationService,
  LeadManagementService,
  ReplySuggestionService,
  ReplyExecutionService,
],
exports: [
  // existing exports
  LeadMaterializationService,
  LeadManagementService,
]
```

- [ ] **Step 5: Verify backend build**

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build passes, and every new controller method has `@ApiDoc`.

---

### Task 3: Materialize Leads From Comment Snapshots

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-intent.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-materialization.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-materialization.service.spec.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.service.ts`

- [ ] **Step 1: Add intent classifier**

```ts
import { Injectable } from '@nestjs/common'
import { COMMENT_INTENT_SCENE_MAP } from './acquisition-leads.constants'

export type CommentIntent = keyof typeof COMMENT_INTENT_SCENE_MAP

export interface LeadIntentResult {
  intent: CommentIntent
  confidence: number
  scene: string
}

@Injectable()
export class LeadIntentService {
  classify(content: string): LeadIntentResult {
    const text = content.toLowerCase()
    const rules: Array<{ intent: CommentIntent, confidence: number, patterns: RegExp[] }> = [
      { intent: 'ask_price', confidence: 0.9, patterns: [/多少钱/, /价格/, /价位/, /how much/, /price/] },
      { intent: 'ask_link', confidence: 0.85, patterns: [/链接/, /怎么买/, /哪里买/, /求同款/, /有货吗/] },
      { intent: 'ask_size', confidence: 0.85, patterns: [/尺码/, /身高/, /体重/, /多大码/, /size/] },
      { intent: 'price_objection', confidence: 0.8, patterns: [/太贵/, /贵了/, /便宜点/, /优惠/] },
      { intent: 'negative', confidence: 0.75, patterns: [/差评/, /质量不行/, /不好看/, /踩雷/] },
      { intent: 'praise', confidence: 0.65, patterns: [/好看/, /喜欢/, /种草/, /漂亮/] },
    ]
    const hit = rules.find(rule => rule.patterns.some(pattern => pattern.test(text)))
    const intent = hit?.intent || 'generic'
    return {
      intent,
      confidence: hit?.confidence || 0.5,
      scene: COMMENT_INTENT_SCENE_MAP[intent],
    }
  }
}
```

- [ ] **Step 2: Add materialization tests**

```ts
import { LeadActivityAction } from '@yikart/channel-db'
import { LeadIntentService } from './lead-intent.service'
import { LeadMaterializationService } from './lead-materialization.service'

describe('LeadMaterializationService', () => {
  const commentSnapshotRepository = {
    listForLeadMaterialization: vi.fn(),
  }
  const leadRepository = {
    upsertFromComment: vi.fn(),
  }
  const leadActivityLogRepository = {
    append: vi.fn(),
  }
  const service = new LeadMaterializationService(
    commentSnapshotRepository as ConstructorParameters<typeof LeadMaterializationService>[0],
    leadRepository as ConstructorParameters<typeof LeadMaterializationService>[1],
    leadActivityLogRepository as ConstructorParameters<typeof LeadMaterializationService>[2],
    new LeadIntentService(),
  )

  beforeEach(() => vi.clearAllMocks())

  it('materializes comment snapshots into deduped leads with attribution confidence', async () => {
    commentSnapshotRepository.listForLeadMaterialization.mockResolvedValue([
      {
        platform: 'xhs',
        accountId: 'acc-1',
        postId: 'post-1',
        commentId: 'comment-1',
        parentCommentId: '',
        userName: '买家A',
        userAvatar: 'avatar.png',
        content: '这个多少钱，有链接吗',
      },
    ])
    leadRepository.upsertFromComment.mockResolvedValue({ id: 'lead-1' })

    const result = await service.materialize('operator-1', {
      platform: 'xhs',
      accountId: 'acc-1',
      postId: 'post-1',
      limit: 100,
    })

    expect(result).toEqual({ scanned: 1, createdOrUpdated: 1 })
    expect(leadRepository.upsertFromComment).toHaveBeenCalledWith(expect.objectContaining({
      commentId: 'comment-1',
      sourceContent: '这个多少钱，有链接吗',
      attribution: expect.objectContaining({ confidence: 0.9 }),
    }))
    expect(leadActivityLogRepository.append).toHaveBeenCalledWith(expect.objectContaining({
      leadId: 'lead-1',
      action: LeadActivityAction.NoteAdded,
      operatorId: 'operator-1',
    }))
  })
})
```

- [ ] **Step 3: Implement materialization service**

```ts
import { Injectable } from '@nestjs/common'
import {
  CommentSnapshotRepository,
  LeadActivityAction,
  LeadActivityLogRepository,
  LeadRepository,
} from '@yikart/channel-db'
import { MaterializeLeadsDto } from './acquisition-leads.dto'
import { LeadIntentService } from './lead-intent.service'

@Injectable()
export class LeadMaterializationService {
  constructor(
    private readonly commentSnapshotRepository: CommentSnapshotRepository,
    private readonly leadRepository: LeadRepository,
    private readonly leadActivityLogRepository: LeadActivityLogRepository,
    private readonly leadIntentService: LeadIntentService,
  ) {}

  async materialize(operatorId: string, dto: MaterializeLeadsDto) {
    const comments = await this.commentSnapshotRepository.listForLeadMaterialization({
      platform: dto.platform,
      accountId: dto.accountId,
      postId: dto.postId,
      fetchBatch: dto.fetchBatch,
      limit: dto.limit || 500,
    })

    let createdOrUpdated = 0
    for (const comment of comments) {
      const intent = this.leadIntentService.classify(comment.content)
      const lead = await this.leadRepository.upsertFromComment({
        platform: comment.platform,
        accountId: comment.accountId,
        postId: comment.postId,
        commentId: comment.commentId,
        parentCommentId: comment.parentCommentId || '',
        userName: comment.userName,
        userAvatar: comment.userAvatar,
        sourceContent: comment.content,
        attribution: {
          hookTemplateId: '',
          scriptTemplateId: '',
          confidence: intent.confidence,
        },
      })
      createdOrUpdated += 1
      await this.leadActivityLogRepository.append({
        leadId: lead.id,
        action: LeadActivityAction.NoteAdded,
        operatorId,
        note: `Lead materialized from comment snapshot; intent=${intent.intent}; confidence=${intent.confidence}`,
      })
    }

    return { scanned: comments.length, createdOrUpdated }
  }
}
```

- [ ] **Step 4: Trigger materialization after Phase 1 fetch**

In `AcquisitionService.fetchNow()`, after snapshots are persisted, call materialization when the fetch saved comments:

```ts
if (saved.commentsSaved > 0) {
  await this.leadMaterializationService.materialize(userId, {
    platform: dto.platform,
    accountId: dto.accountId,
    postId: result.post?.postId || dto.postId,
    fetchBatch,
    limit: saved.commentsSaved,
  })
}
```

If Phase 1 `AcquisitionService` is not implemented yet, keep this call in the Phase 3 plan and add it during Phase 1 integration.

- [ ] **Step 5: Run focused test**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/leads/lead-materialization.service.spec.ts
```

Expected: materialization test passes.

---

### Task 4: Implement Lead Management State Transitions and Assignment

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-management.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-management.service.spec.ts`

- [ ] **Step 1: Add management tests**

```ts
import { LeadActivityAction, LeadStage, LeadStatus } from '@yikart/channel-db'
import { LeadManagementService } from './lead-management.service'

describe('LeadManagementService', () => {
  const leadRepository = {
    listLeads: vi.fn(),
    getById: vi.fn(),
    updateStage: vi.fn(),
    updateAssignee: vi.fn(),
    batchUpdateAssignee: vi.fn(),
  }
  const logRepository = {
    append: vi.fn(),
    listByLeadId: vi.fn(),
  }
  const service = new LeadManagementService(
    leadRepository as ConstructorParameters<typeof LeadManagementService>[0],
    logRepository as ConstructorParameters<typeof LeadManagementService>[1],
  )

  beforeEach(() => vi.clearAllMocks())

  it('maps stage to status and writes a stage change log', async () => {
    leadRepository.getById.mockResolvedValue({ id: 'lead-1', stage: LeadStage.NewComment, status: LeadStatus.Pending })
    leadRepository.updateStage.mockResolvedValue({ id: 'lead-1', stage: LeadStage.WechatAdded, status: LeadStatus.Converted })

    const result = await service.changeStage('operator-1', 'lead-1', { stage: LeadStage.WechatAdded, note: '用户已加微信' })

    expect(result.status).toBe(LeadStatus.Converted)
    expect(logRepository.append).toHaveBeenCalledWith(expect.objectContaining({
      leadId: 'lead-1',
      action: LeadActivityAction.StageChanged,
      fromValue: LeadStage.NewComment,
      toValue: LeadStage.WechatAdded,
      operatorId: 'operator-1',
    }))
  })

  it('allows operator to claim an unassigned lead', async () => {
    leadRepository.getById.mockResolvedValue({ id: 'lead-1', assignee: '' })
    leadRepository.updateAssignee.mockResolvedValue({ id: 'lead-1', assignee: 'operator-1' })

    await service.claim('operator-1', 'lead-1')

    expect(logRepository.append).toHaveBeenCalledWith(expect.objectContaining({
      action: LeadActivityAction.Claimed,
      toValue: 'operator-1',
    }))
  })
})
```

- [ ] **Step 2: Implement management service**

```ts
import { Injectable } from '@nestjs/common'
import {
  LeadActivityAction,
  LeadActivityLogRepository,
  LeadRepository,
  LeadStage,
} from '@yikart/channel-db'
import {
  AssignLeadDto,
  BatchAssignLeadDto,
  ChangeLeadStageDto,
  LeadListQueryDto,
  NoteLeadDto,
  TransferLeadDto,
} from './acquisition-leads.dto'
import { LEAD_STAGE_STATUS_MAP } from './acquisition-leads.constants'

@Injectable()
export class LeadManagementService {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly leadActivityLogRepository: LeadActivityLogRepository,
  ) {}

  async list(_operatorId: string, query: LeadListQueryDto) {
    const [list, total] = await this.leadRepository.listLeads(query)
    return { list, total, page: query.page, pageSize: query.pageSize }
  }

  async detail(_operatorId: string, leadId: string) {
    const lead = await this.leadRepository.getById(leadId)
    if (!lead) throw new Error('Lead not found')
    return lead
  }

  async timeline(_operatorId: string, leadId: string) {
    const lead = await this.detail(_operatorId, leadId)
    const logs = await this.leadActivityLogRepository.listByLeadId(leadId)
    return { lead, logs }
  }

  async changeStage(operatorId: string, leadId: string, dto: ChangeLeadStageDto) {
    const current = await this.detail(operatorId, leadId)
    const status = LEAD_STAGE_STATUS_MAP[dto.stage as LeadStage]
    const updated = await this.leadRepository.updateStage(leadId, dto.stage as LeadStage, status)
    await this.leadActivityLogRepository.append({
      leadId,
      action: LeadActivityAction.StageChanged,
      operatorId,
      fromValue: current.stage,
      toValue: dto.stage,
      note: dto.note || '',
    })
    return updated
  }

  async assign(operatorId: string, leadId: string, dto: AssignLeadDto) {
    const current = await this.detail(operatorId, leadId)
    const updated = await this.leadRepository.updateAssignee(leadId, dto.assignee)
    await this.leadActivityLogRepository.append({
      leadId,
      action: LeadActivityAction.Assigned,
      operatorId,
      fromValue: current.assignee || '',
      toValue: dto.assignee,
      note: dto.note || '',
    })
    return updated
  }

  async claim(operatorId: string, leadId: string) {
    const current = await this.detail(operatorId, leadId)
    if (current.assignee) throw new Error('Lead already assigned')
    const updated = await this.leadRepository.updateAssignee(leadId, operatorId)
    await this.leadActivityLogRepository.append({
      leadId,
      action: LeadActivityAction.Claimed,
      operatorId,
      fromValue: '',
      toValue: operatorId,
      note: 'Operator claimed unassigned lead',
    })
    return updated
  }

  async transfer(operatorId: string, leadId: string, dto: TransferLeadDto) {
    const current = await this.detail(operatorId, leadId)
    const updated = await this.leadRepository.updateAssignee(leadId, dto.assignee)
    await this.leadActivityLogRepository.append({
      leadId,
      action: LeadActivityAction.Transferred,
      operatorId,
      fromValue: current.assignee || '',
      toValue: dto.assignee,
      note: dto.note,
    })
    return updated
  }

  async batchAssign(operatorId: string, dto: BatchAssignLeadDto) {
    await this.leadRepository.batchUpdateAssignee(dto.leadIds, dto.assignee)
    await Promise.all(dto.leadIds.map(leadId => this.leadActivityLogRepository.append({
      leadId,
      action: LeadActivityAction.BatchAssigned,
      operatorId,
      toValue: dto.assignee,
      note: dto.note || '',
    })))
    return { updated: dto.leadIds.length }
  }

  async addNote(operatorId: string, leadId: string, dto: NoteLeadDto) {
    await this.detail(operatorId, leadId)
    return await this.leadActivityLogRepository.append({
      leadId,
      action: LeadActivityAction.NoteAdded,
      operatorId,
      note: dto.note,
    })
  }
}
```

- [ ] **Step 3: Run focused test**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/leads/lead-management.service.spec.ts
```

Expected: state transition and assignment tests pass.

---

### Task 5: Generate Safe AI Reply Suggestions

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-suggestion.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-suggestion.service.spec.ts`

- [ ] **Step 1: Add suggestion safety tests**

```ts
import { LeadActivityAction, LeadSuggestionStatus } from '@yikart/channel-db'
import { ReplySuggestionService } from './reply-suggestion.service'

describe('ReplySuggestionService', () => {
  const leadRepository = {
    getById: vi.fn(),
    saveSuggestedReply: vi.fn(),
  }
  const scriptTemplateRepository = {
    findEnabledForScene: vi.fn(),
  }
  const logRepository = {
    append: vi.fn(),
  }
  const aiService = {
    chatCompletion: vi.fn(),
  }
  const sensitiveWordService = {
    check: vi.fn(),
  }
  const leadIntentService = {
    classify: vi.fn(),
  }
  const service = new ReplySuggestionService(
    leadRepository as ConstructorParameters<typeof ReplySuggestionService>[0],
    scriptTemplateRepository as ConstructorParameters<typeof ReplySuggestionService>[1],
    logRepository as ConstructorParameters<typeof ReplySuggestionService>[2],
    aiService as ConstructorParameters<typeof ReplySuggestionService>[3],
    sensitiveWordService as ConstructorParameters<typeof ReplySuggestionService>[4],
    leadIntentService as ConstructorParameters<typeof ReplySuggestionService>[5],
  )

  beforeEach(() => vi.clearAllMocks())

  it('blocks public reply suggestions containing wechat words', async () => {
    leadRepository.getById.mockResolvedValue({
      id: 'lead-1',
      platform: 'xhs',
      sourceContent: '怎么买',
    })
    leadIntentService.classify.mockReturnValue({ scene: 'comment_ask_link', confidence: 0.8 })
    scriptTemplateRepository.findEnabledForScene.mockResolvedValue([])
    aiService.chatCompletion.mockResolvedValue({ content: '加我微信 abc' })
    sensitiveWordService.check.mockReturnValue({ passed: false, hits: ['微信'] })
    leadRepository.saveSuggestedReply.mockResolvedValue({ id: 'lead-1' })

    const result = await service.generate('operator-1', 'lead-1', { model: 'gpt-5.5', tone: 'friendly' })

    expect(result.suggestedReply.status).toBe(LeadSuggestionStatus.Blocked)
    expect(logRepository.append).toHaveBeenCalledWith(expect.objectContaining({
      action: LeadActivityAction.ReplySuggested,
      note: expect.stringContaining('blocked'),
    }))
  })
})
```

- [ ] **Step 2: Implement suggestion service**

```ts
import { Injectable } from '@nestjs/common'
import { AiService } from '@yikart/aitoearn-ai-client'
import {
  LeadActivityAction,
  LeadActivityLogRepository,
  LeadRepository,
  LeadSuggestionStatus,
  ScriptTemplateRepository,
} from '@yikart/channel-db'
import { UserType } from '@yikart/common'
import { SensitiveWordService } from '../../sensitive-word/sensitive-word.service'
import { SuggestReplyDto } from './acquisition-leads.dto'
import { LeadIntentService } from './lead-intent.service'

@Injectable()
export class ReplySuggestionService {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly scriptTemplateRepository: ScriptTemplateRepository,
    private readonly leadActivityLogRepository: LeadActivityLogRepository,
    private readonly aiService: AiService,
    private readonly sensitiveWordService: SensitiveWordService,
    private readonly leadIntentService: LeadIntentService,
  ) {}

  async generate(operatorId: string, leadId: string, dto: SuggestReplyDto) {
    const lead = await this.leadRepository.getById(leadId)
    if (!lead) throw new Error('Lead not found')

    const intent = this.leadIntentService.classify(lead.sourceContent || '')
    const scene = dto.scene || intent.scene
    const templates = await this.scriptTemplateRepository.findEnabledForScene(scene, lead.platform)
    const template = templates[0]

    const prompt = [
      '你是服装品牌的社媒运营助手。',
      '请为一条公开评论生成一条中文回复，语气自然克制，不超过 60 字。',
      '公开评论禁止出现微信号、手机号、URL、wx、v信、加我等引导词。',
      `回复语气: ${dto.tone}`,
      `评论内容: ${lead.sourceContent}`,
      template ? `可参考话术模板: ${template.content}` : '没有可用模板，请生成通用但具体的回复。',
    ].join('\n')

    const ai = await this.aiService.chatCompletion({
      userId: operatorId,
      userType: UserType.User,
      model: dto.model,
      messages: [{ role: 'user', content: prompt }],
    })
    const content = String(ai.content || '').trim()
    const safety = this.sensitiveWordService.check(content)
    const suggestedReply = {
      content,
      templateId: template?.id || '',
      model: dto.model,
      status: safety.passed ? LeadSuggestionStatus.Generated : LeadSuggestionStatus.Blocked,
      riskHits: safety.hits,
      generatedAt: new Date(),
    }

    const updated = await this.leadRepository.saveSuggestedReply(leadId, suggestedReply)
    await this.leadActivityLogRepository.append({
      leadId,
      action: LeadActivityAction.ReplySuggested,
      operatorId,
      toValue: suggestedReply.status,
      note: safety.passed ? 'AI reply suggestion generated' : `AI reply suggestion blocked: ${safety.hits.join(', ')}`,
    })
    return { lead: updated, suggestedReply }
  }
}
```

- [ ] **Step 3: Run focused test**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/leads/reply-suggestion.service.spec.ts
```

Expected: blocked and generated suggestion paths pass.

---

### Task 6: Prepare Manual Reply Execution and Record Results

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-execution.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-execution.service.spec.ts`

- [ ] **Step 1: Add reply execution tests**

```ts
import { LeadActivityAction, LeadStage, LeadStatus } from '@yikart/channel-db'
import { ReplyExecutionService } from './reply-execution.service'

describe('ReplyExecutionService', () => {
  const leadRepository = {
    getById: vi.fn(),
    saveReplyRecordId: vi.fn(),
  }
  const logRepository = {
    append: vi.fn(),
  }
  const replyCommentRecordRepository = {
    addPhase3Result: vi.fn(),
  }
  const sensitiveWordService = {
    check: vi.fn(),
  }
  const service = new ReplyExecutionService(
    leadRepository as ConstructorParameters<typeof ReplyExecutionService>[0],
    logRepository as ConstructorParameters<typeof ReplyExecutionService>[1],
    replyCommentRecordRepository as ConstructorParameters<typeof ReplyExecutionService>[2],
    sensitiveWordService as ConstructorParameters<typeof ReplyExecutionService>[3],
  )

  beforeEach(() => vi.clearAllMocks())

  it('blocks unsafe public reply before plugin execution', async () => {
    leadRepository.getById.mockResolvedValue({ id: 'lead-1', platform: 'xhs', accountId: 'acc-1', postId: 'post-1', commentId: 'comment-1' })
    sensitiveWordService.check.mockReturnValue({ passed: false, hits: ['微信'] })

    const result = await service.prepare('operator-1', 'lead-1', { content: '加我微信 abc' })

    expect(result.status).toBe('blocked')
    expect(result.riskHits).toEqual(['微信'])
  })

  it('records successful plugin reply and moves lead to replied', async () => {
    leadRepository.getById.mockResolvedValue({ id: 'lead-1', platform: 'xhs', accountId: 'acc-1', postId: 'post-1', commentId: 'comment-1', sourceContent: '有链接吗' })
    replyCommentRecordRepository.addPhase3Result.mockResolvedValue({ id: 'reply-1' })

    await service.recordResult('operator-1', 'lead-1', { success: true, replyContent: '可以私信我发你详情' })

    expect(leadRepository.saveReplyRecordId).toHaveBeenCalledWith('lead-1', 'reply-1', LeadStage.Replied, LeadStatus.InProgress)
    expect(logRepository.append).toHaveBeenCalledWith(expect.objectContaining({
      action: LeadActivityAction.ReplyExecuted,
      leadId: 'lead-1',
    }))
  })
})
```

- [ ] **Step 2: Implement execution service**

```ts
import { Injectable } from '@nestjs/common'
import {
  LeadActivityAction,
  LeadActivityLogRepository,
  LeadRepository,
  LeadStage,
  LeadStatus,
  ReplyCommentRecordRepository,
} from '@yikart/channel-db'
import { AccountType } from '@yikart/common'
import { SensitiveWordService } from '../../sensitive-word/sensitive-word.service'
import { PrepareReplyDto, RecordReplyResultDto } from './acquisition-leads.dto'

@Injectable()
export class ReplyExecutionService {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly leadActivityLogRepository: LeadActivityLogRepository,
    private readonly replyCommentRecordRepository: ReplyCommentRecordRepository,
    private readonly sensitiveWordService: SensitiveWordService,
  ) {}

  async prepare(operatorId: string, leadId: string, dto: PrepareReplyDto) {
    const lead = await this.leadRepository.getById(leadId)
    if (!lead) throw new Error('Lead not found')

    const safety = this.sensitiveWordService.check(dto.content)
    if (!safety.passed) {
      await this.leadActivityLogRepository.append({
        leadId,
        action: LeadActivityAction.ReplyFailed,
        operatorId,
        note: `Reply blocked before execution: ${safety.hits.join(', ')}`,
      })
      return { status: 'blocked', riskHits: safety.hits }
    }

    if (lead.platform === 'kwai') {
      return { status: 'manual_required', reason: 'Kwai public reply execution is not confirmed in Phase 3' }
    }

    return {
      status: 'ready',
      payload: {
        leadId,
        platform: lead.platform,
        accountId: lead.accountId,
        postId: lead.postId,
        commentId: lead.commentId,
        parentCommentId: lead.parentCommentId || '',
        content: dto.content,
      },
    }
  }

  async recordResult(operatorId: string, leadId: string, dto: RecordReplyResultDto) {
    const lead = await this.leadRepository.getById(leadId)
    if (!lead) throw new Error('Lead not found')

    const record = await this.replyCommentRecordRepository.addPhase3Result({
      userId: operatorId,
      accountId: lead.accountId,
      worksId: lead.postId,
      type: this.toAccountType(lead.platform),
      platform: lead.platform,
      leadId,
      commentId: lead.commentId,
      commentContent: lead.sourceContent || '',
      replyContent: dto.replyContent,
      status: dto.success ? 'success' : 'failed',
      failureReason: dto.failureReason || '',
      screenshot: dto.screenshot || '',
    })

    if (dto.success) {
      await this.leadRepository.saveReplyRecordId(leadId, record.id, LeadStage.Replied, LeadStatus.InProgress)
      await this.leadActivityLogRepository.append({
        leadId,
        action: LeadActivityAction.ReplyExecuted,
        operatorId,
        toValue: record.id,
        note: 'Public comment reply executed',
      })
    }
    else {
      await this.leadActivityLogRepository.append({
        leadId,
        action: LeadActivityAction.ReplyFailed,
        operatorId,
        note: dto.failureReason || 'Public comment reply failed',
      })
    }

    return { record, success: dto.success }
  }

  private toAccountType(platform: string): AccountType {
    if (platform === 'xhs') return AccountType.Xhs
    if (platform === 'douyin') return AccountType.Douyin
    if (platform === 'kwai') return AccountType.KWAI
    return platform as AccountType
  }
}
```

- [ ] **Step 3: Run focused test**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/leads/reply-execution.service.spec.ts
```

Expected: unsafe reply is blocked, successful reply result writes a record and updates lead stage.

---

### Task 7: Add Frontend Lead Tracking API and Store

**Files:**
- Create: `project/aitoearn-web/src/api/types/acquisitionLeads.ts`
- Create: `project/aitoearn-web/src/api/acquisitionLeads.ts`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/useLeadTrackingStore.ts`

- [ ] **Step 1: Add frontend types**

```ts
export type AcquisitionLeadStage = 'new_comment' | 'replied' | 'messaged' | 'wechat_guided' | 'wechat_added' | 'lost'
export type AcquisitionLeadStatus = 'pending' | 'in_progress' | 'converted' | 'lost' | 'invalid'

export interface AcquisitionLead {
  id: string
  platform: 'xhs' | 'douyin' | 'kwai'
  accountId: string
  postId: string
  commentId: string
  parentCommentId?: string
  userName: string
  userAvatar?: string
  sourceContent: string
  stage: AcquisitionLeadStage
  status: AcquisitionLeadStatus
  assignee: string
  lastFollowUpAt?: string
  suggestedReply?: {
    content: string
    templateId: string
    model: string
    status: 'empty' | 'generated' | 'blocked' | 'edited'
    riskHits: string[]
    generatedAt?: string
  }
}

export interface AcquisitionLeadActivityLog {
  id: string
  leadId: string
  action: string
  operatorId: string
  fromValue?: string
  toValue?: string
  note?: string
  createdAt: string
}

export interface AcquisitionLeadListParams {
  platform?: string
  accountId?: string
  postId?: string
  stage?: AcquisitionLeadStage
  status?: AcquisitionLeadStatus
  assignee?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export interface AcquisitionLeadReplyPayload {
  leadId: string
  platform: 'xhs' | 'douyin' | 'kwai'
  accountId: string
  postId: string
  commentId: string
  parentCommentId?: string
  content: string
}
```

- [ ] **Step 2: Add API wrappers**

```ts
import type {
  AcquisitionLead,
  AcquisitionLeadActivityLog,
  AcquisitionLeadListParams,
  AcquisitionLeadReplyPayload,
  AcquisitionLeadStage,
} from '@/api/types/acquisitionLeads'
import http from '@/utils/request'

export function apiListAcquisitionLeads(params: AcquisitionLeadListParams) {
  return http.get<{ list: AcquisitionLead[], total: number, page: number, pageSize: number }>('acquisition/leads', params)
}

export function apiGetAcquisitionLead(leadId: string) {
  return http.get<AcquisitionLead>(`acquisition/leads/${leadId}`)
}

export function apiGetAcquisitionLeadTimeline(leadId: string) {
  return http.get<{ lead: AcquisitionLead, logs: AcquisitionLeadActivityLog[] }>(`acquisition/leads/${leadId}/timeline`)
}

export function apiMaterializeAcquisitionLeads(data: { platform?: string, accountId?: string, postId?: string, fetchBatch?: string, limit?: number }) {
  return http.post<{ scanned: number, createdOrUpdated: number }>('acquisition/leads/materialize', data)
}

export function apiChangeAcquisitionLeadStage(leadId: string, data: { stage: AcquisitionLeadStage, note?: string }) {
  return http.post<AcquisitionLead>(`acquisition/leads/${leadId}/stage`, data)
}

export function apiAssignAcquisitionLead(leadId: string, data: { assignee: string, note?: string }) {
  return http.post<AcquisitionLead>(`acquisition/leads/${leadId}/assign`, data)
}

export function apiClaimAcquisitionLead(leadId: string) {
  return http.post<AcquisitionLead>(`acquisition/leads/${leadId}/claim`, {})
}

export function apiTransferAcquisitionLead(leadId: string, data: { assignee: string, note: string }) {
  return http.post<AcquisitionLead>(`acquisition/leads/${leadId}/transfer`, data)
}

export function apiBatchAssignAcquisitionLeads(data: { leadIds: string[], assignee: string, note?: string }) {
  return http.post<{ updated: number }>('acquisition/leads/batch-assign', data)
}

export function apiAddAcquisitionLeadNote(leadId: string, data: { note: string }) {
  return http.post<AcquisitionLeadActivityLog>(`acquisition/leads/${leadId}/note`, data)
}

export function apiSuggestAcquisitionLeadReply(leadId: string, data: { model?: string, tone?: string, scene?: string }) {
  return http.post<{ lead: AcquisitionLead, suggestedReply: NonNullable<AcquisitionLead['suggestedReply']> }>(`acquisition/leads/${leadId}/suggest-reply`, data)
}

export function apiPrepareAcquisitionLeadReply(leadId: string, data: { content: string }) {
  return http.post<{ status: 'ready' | 'manual_required' | 'blocked', payload?: AcquisitionLeadReplyPayload, riskHits?: string[], reason?: string }>(`acquisition/leads/${leadId}/reply/prepare`, data)
}

export function apiRecordAcquisitionLeadReplyResult(leadId: string, data: { success: boolean, replyContent: string, platformReplyId?: string, failureReason?: string, screenshot?: string }) {
  return http.post<{ success: boolean }>(`acquisition/leads/${leadId}/reply/result`, data)
}
```

- [ ] **Step 3: Add Zustand store**

```ts
import { create } from 'zustand'
import type { AcquisitionLead, AcquisitionLeadListParams } from '@/api/types/acquisitionLeads'
import { apiGetAcquisitionLeadTimeline, apiListAcquisitionLeads } from '@/api/acquisitionLeads'

interface LeadTrackingState {
  filters: AcquisitionLeadListParams
  list: AcquisitionLead[]
  total: number
  loading: boolean
  selectedLead?: AcquisitionLead
  logs: any[]
  setFilters: (filters: Partial<AcquisitionLeadListParams>) => void
  fetchList: () => Promise<void>
  openLead: (lead: AcquisitionLead) => Promise<void>
}

export const useLeadTrackingStore = create<LeadTrackingState>((set, get) => ({
  filters: { page: 1, pageSize: 20 },
  list: [],
  total: 0,
  loading: false,
  logs: [],
  setFilters: filters => set(state => ({ filters: { ...state.filters, ...filters, page: filters.page || 1 } })),
  async fetchList() {
    set({ loading: true })
    try {
      const res = await apiListAcquisitionLeads(get().filters)
      set({ list: res.list, total: res.total })
    }
    finally {
      set({ loading: false })
    }
  },
  async openLead(lead) {
    const timeline = await apiGetAcquisitionLeadTimeline(lead.id)
    set({ selectedLead: timeline.lead, logs: timeline.logs })
  },
}))
```

- [ ] **Step 4: Run frontend type check**

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: type check passes for the new API and store files.

---

### Task 8: Add Lead Tracking UI and Browser Plugin Reply Execution

**Files:**
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/components/LeadTrackingPanel/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/components/LeadDetailDrawer/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/components/LeadAssignmentBar/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/components/LeadReplyComposer/index.tsx`
- Modify: `project/aitoearn-web/src/app/[lng]/acquisition/acquisitionPageCore.tsx`
- Modify: `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json`
- Modify: `project/aitoearn-web/src/app/i18n/locales/en/route.json`

- [ ] **Step 1: Add lead tracking panel**

Create `components/LeadTrackingPanel/index.tsx`:

```tsx
'use client'

import { Button, Input, Select, Table, Tag } from 'antd'
import { RefreshCcw } from 'lucide-react'
import { useEffect } from 'react'
import { useLeadTrackingStore } from '../../useLeadTrackingStore'
import { LeadAssignmentBar } from '../LeadAssignmentBar'
import { LeadDetailDrawer } from '../LeadDetailDrawer'

const stageOptions = [
  { value: 'new_comment', label: '新评论' },
  { value: 'replied', label: '已回复' },
  { value: 'messaged', label: '已私信' },
  { value: 'wechat_guided', label: '已引导微信' },
  { value: 'wechat_added', label: '已加微信' },
  { value: 'lost', label: '已流失' },
]

export function LeadTrackingPanel() {
  const { filters, list, total, loading, setFilters, fetchList, openLead } = useLeadTrackingStore()

  useEffect(() => {
    void fetchList()
  }, [])

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          allowClear
          className="w-32"
          placeholder="平台"
          options={[
            { value: 'xhs', label: '小红书' },
            { value: 'douyin', label: '抖音' },
            { value: 'kwai', label: '快手' },
          ]}
          value={filters.platform}
          onChange={value => setFilters({ platform: value })}
        />
        <Select
          allowClear
          className="w-36"
          placeholder="阶段"
          options={stageOptions}
          value={filters.stage}
          onChange={value => setFilters({ stage: value })}
        />
        <Input.Search
          className="w-64"
          placeholder="搜索昵称或评论"
          allowClear
          onSearch={keyword => setFilters({ keyword })}
        />
        <Button icon={<RefreshCcw size={16} />} onClick={() => fetchList()}>
          刷新
        </Button>
      </div>

      <LeadAssignmentBar />

      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        pagination={{
          current: filters.page || 1,
          pageSize: filters.pageSize || 20,
          total,
          onChange: (page, pageSize) => {
            setFilters({ page, pageSize })
            void fetchList()
          },
        }}
        columns={[
          { title: '用户', dataIndex: 'userName', width: 140 },
          { title: '平台', dataIndex: 'platform', width: 100 },
          { title: '评论', dataIndex: 'sourceContent', ellipsis: true },
          {
            title: '阶段',
            dataIndex: 'stage',
            width: 120,
            render: value => <Tag>{stageOptions.find(option => option.value === value)?.label || value}</Tag>,
          },
          { title: '负责人', dataIndex: 'assignee', width: 160, render: value => value || '未分配' },
          {
            title: '操作',
            width: 100,
            render: (_, lead) => <Button type="link" onClick={() => openLead(lead)}>查看</Button>,
          },
        ]}
      />

      <LeadDetailDrawer />
    </section>
  )
}
```

- [ ] **Step 2: Add assignment bar**

Create `components/LeadAssignmentBar/index.tsx`:

```tsx
'use client'

import { Button, Input } from 'antd'
import { useState } from 'react'
import { apiBatchAssignAcquisitionLeads } from '@/api/acquisitionLeads'
import { useLeadTrackingStore } from '../../useLeadTrackingStore'

export function LeadAssignmentBar() {
  const { list, fetchList } = useLeadTrackingStore()
  const [assignee, setAssignee] = useState('')

  async function assignVisibleUnassigned() {
    const leadIds = list.filter(lead => !lead.assignee).map(lead => lead.id)
    if (leadIds.length === 0 || !assignee) return
    await apiBatchAssignAcquisitionLeads({ leadIds, assignee, note: '批量分配当前页未分配线索' })
    await fetchList()
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        className="w-64"
        placeholder="负责人用户 ID"
        value={assignee}
        onChange={event => setAssignee(event.target.value)}
      />
      <Button onClick={assignVisibleUnassigned}>批量分配当前页未分配线索</Button>
    </div>
  )
}
```

- [ ] **Step 3: Add detail drawer and reply composer**

Create `components/LeadDetailDrawer/index.tsx`:

```tsx
'use client'

import { Button, Drawer, Select, Timeline } from 'antd'
import { apiChangeAcquisitionLeadStage, apiClaimAcquisitionLead } from '@/api/acquisitionLeads'
import type { AcquisitionLeadStage } from '@/api/types/acquisitionLeads'
import { useLeadTrackingStore } from '../../useLeadTrackingStore'
import { LeadReplyComposer } from '../LeadReplyComposer'

const stageOptions: Array<{ value: AcquisitionLeadStage, label: string }> = [
  { value: 'new_comment', label: '新评论' },
  { value: 'replied', label: '已回复' },
  { value: 'messaged', label: '已私信' },
  { value: 'wechat_guided', label: '已引导微信' },
  { value: 'wechat_added', label: '已加微信' },
  { value: 'lost', label: '已流失' },
]

export function LeadDetailDrawer() {
  const { selectedLead, logs, openLead, fetchList } = useLeadTrackingStore()
  const open = !!selectedLead

  async function changeStage(stage: AcquisitionLeadStage) {
    if (!selectedLead) return
    await apiChangeAcquisitionLeadStage(selectedLead.id, { stage })
    await openLead(selectedLead)
    await fetchList()
  }

  async function claim() {
    if (!selectedLead) return
    await apiClaimAcquisitionLead(selectedLead.id)
    await openLead(selectedLead)
    await fetchList()
  }

  return (
    <Drawer open={open} width={560} title="线索详情" onClose={() => useLeadTrackingStore.setState({ selectedLead: undefined, logs: [] })}>
      {selectedLead && (
        <div className="flex flex-col gap-5">
          <div className="rounded-md border border-border p-4">
            <div className="text-sm text-muted-foreground">{selectedLead.platform} / {selectedLead.accountId}</div>
            <div className="mt-2 text-base font-medium">{selectedLead.userName}</div>
            <p className="mt-2 text-sm">{selectedLead.sourceContent}</p>
          </div>

          <div className="flex items-center gap-2">
            <Select className="w-40" value={selectedLead.stage} options={stageOptions} onChange={changeStage} />
            <Button onClick={claim} disabled={!!selectedLead.assignee}>领取</Button>
          </div>

          <LeadReplyComposer lead={selectedLead} />

          <Timeline
            items={logs.map(log => ({
              children: (
                <div>
                  <div className="text-sm font-medium">{log.action}</div>
                  <div className="text-xs text-muted-foreground">{log.note || `${log.fromValue || ''} -> ${log.toValue || ''}`}</div>
                </div>
              ),
            }))}
          />
        </div>
      )}
    </Drawer>
  )
}
```

Create `components/LeadReplyComposer/index.tsx`:

```tsx
'use client'

import { Alert, Button, Input } from 'antd'
import { useState } from 'react'
import type { AcquisitionLead } from '@/api/types/acquisitionLeads'
import {
  apiPrepareAcquisitionLeadReply,
  apiRecordAcquisitionLeadReplyResult,
  apiSuggestAcquisitionLeadReply,
} from '@/api/acquisitionLeads'
import { douyinInteraction, xhsInteraction } from '@/store/plugin/plats'
import { useLeadTrackingStore } from '../../useLeadTrackingStore'

export function LeadReplyComposer({ lead }: { lead: AcquisitionLead }) {
  const { openLead, fetchList } = useLeadTrackingStore()
  const [content, setContent] = useState(lead.suggestedReply?.content || '')
  const [warning, setWarning] = useState('')

  async function suggest() {
    const result = await apiSuggestAcquisitionLeadReply(lead.id, { tone: 'friendly' })
    setContent(result.suggestedReply.content)
    setWarning(result.suggestedReply.riskHits.length > 0 ? `风险词：${result.suggestedReply.riskHits.join(', ')}` : '')
    await openLead(lead)
  }

  async function executeReply() {
    const prepared = await apiPrepareAcquisitionLeadReply(lead.id, { content })
    if (prepared.status === 'blocked') {
      setWarning(`回复被拦截：${prepared.riskHits?.join(', ') || ''}`)
      return
    }
    if (prepared.status === 'manual_required' || !prepared.payload) {
      setWarning(prepared.reason || '当前平台需要人工处理')
      return
    }

    try {
      if (prepared.payload.platform === 'xhs') {
        await xhsInteraction.replyComment({
          workId: prepared.payload.postId,
          commentId: prepared.payload.commentId,
          content: prepared.payload.content,
        })
      }
      else if (prepared.payload.platform === 'douyin') {
        await douyinInteraction.replyComment({
          workId: prepared.payload.postId,
          commentId: prepared.payload.commentId,
          content: prepared.payload.content,
        })
      }
      else {
        throw new Error('当前平台需要人工处理')
      }
      await apiRecordAcquisitionLeadReplyResult(lead.id, { success: true, replyContent: content })
      await openLead(lead)
      await fetchList()
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await apiRecordAcquisitionLeadReplyResult(lead.id, { success: false, replyContent: content, failureReason: message })
      setWarning(message)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      {warning && <Alert type="warning" showIcon message={warning} />}
      <Input.TextArea rows={4} value={content} onChange={event => setContent(event.target.value)} />
      <div className="flex gap-2">
        <Button onClick={suggest}>生成建议回复</Button>
        <Button type="primary" onClick={executeReply}>人工确认并回复</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Mount lead panel under leads tab**

In `acquisitionPageCore.tsx`, import `LeadTrackingPanel` and render it only for the `leads` tab:

```tsx
import { LeadTrackingPanel } from './components/LeadTrackingPanel'

// inside the TabsContent render branch
{tab.value === 'leads' ? (
  <LeadTrackingPanel />
) : (
  <section className="rounded-lg border border-border bg-card p-6">
    {/* existing placeholder content */}
  </section>
)}
```

- [ ] **Step 5: Add i18n keys**

Add flat keys to `route.json`:

```json
{
  "acquisition.leads.searchPlaceholder": "搜索昵称或评论",
  "acquisition.leads.refresh": "刷新",
  "acquisition.leads.batchAssignVisible": "批量分配当前页未分配线索",
  "acquisition.leads.detail": "线索详情",
  "acquisition.leads.suggestReply": "生成建议回复",
  "acquisition.leads.confirmReply": "人工确认并回复"
}
```

Add English equivalents:

```json
{
  "acquisition.leads.searchPlaceholder": "Search nickname or comment",
  "acquisition.leads.refresh": "Refresh",
  "acquisition.leads.batchAssignVisible": "Assign visible unassigned leads",
  "acquisition.leads.detail": "Lead detail",
  "acquisition.leads.suggestReply": "Generate suggested reply",
  "acquisition.leads.confirmReply": "Confirm and reply"
}
```

- [ ] **Step 6: Verify frontend**

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: type check passes.

---

### Task 9: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run backend focused tests**

```bash
cd project/aitoearn-backend
pnpm exec vitest run \
  apps/aitoearn-server/src/core/acquisition/leads/lead-materialization.service.spec.ts \
  apps/aitoearn-server/src/core/acquisition/leads/lead-management.service.spec.ts \
  apps/aitoearn-server/src/core/acquisition/leads/reply-suggestion.service.spec.ts \
  apps/aitoearn-server/src/core/acquisition/leads/reply-execution.service.spec.ts
```

Expected: all focused tests pass.

- [ ] **Step 2: Run backend build**

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build passes.

- [ ] **Step 3: Run frontend type check**

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: type check passes.

- [ ] **Step 4: Manual smoke test**

Start local services:

```bash
./scripts/local-restart.sh --skip-build
```

Open:

```text
http://127.0.0.1:6061/zh-CN/acquisition
```

Expected:

- `线索追踪` tab renders the lead table.
- Clicking `物化评论线索` endpoint via API or test client creates leads from existing comment snapshots.
- Filters by platform, stage, assignee, and keyword update the table.
- Opening a lead shows source comment and timeline.
- `生成建议回复` creates a suggestion or shows risk hits.
- Replies containing `微信` or phone numbers are blocked before plugin execution.
- XHS/Douyin reply confirmation calls the browser plugin path and then records success/failure.
- Stage transitions write activity logs and update `lastFollowUpAt`.

- [ ] **Step 5: Git diff check**

```bash
git diff --check
```

Expected: no whitespace errors.

---

## Phase 3 Non-Goals

- No fully automatic private-message sending.
- No complete CRM after WeChat add; Phase 3 stops at `wechat_added`.
- No transaction amount, order amount, refund, commission, or sales attribution.
- No role/permission system beyond current authenticated operator identity.
- No Kwai public reply automation until platform capability is confirmed.
- No strategy-performance dashboard; that belongs to Phase 4 or V1 after leads have enough usage data.

---

## Spec Coverage Checklist

| PRD item | Covered by |
|---|---|
| 5.4.2 线索列表页 | Task 4, Task 7, Task 8 |
| 5.4.3 阶段流转 | Task 4, Task 8 |
| 5.4.4 AI 建议回复生成 | Task 5, Task 8 |
| 5.4.5 人工确认后回复执行 | Task 6, Task 8 |
| 5.4.6 回复结果回写 | Task 1, Task 6 |
| 5.4.7 多运营人员分配/领取/转派 | Task 4, Task 8 |
| 5.4.8 操作日志 | Task 1, Task 4, Task 5, Task 6 |
| 5.4.9 对话详情抽屉 | Task 4, Task 8 |
| 5.4.10 线索归因字段 | Task 1, Task 3 |
| 5.4.11 批量分配 | Task 4, Task 8 |
| 公开评论不允许直接出现微信号 | Task 5, Task 6 |
| 第一阶段只统计到加微信线索 | Task 4 stage/status mapping |
