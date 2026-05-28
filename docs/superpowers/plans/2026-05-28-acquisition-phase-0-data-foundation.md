# Acquisition Phase 0 Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 0 data foundation for the multi-platform acquisition workspace: Mongo schemas/repositories, acquisition BullMQ queues, sensitive-word checking, and a navigable frontend route shell.

**Architecture:** Persist acquisition data in `@yikart/channel-db` using the existing Mongoose schema and `BaseRepository` pattern. Register four BullMQ queue names through the existing `QueueName` enum and `QueueService` injection model. Add a lightweight NestJS `SensitiveWordModule` in `aitoearn-server`, and add a Next.js App Router `/acquisition` shell with five tabs.

**Tech Stack:** NestJS, Mongoose, BullMQ, Nx, Vitest, Next.js App Router, React, Tailwind CSS, lucide-react, pnpm

---

## Source Context

- PRD source: `docs/product-requirements/2026-05-27-multi-platform-clothing-acquisition-prd.md`, Section 13, Phase 0.
- Backend workspace: `project/aitoearn-backend`.
- Frontend workspace: `project/aitoearn-web`.
- Do not run package commands from repository root.
- Backend validation command: `cd project/aitoearn-backend && pnpm nx run aitoearn-server:build`.
- Frontend validation command: `cd project/aitoearn-web && pnpm run type-check`.

---

## File Structure

### Backend Channel DB (`project/aitoearn-backend/libs/channel-db/src/`)

| File | Responsibility |
|---|---|
| `schemas/post-snapshot.schema.ts` | Store fetched post/work detail snapshots and raw/normalized metrics. |
| `schemas/comment-snapshot.schema.ts` | Store fetched comment snapshots with platform user/comment metadata. |
| `schemas/lead.schema.ts` | Store acquisition lead lifecycle state and weak attribution fields. |
| `schemas/lead-activity-log.schema.ts` | Store assignment, transfer, stage-change, and note operation logs. |
| `schemas/hook-template.schema.ts` | Store content hook templates for generation and strategy iteration. |
| `schemas/script-template.schema.ts` | Store reply/private-message script templates and risk constraints. |
| `schemas/account-ops-config.schema.ts` | Store account-level acquisition limits and behavior switches. |
| `schemas/index.ts` | Export and register the seven new schemas in `schemas`. |
| `repositories/*.repository.ts` | One repository per new schema, extending `BaseRepository<T>`. |
| `repositories/index.ts` | Export and register the seven new repositories in `repositories`. |

### Backend Queue (`project/aitoearn-backend/libs/aitoearn-queue/src/`)

| File | Responsibility |
|---|---|
| `enums/queue-name.enum.ts` | Add four acquisition queue names. |
| `interfaces/acquisition.interface.ts` | Define data contracts for the four acquisition queue jobs. |
| `interfaces/index.ts` | Export acquisition queue interfaces. |
| `queue.service.ts` | Inject four queues and expose `addAcquisition*Job` methods. |

### Backend Sensitive Word (`project/aitoearn-backend/apps/aitoearn-server/src/core/sensitive-word/`)

| File | Responsibility |
|---|---|
| `sensitive-word.module.ts` | Nest module exporting `SensitiveWordService`. |
| `sensitive-word.service.ts` | TypeScript DFA keyword matcher plus phone and URL checks. |
| `sensitive-word.service.spec.ts` | Unit tests for WeChat variants, phone, URL, and custom account words. |
| `../../app.module.ts` | Register `SensitiveWordModule`. |

### Frontend Route (`project/aitoearn-web/src/app/[lng]/acquisition/`)

| File | Responsibility |
|---|---|
| `page.tsx` | Server page with `generateMetadata()` and `<AcquisitionPageCore />`. |
| `acquisitionPageCore.tsx` | Client component with five tab placeholders. |
| `src/app/layout/routerData.tsx` | Add sidebar/navigation entry with `Target` icon. |
| `src/app/i18n/locales/zh-CN/route.json` | Add `header.acquisition` translation. |
| `src/app/i18n/locales/en/route.json` | Add `header.acquisition` translation. |

---

## Implementation Tasks

### Task 1: Add Acquisition Schemas

