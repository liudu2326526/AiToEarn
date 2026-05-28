# Acquisition Phase 2 Content Generation and Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 2 acquisition workflow so operators can manage hook/script/strategy assets, generate clothing-specific multi-platform content, review generated drafts, and schedule approved content through the existing publish pipeline.

**Architecture:** Keep strategy assets in the Phase 0 `hook_template`, `script_template`, and `account_ops_config` collections, then add an `acquisition_content` workflow record for generated content review state. Backend owns CRUD, weighted hook selection, clothing prompt construction, structured AI output validation, sensitive-word blocking, state transitions, and scheduling through `PublishingService`; frontend owns the acquisition content and strategy management UI under the existing `[lng]/acquisition` route.

**Tech Stack:** NestJS, Mongoose repositories from `@yikart/channel-db`, `@yikart/aitoearn-ai-client`, existing `SensitiveWordService`, existing `PublishingService`, Zod DTOs with `createZodDto`, `@ApiDoc`, Next.js App Router, Zustand, Ant Design/Radix/Tailwind, Lucide icons, pnpm/Nx/Vitest

---

## Preconditions

- Phase 0 data foundation exists:
  - `HookTemplateRepository`
  - `ScriptTemplateRepository`
  - `AccountOpsConfigRepository`
  - `SensitiveWordModule`
  - acquisition route shell at `project/aitoearn-web/src/app/[lng]/acquisition/`
- Phase 1 can be implemented in parallel. Phase 2 does not require `post_snapshot` or `comment_snapshot`.
- Existing AI draft-generation APIs remain available through `AiService`:
  - `chatCompletion()` with `messages`, `model`, `userId`, and `userType`
  - `createDraftV2()`
  - `createImageTextDraft()`
  - `queryDraftTasks()`
- Existing publishing APIs remain the only publish channel. Phase 2 creates/schedules publish records through `PublishingService`; it does not add platform-specific publish providers.
- First phase platforms are exactly:
  - `xhs`
  - `douyin`
  - `kwai`

---

## File Structure

### Backend Data Layer

| File | Responsibility |
|---|---|
| `project/aitoearn-backend/libs/channel-db/src/schemas/acquisition-content.schema.ts` | New generated-content workflow record for review, schedule, and publish linkage. |
| `project/aitoearn-backend/libs/channel-db/src/schemas/account-ops-config.schema.ts` | Extend strategy config with per-platform script scenes, tone, WeChat guide limit, and public reply constraints. |
| `project/aitoearn-backend/libs/channel-db/src/schemas/index.ts` | Export and register `AcquisitionContent`. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/acquisition-content.repository.ts` | Query and mutate generated-content workflow records. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/hook-template.repository.ts` | Add CRUD, weighted selection, enable/disable, and duplicate-name helpers. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/script-template.repository.ts` | Add CRUD, scene filtering, enable/disable, and duplicate-name helpers. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/account-ops-config.repository.ts` | Add upsert/read helpers for strategy config. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/index.ts` | Export and register `AcquisitionContentRepository`. |

### Backend Acquisition Phase 2 Module

| File | Responsibility |
|---|---|
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/acquisition-content.constants.ts` | Platform constants, content statuses, platform limits, and fallback prompt values. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/acquisition-content.dto.ts` | Zod DTOs for content generation, review, schedule, list, detail, and template/config CRUD. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/acquisition-content.vo.ts` | Zod VOs for controller responses and paginated content lists. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/platform-content-adapter.service.ts` | Normalize generated content to XHS/Douyin/Kwai length/topic limits. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/hook-selection.service.ts` | Select enabled hooks by platform/account/category with deterministic weighted behavior. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/content-generation.service.ts` | Build clothing prompt, call AI, validate structured output, apply hooks, persist draft content. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/content-review.service.ts` | Enforce draft -> pending_review -> approved/rejected -> scheduled -> published/failed transitions. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/content-schedule.service.ts` | Convert approved generated content into publish tasks through `PublishingService`. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/strategy-template.service.ts` | CRUD and safety checks for hook templates, script templates, and account ops config. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/acquisition-content.controller.ts` | Authenticated REST endpoints for Phase 2 content workflows. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/*.spec.ts` | Focused tests for template validation, hook selection, AI output validation, state transitions, and scheduling. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts` | Register Phase 2 content services/controller and import `SensitiveWordModule`, `AitoearnAiClientModule`, and publishing module dependency. |

### Frontend Acquisition UI

| File | Responsibility |
|---|---|
| `project/aitoearn-web/src/api/types/acquisitionContent.ts` | Content, template, strategy config, and schedule response types. |
| `project/aitoearn-web/src/api/acquisitionContent.ts` | Client API wrappers for Phase 2 endpoints. |
| `project/aitoearn-web/src/app/[lng]/acquisition/useContentGenerationStore.ts` | Page-local Zustand store for generation form, content list, selected content, and async loading states. |
| `project/aitoearn-web/src/app/[lng]/acquisition/useStrategyTemplateStore.ts` | Page-local Zustand store for hooks, scripts, and account config. |
| `project/aitoearn-web/src/app/[lng]/acquisition/components/ContentManagementPanel/index.tsx` | Main content-management tab with generation form and review list. |
| `project/aitoearn-web/src/app/[lng]/acquisition/components/ContentGenerationForm/index.tsx` | Product input, platform/account selection, media options, and generate action. |
| `project/aitoearn-web/src/app/[lng]/acquisition/components/GeneratedContentPreview/index.tsx` | Platform-specific title/body/topics preview and edit controls. |
| `project/aitoearn-web/src/app/[lng]/acquisition/components/ContentReviewBoard/index.tsx` | Draft/review/approved/scheduled list with state actions. |
| `project/aitoearn-web/src/app/[lng]/acquisition/components/SchedulePublishDrawer/index.tsx` | Publish-time/account selection and schedule confirmation. |
| `project/aitoearn-web/src/app/[lng]/acquisition/components/StrategyManagementPanel/index.tsx` | Main hook/script/account-config tab. |
| `project/aitoearn-web/src/app/[lng]/acquisition/components/HookTemplateManager/index.tsx` | Hook CRUD, enable/disable, platform/category/account scopes. |
| `project/aitoearn-web/src/app/[lng]/acquisition/components/ScriptTemplateManager/index.tsx` | Script CRUD, scene/risk/variables/platform constraints. |
| `project/aitoearn-web/src/app/[lng]/acquisition/components/AccountOpsConfigPanel/index.tsx` | Account daily limits, default strategy, tone, and sensitive words. |
| `project/aitoearn-web/src/app/[lng]/acquisition/acquisitionPageCore.tsx` | Mount `ContentManagementPanel` and `StrategyManagementPanel`; replace hard-coded tab labels with i18n keys. |
| `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json` | Add acquisition Phase 2 route/UI translation keys. |
| `project/aitoearn-web/src/app/i18n/locales/en/route.json` | Add English acquisition Phase 2 route/UI translation keys. |

---

## Design Decisions

1. **Do not overload `PublishRecord`:** `PublishRecord` represents actual publish jobs. Phase 2 needs a pre-publish review object, so add `acquisition_content` and link it to generated publish records through `publishRecordIds`.
2. **Strategy assets stay reusable:** `HookTemplate`, `ScriptTemplate`, and `AccountOpsConfig` remain generic enough for Phase 3 reply suggestions and Phase 5 optimization.
3. **Platform enum values are explicit and Phase 1 compatible:** acquisition-domain DTOs and records must use `z.enum(['xhs', 'douyin', 'kwai'])`, matching Phase 1 `AcquisitionPlatform.Kwai = 'kwai'`. Only the scheduling boundary maps `kwai` to publishing `AccountType.KWAI`.
4. **Public content safety:** generated public title/body/topics and hook text must pass `SensitiveWordService.check()`. Public content cannot include phone numbers, URLs, or WeChat variants.
5. **WeChat is private/manual only:** `defaultWechatId` may be stored for account config but must not be inserted into public generated content. Templates containing `{wechat_id}` are allowed only for private/manual scenes.
6. **Generation failure is visible:** failed AI parsing or sensitive-word hits create an `acquisition_content` record with `status = generation_failed` and `failureReason`, so operators can see what failed.
7. **Scheduling uses existing publishing service:** approved platform variants become publish tasks by calling `PublishingService.createPublishingTask()`. No new XHS/Douyin/Kwai publishing code is introduced.
8. **Frontend component folders:** every new frontend component uses its own folder with `index.tsx`.

---

## Implementation Tasks

### Task 1: Add `AcquisitionContent` Schema and Repository

**Files:**
- Create: `project/aitoearn-backend/libs/channel-db/src/schemas/acquisition-content.schema.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/repositories/acquisition-content.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/index.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/index.ts`

- [ ] **Step 1: Write repository tests**

Create `project/aitoearn-backend/libs/channel-db/src/repositories/acquisition-content.repository.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AcquisitionContentRepository } from './acquisition-content.repository'
import { AcquisitionContentStatus } from '../schemas/acquisition-content.schema'

function createModel() {
  return {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  }
}

describe('AcquisitionContentRepository', () => {
  const model = createModel()
  const repository = new AcquisitionContentRepository(model as ConstructorParameters<typeof AcquisitionContentRepository>[0])

  beforeEach(() => vi.clearAllMocks())

  it('creates a generated content workflow record', async () => {
    model.create.mockResolvedValue({ id: 'content-1', status: AcquisitionContentStatus.PendingReview })

    const result = await repository.createByUser({
      userId: 'user-1',
      productName: '通勤针织裙',
      productCategory: '裙子',
      targetPlatforms: ['xhs', 'douyin'],
      status: AcquisitionContentStatus.PendingReview,
      platformContents: [],
    })

    expect(result.id).toBe('content-1')
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      productName: '通勤针织裙',
      status: AcquisitionContentStatus.PendingReview,
    }))
  })

  it('updates status with optimistic version increment', async () => {
    model.findOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ id: 'content-1', status: AcquisitionContentStatus.Approved, version: 2 }),
      }),
    })

    const result = await repository.updateStatus('content-1', 'user-1', AcquisitionContentStatus.Approved)

    expect(result?.status).toBe(AcquisitionContentStatus.Approved)
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'content-1', userId: 'user-1' },
      { $set: { status: AcquisitionContentStatus.Approved }, $inc: { version: 1 } },
      { new: true },
    )
  })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run libs/channel-db/src/repositories/acquisition-content.repository.spec.ts
```

Expected: FAIL because `acquisition-content.schema.ts` and `AcquisitionContentRepository` do not exist.

- [ ] **Step 3: Add schema**

Create `project/aitoearn-backend/libs/channel-db/src/schemas/acquisition-content.schema.ts`:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export const ACQUISITION_PLATFORMS = ['xhs', 'douyin', 'kwai'] as const
export type AcquisitionPlatform = (typeof ACQUISITION_PLATFORMS)[number]

export enum AcquisitionContentStatus {
  Draft = 'draft',
  PendingReview = 'pending_review',
  Approved = 'approved',
  Rejected = 'rejected',
  Scheduled = 'scheduled',
  Published = 'published',
  PublishFailed = 'publish_failed',
  GenerationFailed = 'generation_failed',
}

@Schema({ _id: false })
export class AcquisitionGeneratedHook {
  @Prop({ type: String, default: '' })
  hookTemplateId: string

  @Prop({ type: String, default: '' })
  content: string

  @Prop({ type: String, default: '' })
  category: string
}

export const AcquisitionGeneratedHookSchema = SchemaFactory.createForClass(AcquisitionGeneratedHook)

@Schema({ _id: false })
export class AcquisitionPlatformContent {
  @Prop({ required: true, enum: ACQUISITION_PLATFORMS, index: true })
  platform: AcquisitionPlatform

  @Prop({ type: String, default: '' })
  accountId: string

  @Prop({ type: String, default: '' })
  title: string

  @Prop({ type: String, default: '' })
  body: string

  @Prop({ type: [String], default: [] })
  topics: string[]

  @Prop({ type: Date, default: null })
  suggestedPublishAt?: Date

  @Prop({ type: AcquisitionGeneratedHookSchema, default: () => ({}) })
  hook: AcquisitionGeneratedHook

  @Prop({ type: String, default: '' })
  strategyNote: string

  @Prop({ type: String, default: '' })
  publishRecordId: string
}

export const AcquisitionPlatformContentSchema = SchemaFactory.createForClass(AcquisitionPlatformContent)

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'acquisition_content' })
export class AcquisitionContent extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  userId: string

  @Prop({ required: true, type: String })
  productName: string

  @Prop({ required: true, index: true, type: String })
  productCategory: string

  @Prop({ type: String, default: '' })
  priceRange: string

  @Prop({ type: String, default: '' })
  sizeRange: string

  @Prop({ type: String, default: '' })
  sellingPoints: string

  @Prop({ type: String, default: '' })
  contentStyle: string

  @Prop({ type: [String], default: [] })
  referenceImageUrls: string[]

  @Prop({ type: [String], default: [] })
  targetPlatforms: AcquisitionPlatform[]

  @Prop({ required: true, enum: AcquisitionContentStatus, default: AcquisitionContentStatus.Draft, index: true })
  status: AcquisitionContentStatus

  @Prop({ type: [AcquisitionPlatformContentSchema], default: [] })
  platformContents: AcquisitionPlatformContent[]

  @Prop({ type: [String], default: [] })
  draftTaskIds: string[]

  @Prop({ type: String, default: '' })
  generatedByModel: string

  @Prop({ type: String, default: '' })
  failureReason: string

  @Prop({ type: String, default: '' })
  reviewerId: string

  @Prop({ type: String, default: '' })
  reviewNote: string

  @Prop({ type: Date, default: null })
  reviewedAt?: Date

  @Prop({ type: Date, default: null })
  scheduledAt?: Date

  @Prop({ type: Number, default: 0 })
  version: number
}

export const AcquisitionContentSchema = SchemaFactory.createForClass(AcquisitionContent)
AcquisitionContentSchema.index({ userId: 1, status: 1, createdAt: -1 })
AcquisitionContentSchema.index({ userId: 1, productCategory: 1, createdAt: -1 })
```

- [ ] **Step 4: Add repository**

Create `project/aitoearn-backend/libs/channel-db/src/repositories/acquisition-content.repository.ts`:

```ts
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, RootFilterQuery } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { AcquisitionContent, AcquisitionContentStatus } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class AcquisitionContentRepository extends BaseRepository<AcquisitionContent> {
  constructor(
    @InjectModel(AcquisitionContent.name, DB_CONNECTION_NAME)
    private readonly acquisitionContentModel: Model<AcquisitionContent>,
  ) {
    super(acquisitionContentModel)
  }

  async createByUser(data: Partial<AcquisitionContent> & { userId: string }) {
    return await this.acquisitionContentModel.create(data)
  }

  async listByUser(query: {
    userId: string
    status?: AcquisitionContentStatus
    platform?: string
    productCategory?: string
    page: number
    pageSize: number
  }) {
    const filter: RootFilterQuery<AcquisitionContent> = {
      userId: query.userId,
      ...(query.status && { status: query.status }),
      ...(query.productCategory && { productCategory: query.productCategory }),
      ...(query.platform && { targetPlatforms: query.platform }),
    }
    const skip = (query.page - 1) * query.pageSize
    const [list, total] = await Promise.all([
      this.acquisitionContentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.pageSize).lean({ virtuals: true }).exec(),
      this.acquisitionContentModel.countDocuments(filter).exec(),
    ])
    return [list, total] as const
  }

  async getByIdAndUserId(id: string, userId: string) {
    return await this.acquisitionContentModel.findOne({ _id: id, userId }).lean({ virtuals: true }).exec()
  }

  async updateStatus(id: string, userId: string, status: AcquisitionContentStatus, extra: Partial<AcquisitionContent> = {}) {
    return await this.acquisitionContentModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { status, ...extra }, $inc: { version: 1 } },
      { new: true },
    ).lean({ virtuals: true }).exec()
  }

  async updatePlatformContents(id: string, userId: string, platformContents: AcquisitionContent['platformContents']) {
    return await this.acquisitionContentModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { platformContents }, $inc: { version: 1 } },
      { new: true },
    ).lean({ virtuals: true }).exec()
  }
}
```

- [ ] **Step 5: Register schema and repository**

In `project/aitoearn-backend/libs/channel-db/src/schemas/index.ts`:

```ts
import { AcquisitionContent, AcquisitionContentSchema } from './acquisition-content.schema'

export * from './acquisition-content.schema'

export const schemas = [
  // existing schemas...
  { name: AcquisitionContent.name, schema: AcquisitionContentSchema },
]
```

In `project/aitoearn-backend/libs/channel-db/src/repositories/index.ts`:

```ts
import { AcquisitionContentRepository } from './acquisition-content.repository'

export * from './acquisition-content.repository'

export const repositories = [
  // existing repositories...
  AcquisitionContentRepository,
]
```

- [ ] **Step 6: Run repository test**

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run libs/channel-db/src/repositories/acquisition-content.repository.spec.ts
```

Expected: PASS.

---

### Task 2: Add Strategy Repository Helpers and Safety Rules

**Files:**
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/account-ops-config.schema.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/hook-template.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/script-template.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/account-ops-config.repository.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/strategy-template.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/strategy-template.service.spec.ts`

- [ ] **Step 1: Write strategy service tests**

Create `strategy-template.service.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HookTemplateCategory, ScriptTemplateRiskLevel, ScriptTemplateScene } from '@yikart/channel-db'
import { ResponseCode } from '@yikart/common'
import { StrategyTemplateService } from './strategy-template.service'

describe('StrategyTemplateService', () => {
  const hookTemplateRepository = {
    create: vi.fn(),
    findByName: vi.fn(),
  }
  const scriptTemplateRepository = {
    create: vi.fn(),
  }
  const accountOpsConfigRepository = {
    upsertByAccountId: vi.fn(),
  }
  const sensitiveWordService = {
    check: vi.fn(),
  }
  const service = new StrategyTemplateService(
    hookTemplateRepository as ConstructorParameters<typeof StrategyTemplateService>[0],
    scriptTemplateRepository as ConstructorParameters<typeof StrategyTemplateService>[1],
    accountOpsConfigRepository as ConstructorParameters<typeof StrategyTemplateService>[2],
    sensitiveWordService as ConstructorParameters<typeof StrategyTemplateService>[3],
  )

  beforeEach(() => vi.clearAllMocks())

  it('blocks public hook templates that contain wechat words', async () => {
    sensitiveWordService.check.mockReturnValue({ passed: false, hits: ['微信'] })

    await expect(service.createHookTemplate('user-1', {
      name: '加微信钩子',
      category: HookTemplateCategory.WechatGuide,
      content: '加我微信领取福利',
      weight: 1,
      enabled: true,
      applicablePlatforms: ['xhs'],
      applicableCategories: ['裙子'],
      applicableAccountIds: [],
    })).rejects.toMatchObject({ code: ResponseCode.ValidationFailed })
  })

  it('allows private wechat script only when allowWechatId is true', async () => {
    sensitiveWordService.check.mockReturnValue({ passed: false, hits: ['微信'] })
    scriptTemplateRepository.create.mockResolvedValue({ id: 'script-1' })

    const result = await service.createScriptTemplate('user-1', {
      name: '私信第三轮',
      scene: ScriptTemplateScene.PrivateMessageWechatGuide,
      content: '可以加微信 {wechat_id} 给你发尺码表',
      variables: ['wechat_id'],
      enabled: true,
      applicableCategories: ['裙子'],
      riskLevel: ScriptTemplateRiskLevel.High,
      platformConstraints: {
        allowWechatId: true,
        requireManualConfirm: true,
        blockedPlatforms: [],
      },
    })

    expect(result.id).toBe('script-1')
  })
})
```

- [ ] **Step 2: Run failing test**

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/content/strategy-template.service.spec.ts
```

Expected: FAIL because `StrategyTemplateService` does not exist.

- [ ] **Step 3: Extend `AccountOpsConfig`**

Add these fields to `account-ops-config.schema.ts`:

```ts
@Prop({ type: Number, default: 10 })
dailyWechatGuideLimit: number

@Prop({ type: [String], default: [] })
enabledScriptSceneIds: string[]

@Prop({ type: [String], default: [] })
preferredHookTemplateIds: string[]

@Prop({ type: String, default: 'friendly' })
replyTone: 'friendly' | 'professional' | 'promotion' | 'restrained'

@Prop({ type: Boolean, default: true })
blockPublicContactInfo: boolean
```

- [ ] **Step 4: Add repository helpers**

Add to `HookTemplateRepository`:

```ts
async findByName(name: string) {
  return await this.hookTemplateModel.findOne({ name }).lean({ virtuals: true }).exec()
}

async listEnabledForSelection(query: {
  platform: string
  accountId?: string
  category?: string
}) {
  return await this.hookTemplateModel.find({
    enabled: true,
    $and: [
      { $or: [{ applicablePlatforms: { $size: 0 } }, { applicablePlatforms: query.platform }] },
      { $or: [{ applicableAccountIds: { $size: 0 } }, { applicableAccountIds: query.accountId || '' }] },
      { $or: [{ applicableCategories: { $size: 0 } }, { applicableCategories: query.category || '' }] },
    ],
  }).lean({ virtuals: true }).exec()
}