**Files:**
- Create: `project/aitoearn-backend/libs/channel-db/src/schemas/post-snapshot.schema.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/schemas/comment-snapshot.schema.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/schemas/lead.schema.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/schemas/lead-activity-log.schema.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/schemas/hook-template.schema.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/schemas/script-template.schema.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/schemas/account-ops-config.schema.ts`

- [ ] **Step 1: Create `post-snapshot.schema.ts`**

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

@Schema({ _id: false })
export class PostSnapshotMetrics {
  @Prop({ type: Object, default: {} })
  raw: Record<string, unknown>

  @Prop({ type: Object, default: {} })
  normalized: Record<string, number>
}

const PostSnapshotMetricsSchema = SchemaFactory.createForClass(PostSnapshotMetrics)

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'post_snapshot' })
export class PostSnapshot extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  platform: string

  @Prop({ required: true, index: true, type: String })
  accountId: string

  @Prop({ required: true, index: true, type: String })
  postId: string

  @Prop({ type: String, default: '' })
  postUrl: string

  @Prop({ type: String, default: '' })
  title: string

  @Prop({ type: String, default: '' })
  cover: string

  @Prop({ type: PostSnapshotMetricsSchema, default: () => ({}) })
  metrics: PostSnapshotMetrics

  @Prop({ type: Date, required: true, index: true })
  fetchedAt: Date

  @Prop({ required: true, index: true, type: String })
  fetchDate: string

  @Prop({ required: true, index: true, type: String })
  dataSource: string
}

export const PostSnapshotSchema = SchemaFactory.createForClass(PostSnapshot)
```

- [ ] **Step 2: Create `comment-snapshot.schema.ts`**

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'comment_snapshot' })
export class CommentSnapshot extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  platform: string

  @Prop({ required: true, index: true, type: String })
  accountId: string

  @Prop({ required: true, index: true, type: String })
  postId: string

  @Prop({ required: true, index: true, type: String })
  commentId: string

  @Prop({ type: String, default: '', index: true })
  parentCommentId: string

  @Prop({ type: String, default: '' })
  xsecToken: string

  @Prop({ type: String, default: '' })
  userName: string

  @Prop({ type: String, default: '' })
  userAvatar: string

  @Prop({ required: true, type: String })
  content: string

  @Prop({ type: Number, default: 0 })
  likeCount: number

  @Prop({ type: String, default: '' })
  ipLocation: string

  @Prop({ type: Date, default: null, index: true })
  commentedAt?: Date

  @Prop({ required: true, index: true, type: String })
  fetchBatch: string

  @Prop({ required: true, index: true, type: String })
  dataSource: string
}

export const CommentSnapshotSchema = SchemaFactory.createForClass(CommentSnapshot)
```

- [ ] **Step 3: Create `lead.schema.ts`**

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum LeadStage {
  NewComment = 'new_comment',
  Replied = 'replied',
  Messaged = 'messaged',
  WechatGuided = 'wechat_guided',
  WechatAdded = 'wechat_added',
  Lost = 'lost',
}

export enum LeadStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Converted = 'converted',
  Lost = 'lost',
  Invalid = 'invalid',
}

@Schema({ _id: false })
export class LeadAttribution {
  @Prop({ type: String, default: '' })
  hookTemplateId: string

  @Prop({ type: String, default: '' })
  scriptTemplateId: string

  @Prop({ type: Number, default: 0 })
  confidence: number
}

const LeadAttributionSchema = SchemaFactory.createForClass(LeadAttribution)

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'lead' })
export class Lead extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  platform: string

  @Prop({ required: true, index: true, type: String })
  accountId: string

  @Prop({ required: true, index: true, type: String })
  postId: string

  @Prop({ type: String, default: '', index: true })
  commentId: string

  @Prop({ type: String, default: '' })
  userName: string

  @Prop({ required: true, enum: LeadStage, default: LeadStage.NewComment, index: true })
  stage: LeadStage

  @Prop({ required: true, enum: LeadStatus, default: LeadStatus.Pending, index: true })
  status: LeadStatus

  @Prop({ type: String, default: '', index: true })
  assignee: string

  @Prop({ type: LeadAttributionSchema, default: () => ({}) })
  attribution: LeadAttribution

  @Prop({ type: Date, default: null, index: true })
  lastFollowUpAt?: Date
}