async setEnabled(id: string, enabled: boolean) {
  return await this.updateOne({ _id: id }, { $set: { enabled } })
}
```

Add to `ScriptTemplateRepository`:

```ts
async findByName(name: string) {
  return await this.scriptTemplateModel.findOne({ name }).lean({ virtuals: true }).exec()
}

async listByScene(scene: string, category?: string) {
  return await this.scriptTemplateModel.find({
    scene,
    enabled: true,
    $or: [{ applicableCategories: { $size: 0 } }, { applicableCategories: category || '' }],
  }).lean({ virtuals: true }).exec()
}

async setEnabled(id: string, enabled: boolean) {
  return await this.updateOne({ _id: id }, { $set: { enabled } })
}
```

Fix or add to `AccountOpsConfigRepository`:

```ts
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

async getByAccountId(accountId: string) {
  return await this.accountOpsConfigModel.findOne({ accountId }).lean({ virtuals: true }).exec()
}
```

- [ ] **Step 5: Implement strategy service**

Create `strategy-template.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import {
  AccountOpsConfigRepository,
  HookTemplateCategory,
  HookTemplateRepository,
  ScriptTemplateRepository,
  ScriptTemplateScene,
} from '@yikart/channel-db'
import { AppException, ResponseCode } from '@yikart/common'
import { SensitiveWordService } from '../../sensitive-word/sensitive-word.service'

const PRIVATE_WECHAT_SCENES = new Set<string>([
  ScriptTemplateScene.PrivateMessageWechatGuide,
])

@Injectable()
export class StrategyTemplateService {
  constructor(
    private readonly hookTemplateRepository: HookTemplateRepository,
    private readonly scriptTemplateRepository: ScriptTemplateRepository,
    private readonly accountOpsConfigRepository: AccountOpsConfigRepository,
    private readonly sensitiveWordService: SensitiveWordService,
  ) {}

  async createHookTemplate(_userId: string, data: Parameters<HookTemplateRepository['create']>[0]) {
    const risk = this.sensitiveWordService.check(data.content || '')
    if (!risk.passed) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'content', reason: 'public_hook_blocked_words', hits: risk.hits })
    }
    const duplicated = await this.hookTemplateRepository.findByName(String(data.name))
    if (duplicated) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'hook_template_name_exists' })
    }
    return await this.hookTemplateRepository.create(data)
  }

  async createScriptTemplate(_userId: string, data: Parameters<ScriptTemplateRepository['create']>[0]) {
    const content = String(data.content || '')
    const risk = this.sensitiveWordService.check(content)
    const allowWechatId = Boolean(data.platformConstraints?.allowWechatId)
    const isPrivateWechatScene = PRIVATE_WECHAT_SCENES.has(String(data.scene))
    if (!risk.passed && (!allowWechatId || !isPrivateWechatScene)) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'content', reason: 'script_template_blocked_public_words', hits: risk.hits })
    }
    const duplicated = await this.scriptTemplateRepository.findByName(String(data.name))
    if (duplicated) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'script_template_name_exists' })
    }
    return await this.scriptTemplateRepository.create(data)
  }

  async upsertAccountConfig(accountId: string, data: Parameters<AccountOpsConfigRepository['upsertByAccountId']>[1]) {
    return await this.accountOpsConfigRepository.upsertByAccountId(accountId, data)
  }
}
```

- [ ] **Step 6: Run strategy tests**

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/content/strategy-template.service.spec.ts
```

Expected: PASS.

---

### Task 3: Add DTOs, Constants, and Controller Shell

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/acquisition-content.constants.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/acquisition-content.dto.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/acquisition-content.vo.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/acquisition-content.controller.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts`

- [ ] **Step 1: Add constants**

Create `acquisition-content.constants.ts`:

```ts
export const ACQUISITION_PLATFORM_VALUES = ['xhs', 'douyin', 'kwai'] as const
export const ACQUISITION_CONTENT_STATUS_VALUES = [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'scheduled',
  'published',
  'publish_failed',
  'generation_failed',
] as const

export const ACQUISITION_REPLY_TONE_VALUES = ['friendly', 'professional', 'promotion', 'restrained'] as const

export const PLATFORM_CONTENT_LIMITS = {
  xhs: { titleMax: 20, bodyMax: 1000, topicMax: 5, supportsImageText: true, supportsVideo: true },
  douyin: { titleMax: 80, bodyMax: 2000, topicMax: 10, supportsImageText: false, supportsVideo: true },
  kwai: { titleMax: 80, bodyMax: 500, topicMax: 4, supportsImageText: false, supportsVideo: true },
} as const
```

- [ ] **Step 2: Add DTOs**

Create `acquisition-content.dto.ts`. Every schema field uses `.describe()`, and all enums use explicit value arrays:

```ts
import { createZodDto } from '@yikart/common'
import { z } from 'zod'
import {
  ACQUISITION_CONTENT_STATUS_VALUES,
  ACQUISITION_PLATFORM_VALUES,
  ACQUISITION_REPLY_TONE_VALUES,
} from './acquisition-content.constants'

export const AcquisitionPlatformSchema = z.enum(ACQUISITION_PLATFORM_VALUES).describe('获客平台')

export const GenerateAcquisitionContentSchema = z.object({
  accountIds: z.array(z.string().min(1).describe('账号 ID')).min(1).describe('发布账号 ID 列表'),
  platforms: z.array(AcquisitionPlatformSchema).min(1).describe('目标平台列表'),
  productName: z.string().min(1).max(80).describe('产品名称'),
  productCategory: z.string().min(1).max(40).describe('产品类型，如裙子、牛仔裤、通勤套装'),
  priceRange: z.string().max(40).optional().describe('价格区间'),
  sizeRange: z.string().max(80).optional().describe('尺码范围'),
  sellingPoints: z.string().min(1).max(800).describe('面料、版型、卖点'),
  contentStyle: z.string().max(40).optional().describe('内容风格'),
  referenceImageUrls: z.array(z.url().describe('参考图片 URL')).max(9).default([]).describe('产品图片或参考图片'),
  autoAttachHook: z.boolean().default(true).describe('是否自动附加引流钩子'),
  generateMedia: z.boolean().default(false).describe('是否调用现有 AI 草稿能力生成图文或视频素材'),
  mediaMode: z.enum(['image_text', 'video']).default('image_text').describe('素材生成模式'),
  chatModel: z.string().default('gpt-5.5').describe('内容规划 Chat 模型'),
  model: z.string().optional().describe('视频生成模型'),
  imageModel: z.string().optional().describe('图文生成模型'),
})
export class GenerateAcquisitionContentDto extends createZodDto(GenerateAcquisitionContentSchema, 'GenerateAcquisitionContentDto') {}

export const ListAcquisitionContentSchema = z.object({
  status: z.enum(ACQUISITION_CONTENT_STATUS_VALUES).optional().describe('内容状态'),
  platform: AcquisitionPlatformSchema.optional().describe('平台筛选'),
  productCategory: z.string().optional().describe('产品类型筛选'),
  page: z.coerce.number().int().min(1).default(1).describe('页码'),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).describe('每页数量'),
})
export class ListAcquisitionContentDto extends createZodDto(ListAcquisitionContentSchema, 'ListAcquisitionContentDto') {}

export const ReviewAcquisitionContentSchema = z.object({
  action: z.enum(['approve', 'reject']).describe('审核动作'),
  note: z.string().max(500).optional().describe('审核备注'),
})
export class ReviewAcquisitionContentDto extends createZodDto(ReviewAcquisitionContentSchema, 'ReviewAcquisitionContentDto') {}

export const UpdatePlatformContentSchema = z.object({
  platform: AcquisitionPlatformSchema.describe('平台'),
  title: z.string().max(100).describe('标题'),
  body: z.string().max(2200).describe('正文'),
  topics: z.array(z.string().min(1).max(40).describe('话题')).max(10).describe('话题列表'),
})
export class UpdatePlatformContentDto extends createZodDto(UpdatePlatformContentSchema, 'UpdatePlatformContentDto') {}

export const ScheduleAcquisitionContentSchema = z.object({
  publishAt: z.coerce.date().describe('发布时间'),
  accountMap: z.record(AcquisitionPlatformSchema, z.string().min(1).describe('账号 ID')).describe('平台到账户 ID 的映射'),
})
export class ScheduleAcquisitionContentDto extends createZodDto(ScheduleAcquisitionContentSchema, 'ScheduleAcquisitionContentDto') {}

export const UpsertAccountOpsConfigSchema = z.object({
  dailyPublishLimit: z.number().int().min(0).max(100).describe('每日发布上限'),
  dailyInteractionLimit: z.number().int().min(0).max(1000).describe('每日互动上限'),
  dailyCommentFetchLimit: z.number().int().min(0).max(1000).describe('每日评论抓取上限'),
  dailyWechatGuideLimit: z.number().int().min(0).max(1000).describe('每日引导微信上限'),
  defaultWechatId: z.string().max(80).optional().describe('默认微信号，仅私聊人工确认场景使用'),
  defaultScriptStrategy: z.string().max(80).optional().describe('默认话术策略'),
  replyTone: z.enum(ACQUISITION_REPLY_TONE_VALUES).default('friendly').describe('回复语气'),
  enableAutoGenerate: z.boolean().describe('是否启用自动内容生成'),
  enableCommentFetch: z.boolean().describe('是否启用评论抓取'),
  blockPublicContactInfo: z.boolean().default(true).describe('公开内容是否拦截联系方式'),
  sensitiveWords: z.array(z.string().min(1).max(80).describe('敏感词')).max(200).describe('自定义敏感词'),
})
export class UpsertAccountOpsConfigDto extends createZodDto(UpsertAccountOpsConfigSchema, 'UpsertAccountOpsConfigDto') {}
```

- [ ] **Step 3: Add response VOs**

Create `acquisition-content.vo.ts`:

```ts
import { createPaginationVo, createZodDto } from '@yikart/common'
import { z } from 'zod'
import {
  ACQUISITION_CONTENT_STATUS_VALUES,
  ACQUISITION_PLATFORM_VALUES,
} from './acquisition-content.constants'

const AcquisitionGeneratedHookVoSchema = z.object({
  hookTemplateId: z.string().optional(),
  content: z.string().optional(),
  category: z.string().optional(),
})

export const AcquisitionPlatformContentVoSchema = z.object({
  platform: z.enum(ACQUISITION_PLATFORM_VALUES),
  accountId: z.string().optional(),
  title: z.string(),
  body: z.string(),
  topics: z.array(z.string()),
  suggestedPublishAt: z.coerce.date().nullable().optional(),
  hook: AcquisitionGeneratedHookVoSchema.optional(),
  strategyNote: z.string().optional(),
  publishRecordId: z.string().optional(),
})