export const LeadSchema = SchemaFactory.createForClass(Lead)
```

- [ ] **Step 4: Create `lead-activity-log.schema.ts`**

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum LeadActivityAction {
  Assigned = 'assigned',
  Claimed = 'claimed',
  Transferred = 'transferred',
  StageChanged = 'stage_changed',
  NoteAdded = 'note_added',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'lead_activity_log' })
export class LeadActivityLog extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  leadId: string

  @Prop({ required: true, enum: LeadActivityAction, index: true })
  action: LeadActivityAction

  @Prop({ required: true, index: true, type: String })
  operatorId: string

  @Prop({ type: String, default: '' })
  fromValue: string

  @Prop({ type: String, default: '' })
  toValue: string

  @Prop({ type: String, default: '' })
  note: string
}

export const LeadActivityLogSchema = SchemaFactory.createForClass(LeadActivityLog)
```

- [ ] **Step 5: Create `hook-template.schema.ts`**

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum HookTemplateCategory {
  FollowGuide = 'follow_guide',
  PrivateMessageGuide = 'private_message_guide',
  ProfileGuide = 'profile_guide',
  BenefitGuide = 'benefit_guide',
  StockUrgency = 'stock_urgency',
  SizeConsulting = 'size_consulting',
  WechatGuide = 'wechat_guide',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'hook_template' })
export class HookTemplate extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  name: string

  @Prop({ required: true, enum: HookTemplateCategory, index: true })
  category: HookTemplateCategory

  @Prop({ required: true, type: String })
  content: string

  @Prop({ type: Number, default: 1 })
  weight: number

  @Prop({ type: Boolean, default: true, index: true })
  enabled: boolean

  @Prop({ type: [String], default: [] })
  applicablePlatforms: string[]

  @Prop({ type: [String], default: [] })
  applicableCategories: string[]

  @Prop({ type: [String], default: [] })
  applicableAccountIds: string[]
}

export const HookTemplateSchema = SchemaFactory.createForClass(HookTemplate)
```

- [ ] **Step 6: Create `script-template.schema.ts`**

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum ScriptTemplateScene {
  CommentAskPrice = 'comment_ask_price',
  CommentAskLink = 'comment_ask_link',
  CommentAskSize = 'comment_ask_size',
  CommentPraise = 'comment_praise',
  CommentPriceObjection = 'comment_price_objection',
  CommentNegative = 'comment_negative',
  PrivateMessageFirst = 'private_message_first',
  PrivateMessageValue = 'private_message_value',
  PrivateMessageWechatGuide = 'private_message_wechat_guide',
}

export enum ScriptTemplateRiskLevel {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

@Schema({ _id: false })
export class ScriptPlatformConstraints {
  @Prop({ type: Boolean, default: false })
  allowWechatId: boolean

  @Prop({ type: Boolean, default: true })
  requireManualConfirm: boolean

  @Prop({ type: [String], default: [] })
  blockedPlatforms: string[]
}

const ScriptPlatformConstraintsSchema = SchemaFactory.createForClass(ScriptPlatformConstraints)

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'script_template' })
export class ScriptTemplate extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  name: string

  @Prop({ required: true, enum: ScriptTemplateScene, index: true })
  scene: ScriptTemplateScene

  @Prop({ required: true, type: String })
  content: string

  @Prop({ type: [String], default: [] })
  variables: string[]

  @Prop({ type: Boolean, default: true, index: true })
  enabled: boolean

  @Prop({ type: [String], default: [] })
  applicableCategories: string[]

  @Prop({ required: true, enum: ScriptTemplateRiskLevel, default: ScriptTemplateRiskLevel.Low, index: true })
  riskLevel: ScriptTemplateRiskLevel

  @Prop({ type: ScriptPlatformConstraintsSchema, default: () => ({}) })
  platformConstraints: ScriptPlatformConstraints
}

export const ScriptTemplateSchema = SchemaFactory.createForClass(ScriptTemplate)
```

- [ ] **Step 7: Create `account-ops-config.schema.ts`**

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'account_ops_config' })
export class AccountOpsConfig extends BaseTemp {
  id: string