export const AcquisitionContentVoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  productName: z.string(),
  productCategory: z.string(),
  priceRange: z.string().optional(),
  sizeRange: z.string().optional(),
  sellingPoints: z.string().optional(),
  contentStyle: z.string().optional(),
  referenceImageUrls: z.array(z.string()).default([]),
  targetPlatforms: z.array(z.enum(ACQUISITION_PLATFORM_VALUES)),
  status: z.enum(ACQUISITION_CONTENT_STATUS_VALUES),
  platformContents: z.array(AcquisitionPlatformContentVoSchema).default([]),
  draftTaskIds: z.array(z.string()).default([]),
  generatedByModel: z.string().optional(),
  failureReason: z.string().optional(),
  reviewerId: z.string().optional(),
  reviewNote: z.string().optional(),
  reviewedAt: z.coerce.date().nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export class AcquisitionContentVo extends createZodDto(AcquisitionContentVoSchema, 'AcquisitionContentVo') {}
export class AcquisitionContentListVo extends createPaginationVo(AcquisitionContentVoSchema, 'AcquisitionContentListVo') {}

export const AccountOpsConfigVoSchema = z.object({
  id: z.string().optional(),
  accountId: z.string(),
  dailyPublishLimit: z.number().optional(),
  dailyInteractionLimit: z.number().optional(),
  dailyCommentFetchLimit: z.number().optional(),
  dailyWechatGuideLimit: z.number().optional(),
  defaultWechatId: z.string().optional(),
  defaultScriptStrategy: z.string().optional(),
  replyTone: z.string().optional(),
  enableAutoGenerate: z.boolean().optional(),
  enableCommentFetch: z.boolean().optional(),
  blockPublicContactInfo: z.boolean().optional(),
  sensitiveWords: z.array(z.string()).optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
})
export class AccountOpsConfigVo extends createZodDto(AccountOpsConfigVoSchema, 'AccountOpsConfigVo') {}
```

- [ ] **Step 4: Add controller shell**

Create `acquisition-content.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiDoc, GetToken } from '@yikart/common'
import { TokenInfo } from '../../user/comment'
import {
  GenerateAcquisitionContentDto,
  ListAcquisitionContentDto,
  ReviewAcquisitionContentDto,
  ScheduleAcquisitionContentDto,
  UpdatePlatformContentDto,
  UpsertAccountOpsConfigDto,
} from './acquisition-content.dto'
import { AccountOpsConfigVo, AcquisitionContentListVo, AcquisitionContentVo } from './acquisition-content.vo'
import { ContentGenerationService } from './content-generation.service'
import { ContentReviewService } from './content-review.service'
import { ContentScheduleService } from './content-schedule.service'
import { StrategyTemplateService } from './strategy-template.service'

@ApiTags('Acquisition/Content')
@Controller('/acquisition')
export class AcquisitionContentController {
  constructor(
    private readonly contentGenerationService: ContentGenerationService,
    private readonly contentReviewService: ContentReviewService,
    private readonly contentScheduleService: ContentScheduleService,
    private readonly strategyTemplateService: StrategyTemplateService,
  ) {}

  @ApiDoc({ summary: 'Generate acquisition clothing content', body: GenerateAcquisitionContentDto.schema, response: AcquisitionContentVo })
  @Post('/content/generate')
  async generate(@GetToken() token: TokenInfo, @Body() body: GenerateAcquisitionContentDto) {
    const content = await this.contentGenerationService.generate(token.id, token.userType, body)
    return AcquisitionContentVo.create(content)
  }

  @ApiDoc({ summary: 'List acquisition content', query: ListAcquisitionContentDto.schema, response: AcquisitionContentListVo })
  @Get('/content')
  async list(@GetToken() token: TokenInfo, @Query() query: ListAcquisitionContentDto) {
    const [list, total] = await this.contentReviewService.list(token.id, query)
    return new AcquisitionContentListVo(list, total, query)
  }

  @ApiDoc({ summary: 'Update one platform content variant', body: UpdatePlatformContentDto.schema, response: AcquisitionContentVo })
  @Post('/content/:id/platform-content')
  async updatePlatformContent(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: UpdatePlatformContentDto) {
    const content = await this.contentReviewService.updatePlatformContent(token.id, id, body)
    return AcquisitionContentVo.create(content)
  }

  @ApiDoc({ summary: 'Review acquisition content', body: ReviewAcquisitionContentDto.schema, response: AcquisitionContentVo })
  @Post('/content/:id/review')
  async review(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: ReviewAcquisitionContentDto) {
    const content = await this.contentReviewService.review(token.id, id, body)
    return AcquisitionContentVo.create(content)
  }

  @ApiDoc({ summary: 'Schedule approved acquisition content', body: ScheduleAcquisitionContentDto.schema, response: AcquisitionContentVo })
  @Post('/content/:id/schedule')
  async schedule(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: ScheduleAcquisitionContentDto) {
    const content = await this.contentScheduleService.schedule(token.id, id, body)
    return AcquisitionContentVo.create(content)
  }

  @ApiDoc({ summary: 'Upsert acquisition account operations config', body: UpsertAccountOpsConfigDto.schema, response: AccountOpsConfigVo })
  @Post('/strategy/accounts/:accountId/config')
  async upsertAccountConfig(@GetToken() token: TokenInfo, @Param('accountId') accountId: string, @Body() body: UpsertAccountOpsConfigDto) {
    const config = await this.strategyTemplateService.upsertAccountConfig(accountId, body)
    return AccountOpsConfigVo.create(config)
  }
}
```

- [ ] **Step 5: Register module dependencies**

Modify `acquisition.module.ts`:

```ts
import { AitoearnAiClientModule } from '@yikart/aitoearn-ai-client'
import { ChannelDbModule } from '@yikart/channel-db'
import { PublishingModule } from '../channel/publishing/publishing.module'
import { SensitiveWordModule } from '../sensitive-word/sensitive-word.module'
import { AcquisitionContentController } from './content/acquisition-content.controller'
import { ContentGenerationService } from './content/content-generation.service'
import { ContentReviewService } from './content/content-review.service'
import { ContentScheduleService } from './content/content-schedule.service'
import { HookSelectionService } from './content/hook-selection.service'
import { PlatformContentAdapterService } from './content/platform-content-adapter.service'
import { StrategyTemplateService } from './content/strategy-template.service'

@Module({
  imports: [
    ChannelDbModule,
    SensitiveWordModule,
    AitoearnAiClientModule,
    PublishingModule,
  ],
  controllers: [
    // existing controllers...
    AcquisitionContentController,
  ],
  providers: [
    // existing providers...
    PlatformContentAdapterService,
    HookSelectionService,
    ContentGenerationService,
    ContentReviewService,
    ContentScheduleService,
    StrategyTemplateService,
  ],
})
export class AcquisitionModule {}
```

- [ ] **Step 6: Run backend build**

Run:

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: compile errors only for services not yet implemented. DTO/controller syntax should compile once service stubs are added in later tasks.

---

### Task 4: Implement Platform Adapter and Hook Selection

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/platform-content-adapter.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/platform-content-adapter.service.spec.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/hook-selection.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/hook-selection.service.spec.ts`

- [ ] **Step 1: Add adapter tests**

```ts
import { describe, expect, it } from 'vitest'
import { PlatformContentAdapterService } from './platform-content-adapter.service'

describe('PlatformContentAdapterService', () => {
  const service = new PlatformContentAdapterService()

  it('truncates XHS title and topics to platform limits', () => {
    const result = service.normalize({
      platform: 'xhs',
      title: '这是一条超过二十个字的小红书标题需要截断',
      body: '适合通勤的针织裙',
      topics: ['通勤穿搭', '显瘦', '小个子', '裙子', 'ootd', '多余'],
    })

    expect(result.title.length).toBeLessThanOrEqual(20)
    expect(result.topics).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Implement adapter**

```ts
import { Injectable } from '@nestjs/common'
import { PLATFORM_CONTENT_LIMITS } from './acquisition-content.constants'

export interface PlatformContentInput {
  platform: keyof typeof PLATFORM_CONTENT_LIMITS
  title: string
  body: string
  topics: string[]
}