  @Prop({ required: true, unique: true, index: true, type: String })
  accountId: string

  @Prop({ type: Number, default: 10 })
  dailyPublishLimit: number

  @Prop({ type: Number, default: 50 })
  dailyInteractionLimit: number

  @Prop({ type: Number, default: 20 })
  dailyCommentFetchLimit: number

  @Prop({ type: String, default: '' })
  defaultWechatId: string

  @Prop({ type: String, default: '' })
  defaultScriptStrategy: string

  @Prop({ type: Boolean, default: true })
  enableAutoGenerate: boolean

  @Prop({ type: Boolean, default: true })
  enableCommentFetch: boolean

  @Prop({ type: [String], default: [] })
  sensitiveWords: string[]
}

export const AccountOpsConfigSchema = SchemaFactory.createForClass(AccountOpsConfig)
```

- [ ] **Step 8: Run backend type check/build to expose registration gaps**

Run:

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build fails because the new schemas are not exported/registered yet. This failure is expected before Task 3.

---

### Task 2: Add Acquisition Repositories

**Files:**
- Create: `project/aitoearn-backend/libs/channel-db/src/repositories/post-snapshot.repository.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/repositories/comment-snapshot.repository.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/repositories/lead.repository.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/repositories/lead-activity-log.repository.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/repositories/hook-template.repository.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/repositories/script-template.repository.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/repositories/account-ops-config.repository.ts`

- [ ] **Step 1: Create repository files with the established pattern**

Use this exact pattern for each file, replacing class/model names:

```ts
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { PostSnapshot } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class PostSnapshotRepository extends BaseRepository<PostSnapshot> {
  constructor(
    @InjectModel(PostSnapshot.name, DB_CONNECTION_NAME) private postSnapshotModel: Model<PostSnapshot>,
  ) {
    super(postSnapshotModel)
  }
}
```

Create the six remaining repositories with the same shape:

| File | Class | Model type |
|---|---|---|
| `comment-snapshot.repository.ts` | `CommentSnapshotRepository` | `CommentSnapshot` |
| `lead.repository.ts` | `LeadRepository` | `Lead` |
| `lead-activity-log.repository.ts` | `LeadActivityLogRepository` | `LeadActivityLog` |
| `hook-template.repository.ts` | `HookTemplateRepository` | `HookTemplate` |
| `script-template.repository.ts` | `ScriptTemplateRepository` | `ScriptTemplate` |
| `account-ops-config.repository.ts` | `AccountOpsConfigRepository` | `AccountOpsConfig` |

- [ ] **Step 2: Run backend build to expose index registration gaps**

Run:

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build fails because repository imports from `../schemas` require schema exports in `schemas/index.ts`. This failure is expected before Task 3.

---

### Task 3: Register Schemas and Repositories

**Files:**
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/index.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/index.ts`

- [ ] **Step 1: Add schema imports and exports**

Add these imports to `schemas/index.ts`:

```ts
import { AccountOpsConfig, AccountOpsConfigSchema } from './account-ops-config.schema'
import { CommentSnapshot, CommentSnapshotSchema } from './comment-snapshot.schema'
import { HookTemplate, HookTemplateSchema } from './hook-template.schema'
import { LeadActivityLog, LeadActivityLogSchema } from './lead-activity-log.schema'
import { Lead, LeadSchema } from './lead.schema'
import { PostSnapshot, PostSnapshotSchema } from './post-snapshot.schema'
import { ScriptTemplate, ScriptTemplateSchema } from './script-template.schema'
```

Add these exports:

```ts
export * from './account-ops-config.schema'
export * from './comment-snapshot.schema'
export * from './hook-template.schema'
export * from './lead-activity-log.schema'
export * from './lead.schema'
export * from './post-snapshot.schema'
export * from './script-template.schema'
```

- [ ] **Step 2: Add schemas to the `schemas` array**

Append these entries before the closing `] as const`:

```ts
  { name: AccountOpsConfig.name, schema: AccountOpsConfigSchema },
  { name: CommentSnapshot.name, schema: CommentSnapshotSchema },
  { name: HookTemplate.name, schema: HookTemplateSchema },
  { name: Lead.name, schema: LeadSchema },
  { name: LeadActivityLog.name, schema: LeadActivityLogSchema },
  { name: PostSnapshot.name, schema: PostSnapshotSchema },
  { name: ScriptTemplate.name, schema: ScriptTemplateSchema },
```