@Injectable()
export class PlatformContentAdapterService {
  normalize(input: PlatformContentInput): PlatformContentInput {
    const limits = PLATFORM_CONTENT_LIMITS[input.platform]
    return {
      platform: input.platform,
      title: this.truncate(input.title.trim(), limits.titleMax),
      body: this.truncate(input.body.trim(), limits.bodyMax),
      topics: Array.from(new Set(input.topics.map(topic => topic.replace(/^#/, '').trim()).filter(Boolean))).slice(0, limits.topicMax),
    }
  }

  private truncate(value: string, max: number) {
    return value.length > max ? value.slice(0, max) : value
  }
}
```

- [ ] **Step 3: Add hook selection tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HookSelectionService } from './hook-selection.service'

describe('HookSelectionService', () => {
  const hookTemplateRepository = {
    listEnabledForSelection: vi.fn(),
  }
  const service = new HookSelectionService(
    hookTemplateRepository as ConstructorParameters<typeof HookSelectionService>[0],
  )

  beforeEach(() => vi.clearAllMocks())

  it('returns the highest weighted matching hook deterministically', async () => {
    hookTemplateRepository.listEnabledForSelection.mockResolvedValue([
      { id: 'hook-low', content: '低权重', category: 'benefit_guide', weight: 1 },
      { id: 'hook-high', content: '想要同款的姐妹私信我', category: 'private_message_guide', weight: 10 },
    ])

    const result = await service.selectHook({ platform: 'xhs', accountId: 'acc-1', category: '裙子' })

    expect(result?.hookTemplateId).toBe('hook-high')
  })
})
```

- [ ] **Step 4: Implement hook selection**

```ts
import { Injectable } from '@nestjs/common'
import { HookTemplateRepository } from '@yikart/channel-db'

@Injectable()
export class HookSelectionService {
  constructor(private readonly hookTemplateRepository: HookTemplateRepository) {}

  async selectHook(query: { platform: string, accountId?: string, category?: string }) {
    const hooks = await this.hookTemplateRepository.listEnabledForSelection(query)
    const sorted = [...hooks].sort((a, b) => {
      const weightDiff = (b.weight || 0) - (a.weight || 0)
      if (weightDiff !== 0) return weightDiff
      return String(a.id).localeCompare(String(b.id))
    })
    const selected = sorted[0]
    if (!selected) return null
    return {
      hookTemplateId: selected.id,
      content: selected.content,
      category: selected.category,
    }
  }
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/content/platform-content-adapter.service.spec.ts apps/aitoearn-server/src/core/acquisition/content/hook-selection.service.spec.ts
```

Expected: PASS.

---

### Task 5: Implement Clothing Content Generation

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/content-generation.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/content-generation.service.spec.ts`

- [ ] **Step 1: Add generation tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AcquisitionContentStatus } from '@yikart/channel-db'
import { ContentGenerationService } from './content-generation.service'

describe('ContentGenerationService', () => {
  const aiService = {
    chatCompletion: vi.fn(),
    createImageTextDraft: vi.fn(),
  }
  const acquisitionContentRepository = {
    createByUser: vi.fn(),
  }
  const hookSelectionService = {
    selectHook: vi.fn(),
  }
  const adapter = {
    normalize: vi.fn((input: unknown) => input),
  }
  const sensitiveWordService = {
    check: vi.fn(),
  }
  const service = new ContentGenerationService(
    aiService as ConstructorParameters<typeof ContentGenerationService>[0],
    acquisitionContentRepository as ConstructorParameters<typeof ContentGenerationService>[1],
    hookSelectionService as ConstructorParameters<typeof ContentGenerationService>[2],
    adapter as ConstructorParameters<typeof ContentGenerationService>[3],
    sensitiveWordService as ConstructorParameters<typeof ContentGenerationService>[4],
  )

  beforeEach(() => vi.clearAllMocks())

  it('generates normalized platform variants and attaches selected hook', async () => {
    hookSelectionService.selectHook.mockResolvedValue({
      hookTemplateId: 'hook-1',
      content: '想要同款的姐妹私信我',
      category: 'private_message_guide',
    })
    sensitiveWordService.check.mockReturnValue({ passed: true, hits: [] })
    aiService.chatCompletion.mockResolvedValue({
      content: JSON.stringify({
        variants: [
          {
            platform: 'xhs',
            title: '通勤针织裙',
            body: '显瘦又舒服，适合办公室',
            topics: ['通勤穿搭', '显瘦'],
            suggestedPublishAt: '2026-05-29T12:00:00.000Z',
            strategyNote: '主打显瘦通勤',
          },
        ],
      }),
      model: 'gpt-5.5',
    })
    acquisitionContentRepository.createByUser.mockResolvedValue({ id: 'content-1' })

    const result = await service.generate('user-1', 'user', {
      accountIds: ['acc-1'],
      platforms: ['xhs'],
      productName: '通勤针织裙',
      productCategory: '裙子',
      sellingPoints: '显瘦，垂感好，不易皱',
      referenceImageUrls: [],
      autoAttachHook: true,
      generateMedia: false,
      mediaMode: 'image_text',
      chatModel: 'gpt-5.5',
    })

    expect(result.id).toBe('content-1')
    expect(acquisitionContentRepository.createByUser).toHaveBeenCalledWith(expect.objectContaining({
      status: AcquisitionContentStatus.PendingReview,
      platformContents: [expect.objectContaining({ platform: 'xhs', hook: expect.objectContaining({ hookTemplateId: 'hook-1' }) })],
    }))
    expect(aiService.chatCompletion).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-5.5',
      messages: expect.arrayContaining([expect.objectContaining({ role: 'user' })]),
    }))
  })

  it('stores generation_failed when AI output contains blocked public contact info', async () => {
    hookSelectionService.selectHook.mockResolvedValue(null)
    aiService.chatCompletion.mockResolvedValue({
      content: JSON.stringify({
        variants: [{ platform: 'xhs', title: '福利', body: '加微信 abc 领取', topics: [] }],
      }),
      model: 'gpt-5.5',
    })
    sensitiveWordService.check.mockReturnValue({ passed: false, hits: ['微信'] })
    acquisitionContentRepository.createByUser.mockResolvedValue({ id: 'content-failed', status: AcquisitionContentStatus.GenerationFailed })

    await service.generate('user-1', 'user', {
      accountIds: ['acc-1'],
      platforms: ['xhs'],
      productName: '通勤针织裙',
      productCategory: '裙子',
      sellingPoints: '显瘦',
      referenceImageUrls: [],
      autoAttachHook: false,
      generateMedia: false,
      mediaMode: 'image_text',
      chatModel: 'gpt-5.5',
    })

    expect(acquisitionContentRepository.createByUser).toHaveBeenCalledWith(expect.objectContaining({
      status: AcquisitionContentStatus.GenerationFailed,
      failureReason: expect.stringContaining('微信'),
    }))
  })
})
```

- [ ] **Step 2: Implement generation service**

```ts
import { Injectable } from '@nestjs/common'
import { AiService } from '@yikart/aitoearn-ai-client'
import { AccountType } from '@yikart/aitoearn-server-client'
import { AcquisitionContentRepository, AcquisitionContentStatus } from '@yikart/channel-db'
import { CreditsConsumptionSource, UserType } from '@yikart/common'
import { z } from 'zod'
import { SensitiveWordService } from '../../sensitive-word/sensitive-word.service'
import { GenerateAcquisitionContentDto } from './acquisition-content.dto'
import { HookSelectionService } from './hook-selection.service'
import { PlatformContentAdapterService } from './platform-content-adapter.service'

const AiGeneratedVariantSchema = z.object({
  platform: z.enum(['xhs', 'douyin', 'kwai']),
  title: z.string(),
  body: z.string(),
  topics: z.array(z.string()).default([]),
  suggestedPublishAt: z.string().optional(),
  strategyNote: z.string().default(''),
})

const AiGeneratedContentSchema = z.object({
  variants: z.array(AiGeneratedVariantSchema).min(1),
})

@Injectable()
export class ContentGenerationService {
  constructor(
    private readonly aiService: AiService,
    private readonly acquisitionContentRepository: AcquisitionContentRepository,
    private readonly hookSelectionService: HookSelectionService,
    private readonly platformContentAdapter: PlatformContentAdapterService,
    private readonly sensitiveWordService: SensitiveWordService,
  ) {}

  async generate(userId: string, userType: UserType, dto: GenerateAcquisitionContentDto) {
    const prompt = this.buildPrompt(dto)
    try {
      const aiResult = await this.aiService.chatCompletion({
        userId,
        userType,
        model: dto.chatModel,
        source: CreditsConsumptionSource.Plugin,
        messages: [
          { role: 'system', content: '你是服装行业社交媒体获客文案策划。只输出 JSON，不要 Markdown。' },
          { role: 'user', content: prompt },
        ],
      })
      const parsed = AiGeneratedContentSchema.parse(JSON.parse(String(aiResult.content || '{}')))
      const platformContents = []

      for (const variant of parsed.variants) {
        const normalized = this.platformContentAdapter.normalize(variant)
        const hook = dto.autoAttachHook
          ? await this.hookSelectionService.selectHook({
            platform: normalized.platform,
            accountId: dto.accountIds[0],
            category: dto.productCategory,
          })
          : null
        const bodyWithHook = hook ? `${normalized.body}\n\n${hook.content}` : normalized.body
        const safety = this.sensitiveWordService.check(`${normalized.title}\n${bodyWithHook}\n${normalized.topics.join(' ')}`)
        if (!safety.passed) {
          return await this.createFailed(userId, dto, `generated public content blocked: ${safety.hits.join(',')}`, String(aiResult.model || ''))
        }
        platformContents.push({
          ...normalized,
          body: bodyWithHook,
          suggestedPublishAt: variant.suggestedPublishAt ? new Date(variant.suggestedPublishAt) : null,
          hook: hook || {},
          strategyNote: variant.strategyNote,
        })
      }

      const draftTaskIds = dto.generateMedia ? await this.createMediaTasks(userId, userType, dto, prompt) : []
      return await this.acquisitionContentRepository.createByUser({
        userId,
        productName: dto.productName,
        productCategory: dto.productCategory,
        priceRange: dto.priceRange || '',
        sizeRange: dto.sizeRange || '',
        sellingPoints: dto.sellingPoints,
        contentStyle: dto.contentStyle || '',
        referenceImageUrls: dto.referenceImageUrls,
        targetPlatforms: dto.platforms,
        status: AcquisitionContentStatus.PendingReview,
        platformContents,
        draftTaskIds,
        generatedByModel: String(aiResult.model || ''),
      })
    }
    catch (error) {
      return await this.createFailed(userId, dto, error instanceof Error ? error.message : 'generation failed', '')
    }
  }

  private buildPrompt(dto: GenerateAcquisitionContentDto) {
    return [
      '你是服装行业社交媒体获客文案策划。',
      '只输出 JSON，不要 Markdown。',
      '输出格式: {"variants":[{"platform":"xhs|douyin|kwai","title":"","body":"","topics":[],"suggestedPublishAt":"ISO 时间","strategyNote":""}]}',
      '公开内容禁止出现微信号、手机号、URL、二维码、加我等联系方式引导。',
      `平台: ${dto.platforms.join(',')}`,
      `产品名称: ${dto.productName}`,
      `产品类型: ${dto.productCategory}`,
      `价格区间: ${dto.priceRange || '未提供'}`,
      `尺码范围: ${dto.sizeRange || '未提供'}`,
      `卖点: ${dto.sellingPoints}`,
      `风格: ${dto.contentStyle || '自然种草'}`,
    ].join('\n')
  }

  private async createMediaTasks(userId: string, userType: UserType, dto: GenerateAcquisitionContentDto, prompt: string) {
    if (dto.mediaMode === 'video' && dto.model) {
      const response = await this.aiService.createDraftV2({
        userId,
        userType,
        quantity: 1,
        model: dto.model,
        prompt,
        captionPrompt: prompt,
        imageUrls: dto.referenceImageUrls,
        platforms: dto.platforms.map(platform => this.toAccountType(platform)),
        draftType: 'draft',
      })
      return response.taskIds
    }
    if (dto.mediaMode === 'image_text' && dto.imageModel) {
      const response = await this.aiService.createImageTextDraft({
        userId,
        userType,
        quantity: 1,
        imageModel: dto.imageModel,
        prompt,
        captionPrompt: prompt,
        imageUrls: dto.referenceImageUrls,
        platforms: dto.platforms.map(platform => this.toAccountType(platform)),
        draftType: 'draft',
      })
      return response.taskIds
    }
    return []
  }

  private async createFailed(userId: string, dto: GenerateAcquisitionContentDto, failureReason: string, model: string) {
    return await this.acquisitionContentRepository.createByUser({
      userId,
      productName: dto.productName,
      productCategory: dto.productCategory,
      priceRange: dto.priceRange || '',
      sizeRange: dto.sizeRange || '',
      sellingPoints: dto.sellingPoints,
      contentStyle: dto.contentStyle || '',
      referenceImageUrls: dto.referenceImageUrls,
      targetPlatforms: dto.platforms,
      status: AcquisitionContentStatus.GenerationFailed,
      platformContents: [],
      generatedByModel: model,
      failureReason,
    })
  }

  private toAccountType(platform: 'xhs' | 'douyin' | 'kwai') {
    if (platform === 'xhs') return AccountType.Xhs
    if (platform === 'douyin') return AccountType.Douyin
    return AccountType.KWAI
  }
}
```

- [ ] **Step 3: Run generation tests**

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/content/content-generation.service.spec.ts
```

Expected: PASS.

---

### Task 6: Implement Review State Flow and Scheduling

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/content-review.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/content-review.service.spec.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/content-schedule.service.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/content-schedule.service.spec.ts`

- [ ] **Step 1: Add review service tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AcquisitionContentStatus } from '@yikart/channel-db'
import { ResponseCode } from '@yikart/common'
import { ContentReviewService } from './content-review.service'

describe('ContentReviewService', () => {
  const repository = {
    listByUser: vi.fn(),
    getByIdAndUserId: vi.fn(),
    updateStatus: vi.fn(),
    updatePlatformContents: vi.fn(),
  }
  const sensitiveWordService = {
    check: vi.fn(),
  }
  const service = new ContentReviewService(
    repository as ConstructorParameters<typeof ContentReviewService>[0],
    sensitiveWordService as ConstructorParameters<typeof ContentReviewService>[1],
  )

  beforeEach(() => vi.clearAllMocks())

  it('approves pending review content', async () => {
    repository.getByIdAndUserId.mockResolvedValue({ id: 'content-1', status: AcquisitionContentStatus.PendingReview })
    repository.updateStatus.mockResolvedValue({ id: 'content-1', status: AcquisitionContentStatus.Approved })

    const result = await service.review('user-1', 'content-1', { action: 'approve', note: 'ok' })

    expect(result.status).toBe(AcquisitionContentStatus.Approved)
  })

  it('rejects approving a scheduled item', async () => {
    repository.getByIdAndUserId.mockResolvedValue({ id: 'content-1', status: AcquisitionContentStatus.Scheduled })

    await expect(service.review('user-1', 'content-1', { action: 'approve' })).rejects.toMatchObject({
      code: ResponseCode.ValidationFailed,
    })
  })
})
```

- [ ] **Step 2: Implement review service**

```ts
import { Injectable } from '@nestjs/common'
import { AcquisitionContentRepository, AcquisitionContentStatus } from '@yikart/channel-db'
import { AppException, ResponseCode } from '@yikart/common'
import { SensitiveWordService } from '../../sensitive-word/sensitive-word.service'
import { ListAcquisitionContentDto, ReviewAcquisitionContentDto, UpdatePlatformContentDto } from './acquisition-content.dto'

@Injectable()
export class ContentReviewService {
  constructor(
    private readonly acquisitionContentRepository: AcquisitionContentRepository,
    private readonly sensitiveWordService: SensitiveWordService,
  ) {}

  async list(userId: string, query: ListAcquisitionContentDto) {
    return await this.acquisitionContentRepository.listByUser({ userId, ...query })
  }

  async review(userId: string, id: string, dto: ReviewAcquisitionContentDto) {
    const content = await this.acquisitionContentRepository.getByIdAndUserId(id, userId)
    if (!content) throw new AppException(ResponseCode.ValidationFailed)
    if (content.status !== AcquisitionContentStatus.PendingReview) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'status', expected: AcquisitionContentStatus.PendingReview, actual: content.status })
    }
    const status = dto.action === 'approve' ? AcquisitionContentStatus.Approved : AcquisitionContentStatus.Rejected
    return await this.acquisitionContentRepository.updateStatus(id, userId, status, {
      reviewerId: userId,
      reviewNote: dto.note || '',
      reviewedAt: new Date(),
    })
  }