- [ ] **Step 3: Add repository imports and exports**

Add these imports to `repositories/index.ts`:

```ts
import { AccountOpsConfigRepository } from './account-ops-config.repository'
import { CommentSnapshotRepository } from './comment-snapshot.repository'
import { HookTemplateRepository } from './hook-template.repository'
import { LeadActivityLogRepository } from './lead-activity-log.repository'
import { LeadRepository } from './lead.repository'
import { PostSnapshotRepository } from './post-snapshot.repository'
import { ScriptTemplateRepository } from './script-template.repository'
```

Add these exports:

```ts
export * from './account-ops-config.repository'
export * from './comment-snapshot.repository'
export * from './hook-template.repository'
export * from './lead-activity-log.repository'
export * from './lead.repository'
export * from './post-snapshot.repository'
export * from './script-template.repository'
```

- [ ] **Step 4: Add repositories to the `repositories` array**

Append these providers before the closing `] as const`:

```ts
  AccountOpsConfigRepository,
  CommentSnapshotRepository,
  HookTemplateRepository,
  LeadRepository,
  LeadActivityLogRepository,
  PostSnapshotRepository,
  ScriptTemplateRepository,
```

- [ ] **Step 5: Verify backend build passes**

Run:

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: `aitoearn-server:build` completes successfully.

- [ ] **Step 6: Commit**

```bash
git add project/aitoearn-backend/libs/channel-db/src/schemas project/aitoearn-backend/libs/channel-db/src/repositories
git commit -m "feat(acquisition): add phase zero channel db models"
```

---

### Task 4: Add Acquisition BullMQ Queues

**Files:**
- Modify: `project/aitoearn-backend/libs/aitoearn-queue/src/enums/queue-name.enum.ts`
- Create: `project/aitoearn-backend/libs/aitoearn-queue/src/interfaces/acquisition.interface.ts`
- Modify: `project/aitoearn-backend/libs/aitoearn-queue/src/interfaces/index.ts`
- Modify: `project/aitoearn-backend/libs/aitoearn-queue/src/queue.service.ts`

- [ ] **Step 1: Add queue enum values**

Add to `QueueName`:

```ts
  /** 获客评论抓取队列 */
  AcquisitionCommentFetch = 'acquisition_comment_fetch',

  /** 获客作品回填队列 */
  AcquisitionPostBackfill = 'acquisition_post_backfill',

  /** 获客线索通知队列 */
  AcquisitionLeadNotify = 'acquisition_lead_notify',

  /** 获客敏感词检查队列 */
  AcquisitionSensitiveCheck = 'acquisition_sensitive_check',
```

- [ ] **Step 2: Add acquisition queue interfaces**

Create `interfaces/acquisition.interface.ts`:

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

export interface AcquisitionLeadNotifyData {
  leadId: string
  operatorId?: string
  reason: 'created' | 'assigned' | 'stage_changed' | 'timeout'
}

export interface AcquisitionSensitiveCheckData {
  accountId?: string
  text: string
  context: 'public_comment' | 'private_message' | 'hook_template' | 'script_template'
}
```

Export it from `interfaces/index.ts`:

```ts
export * from './acquisition.interface'
```

- [ ] **Step 3: Import acquisition interfaces in `queue.service.ts`**

Add to the existing type import block:

```ts
  AcquisitionCommentFetchData,
  AcquisitionLeadNotifyData,
  AcquisitionPostBackfillData,
  AcquisitionSensitiveCheckData,
```

- [ ] **Step 4: Inject acquisition queues in `QueueService`**

Add these constructor injections after `userEventBatchQueue`:

```ts
    @InjectQueue(QueueName.AcquisitionCommentFetch)
    private acquisitionCommentFetchQueue: Queue,
    @InjectQueue(QueueName.AcquisitionPostBackfill)
    private acquisitionPostBackfillQueue: Queue,
    @InjectQueue(QueueName.AcquisitionLeadNotify)
    private acquisitionLeadNotifyQueue: Queue,
    @InjectQueue(QueueName.AcquisitionSensitiveCheck)
    private acquisitionSensitiveCheckQueue: Queue,
```

- [ ] **Step 5: Add job methods**

Add near the bottom of `QueueService`:

```ts
  async addAcquisitionCommentFetchJob(data: AcquisitionCommentFetchData, options?: JobsOptions) {
    return await this.acquisitionCommentFetchQueue.add('fetch-comments', data, {
      ...this.defaultOptions,
      jobId: `${data.platform}:${data.accountId}:${data.postId || data.postUrl}:${data.fetchBatch}`,
      ...options,
    })
  }

  async addAcquisitionPostBackfillJob(data: AcquisitionPostBackfillData, options?: JobsOptions) {
    return await this.acquisitionPostBackfillQueue.add('backfill-post', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addAcquisitionLeadNotifyJob(data: AcquisitionLeadNotifyData, options?: JobsOptions) {
    return await this.acquisitionLeadNotifyQueue.add('notify-lead', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addAcquisitionSensitiveCheckJob(data: AcquisitionSensitiveCheckData, options?: JobsOptions) {
    return await this.acquisitionSensitiveCheckQueue.add('check-sensitive', data, {
      ...this.defaultOptions,
      ...options,
    })
  }
```

- [ ] **Step 6: Verify backend build passes**

Run:

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build passes. `AitoearnQueueModule` registers the queue names through `Object.values(QueueName)` automatically.

- [ ] **Step 7: Commit**

```bash
git add project/aitoearn-backend/libs/aitoearn-queue/src
git commit -m "feat(acquisition): register phase zero queues"
```

---

### Task 5: Add Sensitive Word Service

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/sensitive-word/sensitive-word.module.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/sensitive-word/sensitive-word.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/sensitive-word/sensitive-word.service.spec.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/app.module.ts`

- [ ] **Step 1: Write service unit tests**

Create `sensitive-word.service.spec.ts`:

```ts
import { SensitiveWordService } from './sensitive-word.service'

describe('SensitiveWordService', () => {
  const service = new SensitiveWordService()

  it('blocks WeChat variants in public text', () => {
    expect(service.check('加我v信abc')).toEqual({
      passed: false,
      hits: ['v信'],
    })
  })

  it('blocks phone numbers', () => {
    const result = service.check('联系 13812345678')
    expect(result.passed).toBe(false)
    expect(result.hits).toContain('13812345678')
  })

  it('blocks URLs', () => {
    const result = service.check('更多信息看 https://example.com/a')
    expect(result.passed).toBe(false)
    expect(result.hits).toContain('https://example.com/a')
  })

  it('supports account custom words', () => {
    expect(service.check('这件衣服可以走私域', ['私域'])).toEqual({
      passed: false,
      hits: ['私域'],
    })
  })

  it('passes normal public replies', () => {
    expect(service.check('可以私信我，我发你尺码建议')).toEqual({
      passed: true,
      hits: [],
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails before implementation**

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/sensitive-word/sensitive-word.service.spec.ts
```

Expected: fails because `SensitiveWordService` does not exist yet.

- [ ] **Step 3: Implement `sensitive-word.service.ts`**

```ts
import { Injectable } from '@nestjs/common'

interface DfaNode {
  children: Map<string, DfaNode>
  word?: string
}

export interface SensitiveWordCheckResult {
  passed: boolean
  hits: string[]
}

const DEFAULT_WORDS = [
  'v信',
  'vx',
  'wx',
  '微信',
  '薇信',
  '威信',
  '加我',
  '➕我',
  '企微',
]

const PHONE_PATTERN = /(?<!\d)1[3-9]\d{9}(?!\d)/g
const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+/gi

@Injectable()
export class SensitiveWordService {
  check(text: string, customWords: string[] = []): SensitiveWordCheckResult {
    const hits = [
      ...this.matchWords(text, [...DEFAULT_WORDS, ...customWords]),
      ...this.matchPattern(text, PHONE_PATTERN),
      ...this.matchPattern(text, URL_PATTERN),
    ]
    const uniqueHits = Array.from(new Set(hits))
    return {
      passed: uniqueHits.length === 0,
      hits: uniqueHits,
    }
  }

  private matchWords(text: string, words: string[]): string[] {
    const root = this.buildTree(words)
    const hits: string[] = []

    for (let start = 0; start < text.length; start += 1) {
      let node = root
      for (let index = start; index < text.length; index += 1) {
        const char = text[index].toLowerCase()
        const next = node.children.get(char)
        if (!next)
          break
        node = next
        if (node.word) {
          hits.push(node.word)
          break
        }
      }
    }

    return hits
  }

  private buildTree(words: string[]): DfaNode {
    const root: DfaNode = { children: new Map() }

    for (const word of words.filter(Boolean)) {
      let node = root
      for (const char of word.toLowerCase()) {
        let next = node.children.get(char)
        if (!next) {
          next = { children: new Map() }
          node.children.set(char, next)
        }
        node = next
      }
      node.word = word
    }

    return root
  }

  private matchPattern(text: string, pattern: RegExp): string[] {
    pattern.lastIndex = 0
    return Array.from(text.matchAll(pattern), match => match[0])
  }
}
```

- [ ] **Step 4: Add module**

Create `sensitive-word.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { SensitiveWordService } from './sensitive-word.service'

@Module({
  providers: [SensitiveWordService],
  exports: [SensitiveWordService],
})
export class SensitiveWordModule {}
```

- [ ] **Step 5: Register module in `app.module.ts`**

Add import:

```ts
import { SensitiveWordModule } from './core/sensitive-word/sensitive-word.module'
```

Add to `imports` near other core modules:

```ts
    SensitiveWordModule,
```

- [ ] **Step 6: Verify unit test passes**

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/sensitive-word/sensitive-word.service.spec.ts
```

Expected: all five tests pass.

- [ ] **Step 7: Verify backend build passes**

Run:

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build passes.

- [ ] **Step 8: Commit**

```bash
git add project/aitoearn-backend/apps/aitoearn-server/src/core/sensitive-word project/aitoearn-backend/apps/aitoearn-server/src/app.module.ts
git commit -m "feat(acquisition): add sensitive word checker"
```

---

### Task 6: Add Frontend Acquisition Route Shell

**Files:**
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/page.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/acquisitionPageCore.tsx`

- [ ] **Step 1: Create `page.tsx`**

```tsx
import type { Metadata } from 'next'
import { useTranslation } from '@/app/i18n'
import { fallbackLng, languages } from '@/app/i18n/settings'
import { getMetadata } from '@/utils/general'
import { AcquisitionPageCore } from './acquisitionPageCore'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lng: string }>
}): Promise<Metadata> {
  let { lng } = await params
  if (!languages.includes(lng))
    lng = fallbackLng
  const { t } = await useTranslation(lng, 'route')

  return getMetadata(
    {
      title: t('header.acquisition'),
      description: t('header.acquisition'),
      keywords: t('header.acquisition'),
    },
    lng,
  )
}

export default function AcquisitionPage() {
  return <AcquisitionPageCore />
}
```

- [ ] **Step 2: Create `acquisitionPageCore.tsx`**

```tsx
'use client'

import { BarChart3, FileText, MessageSquareText, Target, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const tabs = [
  { value: 'dashboard', label: '数据看板', icon: BarChart3 },
  { value: 'content', label: '内容管理', icon: FileText },
  { value: 'hooks', label: '引流管理', icon: Target },
  { value: 'leads', label: '线索追踪', icon: MessageSquareText },
  { value: 'accounts', label: '多账号管理', icon: UsersRound },
]

export function AcquisitionPageCore() {
  const { t } = useTranslation('route')

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">{t('header.acquisition')}</h1>
          <p className="text-sm text-muted-foreground">多平台服装 AI 获客工作台</p>
        </header>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:inline-grid lg:w-auto lg:grid-cols-5">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-2 px-3 py-2">
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsContent key={tab.value} value={tab.value} className="mt-5">
                <section className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                      <Icon size={20} />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-foreground">{tab.label}</h2>
                      <p className="text-sm text-muted-foreground">Phase 0 路由骨架，后续阶段接入真实数据。</p>
                    </div>
                  </div>
                </section>
              </TabsContent>
            )
          })}
        </Tabs>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Verify frontend type check fails before navigation/i18n registration if imports are missing**

Run:

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: type check passes because the project already uses `react-i18next` in client components and `@/components/ui/tabs` is already available.

---

### Task 7: Register Frontend Navigation and i18n

**Files:**
- Modify: `project/aitoearn-web/src/app/layout/routerData.tsx`
- Modify: `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json`
- Modify: `project/aitoearn-web/src/app/i18n/locales/en/route.json`

- [ ] **Step 1: Add `Target` icon import**

Modify the lucide import in `routerData.tsx`:

```tsx
import {
  Bot,
  ChartNoAxesCombined,
  History,
  Home,
  Sparkles,
  Store,
  Target,
  Upload,
  WalletCards,
} from 'lucide-react'
```

- [ ] **Step 2: Add navigation item**

Insert after `AI Publish` or before `XHS Data`:

```tsx
  {
    name: 'Acquisition',
    translationKey: 'header.acquisition',
    path: '/acquisition',
    icon: <Target size={20} />,
  },
```

- [ ] **Step 3: Add route translations**

Add to `zh-CN/route.json`:

```json
"header.acquisition": "获客工作台"
```

Add to `en/route.json`:

```json
"header.acquisition": "Acquisition"
```

Keep valid JSON commas around the inserted key.

- [ ] **Step 4: Verify frontend type check**

Run:

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: type check passes.

- [ ] **Step 5: Start frontend and inspect route**

Run:

```bash
cd project/aitoearn-web
pnpm dev
```

Expected: dev server starts. Visit `http://localhost:6061/zh-CN/acquisition` or the dev server URL printed in the terminal. The page shows five tabs: 数据看板、内容管理、引流管理、线索追踪、多账号管理.

- [ ] **Step 6: Commit**

```bash
git add project/aitoearn-web/src/app/[lng]/acquisition project/aitoearn-web/src/app/layout/routerData.tsx project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json project/aitoearn-web/src/app/i18n/locales/en/route.json
git commit -m "feat(acquisition): add workspace route shell"
```

---

### Task 8: Final Integration Verification

**Files:**
- Verify only; no planned edits.

- [ ] **Step 1: Run backend build**

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build passes.

- [ ] **Step 2: Run sensitive-word unit test**

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/sensitive-word/sensitive-word.service.spec.ts
```

Expected: all tests pass, including the case where `"加我v信xxx"` returns `passed: false` and includes `"v信"` in `hits`.

- [ ] **Step 3: Run frontend type check**

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: type check passes.

- [ ] **Step 4: Check whitespace**

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Review changed files**

```bash
git status --short
```

Expected: only Phase 0 files are changed. Existing unrelated local changes remain untouched.

- [ ] **Step 6: Final commit**

```bash
git add project/aitoearn-backend project/aitoearn-web
git commit -m "feat(acquisition): complete phase zero data foundation"
```

If previous task-level commits were already created, skip this final commit and report the task-level commit hashes instead.

---

## Acceptance Criteria

- Seven new channel-db schemas exist, inherit `BaseTemp`, use `DEFAULT_SCHEMA_OPTIONS`, and specify the requested collection names.
- Seven repositories exist and are registered in `repositories/index.ts`.
- The seven schemas are exported and registered in `schemas/index.ts`.
- Four acquisition queues are present in `QueueName`.
- `QueueService` exposes add methods for the four acquisition queues.
- `SensitiveWordService.check(text, customWords?)` returns `{ passed: boolean, hits: string[] }`.
- `SensitiveWordService` blocks WeChat variants, phone numbers, URLs, and account custom words.
- `SensitiveWordModule` is imported by `AppModule`.
- `/acquisition` route exists and renders five tabs.
- `header.acquisition` exists in `zh-CN` and `en` route locale files.
- Backend build, sensitive-word unit test, frontend type check, and `git diff --check` pass.

---

## Known Non-Goals For Phase 0

- Do not implement actual comment fetching consumers.
- Do not implement post backfill consumers.
- Do not implement lead notification delivery.
- Do not implement acquisition APIs for list/create/update operations.
- Do not implement real dashboard data.
- Do not change existing publishing, XHS Bridge, Douyin, or Kwai platform behavior.