  async updatePlatformContent(userId: string, id: string, dto: UpdatePlatformContentDto) {
    const content = await this.acquisitionContentRepository.getByIdAndUserId(id, userId)
    if (!content) throw new AppException(ResponseCode.ValidationFailed)
    if (![AcquisitionContentStatus.PendingReview, AcquisitionContentStatus.Rejected].includes(content.status)) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'status', expected: [AcquisitionContentStatus.PendingReview, AcquisitionContentStatus.Rejected], actual: content.status })
    }
    const safety = this.sensitiveWordService.check(`${dto.title}\n${dto.body}\n${dto.topics.join(' ')}`)
    if (!safety.passed) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'content', reason: 'public_content_blocked_words', hits: safety.hits })
    }
    const next = content.platformContents.map(item => item.platform === dto.platform ? { ...item, ...dto } : item)
    return await this.acquisitionContentRepository.updatePlatformContents(id, userId, next)
  }
}
```

- [ ] **Step 3: Add schedule tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AcquisitionContentStatus } from '@yikart/channel-db'
import { ContentScheduleService } from './content-schedule.service'

describe('ContentScheduleService', () => {
  const repository = {
    getByIdAndUserId: vi.fn(),
    updateStatus: vi.fn(),
    updatePlatformContents: vi.fn(),
  }
  const publishingService = {
    createPublishingTask: vi.fn(),
  }
  const service = new ContentScheduleService(
    repository as ConstructorParameters<typeof ContentScheduleService>[0],
    publishingService as ConstructorParameters<typeof ContentScheduleService>[1],
  )

  beforeEach(() => vi.clearAllMocks())

  it('creates publish tasks for approved platform variants', async () => {
    repository.getByIdAndUserId.mockResolvedValue({
      id: 'content-1',
      userId: 'user-1',
      status: AcquisitionContentStatus.Approved,
      platformContents: [{ platform: 'xhs', title: '标题', body: '正文', topics: ['穿搭'] }],
    })
    publishingService.createPublishingTask.mockResolvedValue({ id: 'publish-1' })
    repository.updatePlatformContents.mockResolvedValue({})
    repository.updateStatus.mockResolvedValue({ id: 'content-1', status: AcquisitionContentStatus.Scheduled })

    const result = await service.schedule('user-1', 'content-1', {
      publishAt: new Date('2026-05-29T12:00:00.000Z'),
      accountMap: { xhs: 'acc-1' },
    })

    expect(result.status).toBe(AcquisitionContentStatus.Scheduled)
    expect(publishingService.createPublishingTask).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 'acc-1',
      accountType: 'xhs',
      title: '标题',
      desc: '正文',
      topics: ['穿搭'],
    }))
  })
})
```

- [ ] **Step 4: Implement schedule service**

```ts
import { Injectable } from '@nestjs/common'
import { AccountType } from '@yikart/aitoearn-server-client'
import { AcquisitionContentRepository, AcquisitionContentStatus } from '@yikart/channel-db'
import { AppException, ResponseCode } from '@yikart/common'
import { PublishRecordSource, PublishType } from '@yikart/mongodb'
import { PublishingService } from '../../channel/publishing/publishing.service'
import { ScheduleAcquisitionContentDto } from './acquisition-content.dto'

@Injectable()
export class ContentScheduleService {
  constructor(
    private readonly acquisitionContentRepository: AcquisitionContentRepository,
    private readonly publishingService: PublishingService,
  ) {}

  async schedule(userId: string, id: string, dto: ScheduleAcquisitionContentDto) {
    const content = await this.acquisitionContentRepository.getByIdAndUserId(id, userId)
    if (!content) throw new AppException(ResponseCode.ValidationFailed)
    if (content.status !== AcquisitionContentStatus.Approved) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'status', expected: AcquisitionContentStatus.Approved, actual: content.status })
    }

    const nextPlatformContents = []
    for (const item of content.platformContents) {
      const accountId = dto.accountMap[item.platform]
      if (!accountId) {
        throw new AppException(ResponseCode.ValidationFailed, { field: 'accountMap', platform: item.platform, reason: 'missing_platform_account' })
      }
      const publishRecord = await this.publishingService.createPublishingTask({
        flowId: `acquisition:${id}:${item.platform}`,
        accountId,
        accountType: this.toAccountType(item.platform),
        type: PublishType.ARTICLE,
        title: item.title,
        desc: item.body,
        topics: item.topics,
        publishTime: dto.publishAt,
        source: PublishRecordSource.PUBLISH,
      })
      nextPlatformContents.push({ ...item, accountId, publishRecordId: publishRecord.id })
    }

    await this.acquisitionContentRepository.updatePlatformContents(id, userId, nextPlatformContents)
    return await this.acquisitionContentRepository.updateStatus(id, userId, AcquisitionContentStatus.Scheduled, {
      scheduledAt: dto.publishAt,
    })
  }

  private toAccountType(platform: 'xhs' | 'douyin' | 'kwai') {
    if (platform === 'xhs') return AccountType.Xhs
    if (platform === 'douyin') return AccountType.Douyin
    return AccountType.KWAI
  }
}
```

- [ ] **Step 5: Run review and schedule tests**

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/content/content-review.service.spec.ts apps/aitoearn-server/src/core/acquisition/content/content-schedule.service.spec.ts
```

Expected: PASS.

---

### Task 7: Add Frontend API Types and Stores

**Files:**
- Create: `project/aitoearn-web/src/api/types/acquisitionContent.ts`
- Create: `project/aitoearn-web/src/api/acquisitionContent.ts`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/useContentGenerationStore.ts`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/useStrategyTemplateStore.ts`

- [ ] **Step 1: Add API types**

Create `src/api/types/acquisitionContent.ts`:

```ts
export type AcquisitionPlatform = 'xhs' | 'douyin' | 'kwai'
export type AcquisitionContentStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'scheduled'
  | 'published'
  | 'publish_failed'
  | 'generation_failed'

export interface AcquisitionPlatformContent {
  platform: AcquisitionPlatform
  accountId?: string
  title: string
  body: string
  topics: string[]
  suggestedPublishAt?: string
  hook?: {
    hookTemplateId?: string
    content?: string
    category?: string
  }
  strategyNote?: string
  publishRecordId?: string
}

export interface AcquisitionContent {
  id: string
  userId: string
  productName: string
  productCategory: string
  priceRange?: string
  sizeRange?: string
  sellingPoints?: string
  contentStyle?: string
  referenceImageUrls: string[]
  targetPlatforms: AcquisitionPlatform[]
  status: AcquisitionContentStatus
  platformContents: AcquisitionPlatformContent[]
  draftTaskIds: string[]
  generatedByModel?: string
  failureReason?: string
  reviewNote?: string
  createdAt: string
  updatedAt: string
}

export interface GenerateAcquisitionContentPayload {
  accountIds: string[]
  platforms: AcquisitionPlatform[]
  productName: string
  productCategory: string
  priceRange?: string
  sizeRange?: string
  sellingPoints: string
  contentStyle?: string
  referenceImageUrls: string[]
  autoAttachHook: boolean
  generateMedia: boolean
  mediaMode: 'image_text' | 'video'
  chatModel?: string
  model?: string
  imageModel?: string
}
```

- [ ] **Step 2: Add API wrapper**

Create `src/api/acquisitionContent.ts`:

```ts
import type {
  AcquisitionContent,
  AcquisitionContentStatus,
  AcquisitionPlatform,
  GenerateAcquisitionContentPayload,
} from '@/api/types/acquisitionContent'
import http from '@/utils/request'

export function apiGenerateAcquisitionContent(data: GenerateAcquisitionContentPayload) {
  return http.post<AcquisitionContent>('acquisition/content/generate', data)
}

export function apiListAcquisitionContent(params: {
  status?: AcquisitionContentStatus
  platform?: AcquisitionPlatform
  productCategory?: string
  page: number
  pageSize: number
}) {
  return http.get<{ list: AcquisitionContent[], total: number, page: number, pageSize: number }>('acquisition/content', params)
}

export function apiUpdateAcquisitionPlatformContent(id: string, data: {
  platform: AcquisitionPlatform
  title: string
  body: string
  topics: string[]
}) {
  return http.post<AcquisitionContent>(`acquisition/content/${id}/platform-content`, data)
}

export function apiReviewAcquisitionContent(id: string, data: { action: 'approve' | 'reject', note?: string }) {
  return http.post<AcquisitionContent>(`acquisition/content/${id}/review`, data)
}

export function apiScheduleAcquisitionContent(id: string, data: {
  publishAt: string
  accountMap: Record<AcquisitionPlatform, string>
}) {
  return http.post<AcquisitionContent>(`acquisition/content/${id}/schedule`, data)
}
```

- [ ] **Step 3: Add content store**

Create `useContentGenerationStore.ts`:

```ts
import { create } from 'zustand'
import {
  apiGenerateAcquisitionContent,
  apiListAcquisitionContent,
  apiReviewAcquisitionContent,
} from '@/api/acquisitionContent'
import type {
  AcquisitionContent,
  AcquisitionContentStatus,
  GenerateAcquisitionContentPayload,
} from '@/api/types/acquisitionContent'

interface ContentGenerationState {
  list: AcquisitionContent[]
  total: number
  loading: boolean
  selectedContent?: AcquisitionContent
  status?: AcquisitionContentStatus
  fetchList: () => Promise<void>
  generate: (payload: GenerateAcquisitionContentPayload) => Promise<AcquisitionContent>
  review: (id: string, action: 'approve' | 'reject', note?: string) => Promise<void>
  selectContent: (content?: AcquisitionContent) => void
}

export const useContentGenerationStore = create<ContentGenerationState>((set, get) => ({
  list: [],
  total: 0,
  loading: false,
  async fetchList() {
    set({ loading: true })
    try {
      const res = await apiListAcquisitionContent({ status: get().status, page: 1, pageSize: 20 })
      set({ list: res?.data?.list ?? [], total: res?.data?.total ?? 0 })
    }
    finally {
      set({ loading: false })
    }
  },
  async generate(payload) {
    set({ loading: true })
    try {
      const res = await apiGenerateAcquisitionContent(payload)
      if (!res?.data) throw new Error(res?.message || 'Generate acquisition content failed')
      await get().fetchList()
      return res.data
    }
    finally {
      set({ loading: false })
    }
  },
  async review(id, action, note) {
    await apiReviewAcquisitionContent(id, { action, note })
    await get().fetchList()
  },
  selectContent(content) {
    set({ selectedContent: content })
  },
}))
```

- [ ] **Step 4: Add strategy store stub**

Create `useStrategyTemplateStore.ts`:

```ts
import { create } from 'zustand'

export interface StrategyTemplateState {
  activeTab: 'hooks' | 'scripts' | 'accounts'
  setActiveTab: (activeTab: StrategyTemplateState['activeTab']) => void
}

export const useStrategyTemplateStore = create<StrategyTemplateState>(set => ({
  activeTab: 'hooks',
  setActiveTab(activeTab) {
    set({ activeTab })
  },
}))
```

- [ ] **Step 5: Run frontend type check**

Run:

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: PASS after UI components are added in Task 8.

---

### Task 8: Build Content and Strategy Frontend Panels

**Files:**
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/components/ContentManagementPanel/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/components/ContentGenerationForm/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/components/GeneratedContentPreview/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/components/ContentReviewBoard/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/components/SchedulePublishDrawer/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/components/StrategyManagementPanel/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/components/HookTemplateManager/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/components/ScriptTemplateManager/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/acquisition/components/AccountOpsConfigPanel/index.tsx`
- Modify: `project/aitoearn-web/src/app/[lng]/acquisition/acquisitionPageCore.tsx`
- Modify: `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json`
- Modify: `project/aitoearn-web/src/app/i18n/locales/en/route.json`

- [ ] **Step 1: Add content management panel**

Create `ContentManagementPanel/index.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { ContentGenerationForm } from '../ContentGenerationForm'
import { ContentReviewBoard } from '../ContentReviewBoard'
import { useContentGenerationStore } from '../../useContentGenerationStore'

export function ContentManagementPanel() {
  const fetchList = useContentGenerationStore(state => state.fetchList)

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  return (
    <section className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <ContentGenerationForm />
      <ContentReviewBoard />
    </section>
  )
}
```

- [ ] **Step 2: Add generation form**

Create `ContentGenerationForm/index.tsx`:

```tsx
'use client'

import { Button, Checkbox, Form, Input, Select } from 'antd'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useContentGenerationStore } from '../../useContentGenerationStore'

export function ContentGenerationForm() {
  const { t } = useTranslation('route')
  const [form] = Form.useForm()
  const generate = useContentGenerationStore(state => state.generate)
  const loading = useContentGenerationStore(state => state.loading)
  const platformOptions = [
    { value: 'xhs', label: t('acquisition.platform.xhs') },
    { value: 'douyin', label: t('acquisition.platform.douyin') },
    { value: 'kwai', label: t('acquisition.platform.kwai') },
  ]

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <Form
        form={form}
        layout="vertical"
        initialValues={{ platforms: ['xhs'], autoAttachHook: true, generateMedia: false, mediaMode: 'image_text' }}
        onFinish={values => generate({ ...values, referenceImageUrls: values.referenceImageUrls || [] })}
      >
        <Form.Item name="platforms" label={t('acquisition.form.platforms')} rules={[{ required: true }]}>
          <Select mode="multiple" options={platformOptions} />
        </Form.Item>
        <Form.Item name="accountIds" label={t('acquisition.form.accountIds')} rules={[{ required: true }]}>
          <Select mode="tags" tokenSeparators={[',']} />
        </Form.Item>
        <Form.Item name="productName" label={t('acquisition.form.productName')} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="productCategory" label={t('acquisition.form.productCategory')} rules={[{ required: true }]}>
          <Input placeholder={t('acquisition.form.productCategoryPlaceholder')} />
        </Form.Item>
        <Form.Item name="priceRange" label={t('acquisition.form.priceRange')}>
          <Input />
        </Form.Item>
        <Form.Item name="sizeRange" label={t('acquisition.form.sizeRange')}>
          <Input />
        </Form.Item>
        <Form.Item name="sellingPoints" label={t('acquisition.form.sellingPoints')} rules={[{ required: true }]}>
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item name="contentStyle" label={t('acquisition.form.contentStyle')}>
          <Input />
        </Form.Item>
        <Form.Item name="autoAttachHook" valuePropName="checked">
          <Checkbox>{t('acquisition.form.autoAttachHook')}</Checkbox>
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} icon={<Sparkles size={16} />}>
          {t('acquisition.actions.generate')}
        </Button>
      </Form>
    </div>
  )
}
```

- [ ] **Step 3: Add review board and preview**

Create `GeneratedContentPreview/index.tsx`:

```tsx
'use client'

import type { AcquisitionContent } from '@/api/types/acquisitionContent'

export function GeneratedContentPreview({ content }: { content: AcquisitionContent }) {
  return (
    <div className="grid gap-3">
      {content.platformContents.map(item => (
        <article key={item.platform} className="rounded-md border border-border p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">{item.platform}</span>
            <span className="text-muted-foreground">{item.topics.map(topic => `#${topic}`).join(' ')}</span>
          </div>
          <h3 className="text-base font-semibold">{item.title}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p>
        </article>
      ))}
    </div>
  )
}
```

Create `ContentReviewBoard/index.tsx`:

```tsx
'use client'

import { Button, Empty, Spin, Tag } from 'antd'
import { Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { GeneratedContentPreview } from '../GeneratedContentPreview'
import { useContentGenerationStore } from '../../useContentGenerationStore'

export function ContentReviewBoard() {
  const { t } = useTranslation('route')
  const { list, loading, review } = useContentGenerationStore(useShallow(state => ({
    list: state.list,
    loading: state.loading,
    review: state.review,
  })))

  if (loading) return <Spin />
  if (!list.length) return <Empty />

  return (
    <div className="grid gap-3">
      {list.map(content => (
        <section key={content.id} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">{content.productName}</h2>
              <p className="text-sm text-muted-foreground">{content.productCategory}</p>
            </div>
            <Tag>{content.status}</Tag>
          </div>
          <GeneratedContentPreview content={content} />
          {content.status === 'pending_review' && (
            <div className="mt-3 flex justify-end gap-2">
              <Button icon={<X size={16} />} onClick={() => review(content.id, 'reject')}>{t('acquisition.actions.reject')}</Button>
              <Button type="primary" icon={<Check size={16} />} onClick={() => review(content.id, 'approve')}>{t('acquisition.actions.approve')}</Button>
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Add schedule drawer and strategy management components**

Create `SchedulePublishDrawer/index.tsx`:

```tsx
'use client'

import type { AcquisitionContent, AcquisitionPlatform } from '@/api/types/acquisitionContent'
import { Button, DatePicker, Drawer, Form, Select } from 'antd'
import dayjs from 'dayjs'
import { CalendarClock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { apiScheduleAcquisitionContent } from '@/api/acquisitionContent'

interface SchedulePublishDrawerProps {
  open: boolean
  content?: AcquisitionContent
  onClose: () => void
  onScheduled: () => void
}

export function SchedulePublishDrawer({ open, content, onClose, onScheduled }: SchedulePublishDrawerProps) {
  const { t } = useTranslation('route')
  const [form] = Form.useForm()

  async function submit(values: { publishAt: dayjs.Dayjs, accountMap: Record<AcquisitionPlatform, string> }) {
    if (!content) return
    const res = await apiScheduleAcquisitionContent(content.id, {
      publishAt: values.publishAt.toISOString(),
      accountMap: values.accountMap,
    })
    if (res?.data) onScheduled()
  }

  return (
    <Drawer open={open} width={420} title={t('acquisition.schedule.title')} onClose={onClose}>
      <Form form={form} layout="vertical" initialValues={{ publishAt: dayjs().add(1, 'hour') }} onFinish={submit}>
        <Form.Item name="publishAt" label={t('acquisition.schedule.publishAt')} rules={[{ required: true }]}>
          <DatePicker showTime className="w-full" />
        </Form.Item>
        {content?.targetPlatforms.map(platform => (
          <Form.Item key={platform} name={['accountMap', platform]} label={t('acquisition.schedule.accountForPlatform', { platform })} rules={[{ required: true }]}>
            <Select mode="tags" tokenSeparators={[',']} />
          </Form.Item>
        ))}
        <Button type="primary" htmlType="submit" icon={<CalendarClock size={16} />}>
          {t('acquisition.actions.schedule')}
        </Button>
      </Form>
    </Drawer>
  )
}
```

Create `StrategyManagementPanel/index.tsx`:

```tsx
'use client'

import { Tabs } from 'antd'
import { useTranslation } from 'react-i18next'
import { AccountOpsConfigPanel } from '../AccountOpsConfigPanel'
import { HookTemplateManager } from '../HookTemplateManager'
import { ScriptTemplateManager } from '../ScriptTemplateManager'

export function StrategyManagementPanel() {
  const { t } = useTranslation('route')
  return (
    <Tabs
      items={[
        { key: 'hooks', label: t('acquisition.strategy.hooks'), children: <HookTemplateManager /> },
        { key: 'scripts', label: t('acquisition.strategy.scripts'), children: <ScriptTemplateManager /> },
        { key: 'accounts', label: t('acquisition.strategy.accounts'), children: <AccountOpsConfigPanel /> },
      ]}
    />
  )
}
```

Create `HookTemplateManager/index.tsx`, `ScriptTemplateManager/index.tsx`, and `AccountOpsConfigPanel/index.tsx` with form/table skeletons that call Phase 2 APIs once CRUD wrappers are added:

```tsx
'use client'

import { Empty } from 'antd'
import { useTranslation } from 'react-i18next'

export function HookTemplateManager() {
  const { t } = useTranslation('route')
  return <Empty description={t('acquisition.strategy.hooksPlaceholder')} />
}
```

Use the same skeleton pattern for `ScriptTemplateManager` and `AccountOpsConfigPanel`, changing the exported function name.

- [ ] **Step 5: Mount real panels and replace hard-coded tab text**

Modify `acquisitionPageCore.tsx`:

```tsx
import { ContentManagementPanel } from './components/ContentManagementPanel'
import { StrategyManagementPanel } from './components/StrategyManagementPanel'

const tabs = [
  { value: 'dashboard', labelKey: 'acquisition.tabs.dashboard', icon: BarChart3 },
  { value: 'content', labelKey: 'acquisition.tabs.content', icon: FileText },
  { value: 'hooks', labelKey: 'acquisition.tabs.hooks', icon: Target },
  { value: 'leads', labelKey: 'acquisition.tabs.leads', icon: MessageSquareText },
  { value: 'accounts', labelKey: 'acquisition.tabs.accounts', icon: UsersRound },
]

function renderTabContent(value: string) {
  if (value === 'content') return <ContentManagementPanel />
  if (value === 'hooks') return <StrategyManagementPanel />
  return null
}
```

Inside each `TabsTrigger`, render `t(tab.labelKey)`. Inside `TabsContent`, render `renderTabContent(tab.value)` before falling back to the placeholder card.

- [ ] **Step 6: Add i18n route keys**

Add to `zh-CN/route.json`:

```json
{
  "acquisition.subtitle": "多平台服装 AI 获客工作台",
  "acquisition.tabs.dashboard": "数据看板",
  "acquisition.tabs.content": "内容管理",
  "acquisition.tabs.hooks": "引流管理",
  "acquisition.tabs.leads": "线索追踪",
  "acquisition.tabs.accounts": "多账号管理",
  "acquisition.platform.xhs": "小红书",
  "acquisition.platform.douyin": "抖音",
  "acquisition.platform.kwai": "快手",
  "acquisition.form.platforms": "平台",
  "acquisition.form.accountIds": "账号 ID",
  "acquisition.form.productName": "产品名称",
  "acquisition.form.productCategory": "产品类型",
  "acquisition.form.productCategoryPlaceholder": "裙子、牛仔裤、通勤套装",
  "acquisition.form.priceRange": "价格区间",
  "acquisition.form.sizeRange": "尺码范围",
  "acquisition.form.sellingPoints": "面料/版型/卖点",
  "acquisition.form.contentStyle": "内容风格",
  "acquisition.form.autoAttachHook": "自动附加引流钩子",
  "acquisition.actions.generate": "生成内容",
  "acquisition.actions.reject": "退回",
  "acquisition.actions.approve": "通过",
  "acquisition.actions.schedule": "定时发布",
  "acquisition.schedule.title": "定时发布",
  "acquisition.schedule.publishAt": "发布时间",
  "acquisition.schedule.accountForPlatform": "{{platform}} 账号 ID",
  "acquisition.strategy.hooks": "钩子库",
  "acquisition.strategy.scripts": "话术库",
  "acquisition.strategy.accounts": "账号策略",
  "acquisition.strategy.hooksPlaceholder": "钩子库 CRUD 接入 Phase 2 API",
  "acquisition.strategy.scriptsPlaceholder": "话术库 CRUD 接入 Phase 2 API",
  "acquisition.strategy.accountsPlaceholder": "账号策略 CRUD 接入 Phase 2 API"
}
```

Add to `en/route.json`:

```json
{
  "acquisition.subtitle": "Multi-platform clothing acquisition workspace",
  "acquisition.tabs.dashboard": "Dashboard",
  "acquisition.tabs.content": "Content",
  "acquisition.tabs.hooks": "Strategy",
  "acquisition.tabs.leads": "Leads",
  "acquisition.tabs.accounts": "Accounts",
  "acquisition.platform.xhs": "RedNote",
  "acquisition.platform.douyin": "Douyin",
  "acquisition.platform.kwai": "Kwai",
  "acquisition.form.platforms": "Platforms",
  "acquisition.form.accountIds": "Account IDs",
  "acquisition.form.productName": "Product name",
  "acquisition.form.productCategory": "Product category",
  "acquisition.form.productCategoryPlaceholder": "Dress, jeans, commute set",
  "acquisition.form.priceRange": "Price range",
  "acquisition.form.sizeRange": "Size range",
  "acquisition.form.sellingPoints": "Fabric, fit, selling points",
  "acquisition.form.contentStyle": "Content style",
  "acquisition.form.autoAttachHook": "Attach acquisition hook",
  "acquisition.actions.generate": "Generate",
  "acquisition.actions.reject": "Reject",
  "acquisition.actions.approve": "Approve",
  "acquisition.actions.schedule": "Schedule",
  "acquisition.schedule.title": "Schedule publish",
  "acquisition.schedule.publishAt": "Publish time",
  "acquisition.schedule.accountForPlatform": "{{platform}} account ID",
  "acquisition.strategy.hooks": "Hooks",
  "acquisition.strategy.scripts": "Scripts",
  "acquisition.strategy.accounts": "Account strategy",
  "acquisition.strategy.hooksPlaceholder": "Hook CRUD will use the Phase 2 API",
  "acquisition.strategy.scriptsPlaceholder": "Script CRUD will use the Phase 2 API",
  "acquisition.strategy.accountsPlaceholder": "Account strategy CRUD will use the Phase 2 API"
}
```

- [ ] **Step 7: Run frontend type check**

Run:

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: PASS.

---

### Task 9: Final Verification

**Files:**
- All Phase 2 files above.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run \
  libs/channel-db/src/repositories/acquisition-content.repository.spec.ts \
  apps/aitoearn-server/src/core/acquisition/content/strategy-template.service.spec.ts \
  apps/aitoearn-server/src/core/acquisition/content/platform-content-adapter.service.spec.ts \
  apps/aitoearn-server/src/core/acquisition/content/hook-selection.service.spec.ts \
  apps/aitoearn-server/src/core/acquisition/content/content-generation.service.spec.ts \
  apps/aitoearn-server/src/core/acquisition/content/content-review.service.spec.ts \
  apps/aitoearn-server/src/core/acquisition/content/content-schedule.service.spec.ts
```

Expected: all tests PASS.

- [ ] **Step 2: Run backend build**

Run:

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build succeeds.

- [ ] **Step 3: Run frontend type check**

Run:

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: type check succeeds.

- [ ] **Step 4: Run document/code whitespace check**

Run:

```bash
git diff --check
```

Expected: no trailing whitespace or conflict markers.

- [ ] **Step 5: Manual smoke test**

Run local services using the repo's current local startup commands, then verify:

1. Open `/acquisition`.
2. `内容管理` tab renders the generation form and empty review board.
3. `引流管理` tab renders hooks/scripts/account-config tabs.
4. Generate one XHS clothing content draft with `autoAttachHook = true`.
5. Generated content appears as `pending_review`.
6. Approving content changes status to `approved`.
7. Scheduling approved content creates a publish record and changes status to `scheduled`.
8. Generated public content containing `微信` or a phone number is blocked and saved as `generation_failed`.

---

## Non-Goals

- Do not implement Phase 3 lead assignment or comment reply execution.
- Do not implement automatic private-message sending.
- Do not add new platform publishing providers.
- Do not implement Phase 5 strategy performance ranking.
- Do not integrate PostHog or external attribution tooling.

---

## Spec Coverage Checklist

| Requirement | Covered By |
|---|---|
| 5.3.1 钩子库 CRUD | Task 2, Task 3, Task 8 |
| 5.3.2 话术模板库 CRUD | Task 2, Task 3, Task 8 |
| 5.3.3 策略配置页 | Task 2, Task 3, Task 8 |
| 5.2.1 AI 内容生成 | Task 5, Task 8 |
| 5.2.6 AI 输出结构化校验 | Task 5 |
| 5.2.7 引流钩子自动附加 | Task 4, Task 5 |
| 5.2.2 内容状态流转 | Task 1, Task 6 |
| 5.2.3 内容审核操作 | Task 6, Task 8 |
| 5.2.4 发布排期 UI | Task 6, Task 8 |
| 第一期开通小红书/抖音/快手 | Task 3, Task 4, Task 5 |
| 多账号管理配置入口 | Task 2, Task 8 |
| 公开内容不允许直接给微信 | Task 2, Task 5, Task 6 |
