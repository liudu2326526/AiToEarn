# Operation Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/operation-strategy` with a real strategy-asset workspace for hook templates, reply script templates, account-level operation rules, and safety checks used by acquisition content generation and lead replies.

**Architecture:** Keep operation strategy inside the existing `acquisition` domain because the backend already has strategy schemas, repositories, and creation APIs under `/acquisition/strategy/*`. Extend the existing storage with `userId`, ownership-aware repository methods, list/update/delete APIs, and then build a focused Next.js page that manages three asset types through Ant Design tables, forms, and drawers.

**Tech Stack:** NestJS, Mongoose repositories from `@yikart/channel-db`, Zod DTOs with `createZodDto`, `@ApiDoc`, existing `SensitiveWordService`, existing `ChannelAccountService`, Next.js App Router, `http.get`/`http.post`/`http.patch`/`http.delete` request helpers, Ant Design, i18n route dictionaries, pnpm, Nx, Vitest.

---

## Current State

- `/zh-CN/operation-strategy` renders `AcquisitionRoadmapPage type="strategy"` from `project/aitoearn-web/src/app/[lng]/operation-strategy/page.tsx`.
- Existing backend create APIs:
  - `POST /acquisition/strategy/hooks`
  - `POST /acquisition/strategy/scripts`
  - `POST /acquisition/strategy/accounts/:accountId/config`
- Existing frontend API wrappers in `project/aitoearn-web/src/api/acquisitionContent.ts` only expose create/upsert methods and return `any` for strategy assets.
- Existing UI components under `project/aitoearn-web/src/app/[lng]/acquisition/components/*TemplateManager` are empty-state components and are not wired to `/operation-strategy`.
- Existing schemas are useful but not multi-tenant enough:
  - `hook_template` has `name`, `category`, `content`, `weight`, `enabled`, and applicability arrays, but no `userId`.
  - `script_template` has `scene`, `variables`, `riskLevel`, and `platformConstraints`, but no `userId`.
  - `account_ops_config` has `accountId`, limits, tone, sensitive words, and comment capability fields; account ownership must be checked before reads/writes.
- Existing `StrategyTemplateService` already blocks public hook/script content through `SensitiveWordService` and allows WeChat contact variables only for private-message WeChat guide scripts.

## MVP Scope

1. Hook template management: list, create, edit, enable/disable, delete.
2. Script template management: list, create, edit, enable/disable, delete.
3. Account strategy management: list connected accounts, view/update account config, show comment-fetch capability state.
4. Risk checking: run template content through server-side validation before saving; show field-level error messages from API response.
5. Strategy usage: make hook selection user-scoped and keep existing content generation behavior working.
6. Reply strategy foundation: expose script templates by scene/category so lead reply suggestion can consume them in a follow-up task without changing the UI contract.

## Non-Goals

- This plan does not add fully automated public comment replies.
- This plan does not add direct private-message sending.
- This plan does not add strategy performance analytics; the acquisition dashboard will own that.
- This plan does not migrate historical global templates into per-user defaults automatically. It adds a deterministic ownership path for newly created templates and gives migration commands for manual cleanup.

## File Structure

| File | Responsibility |
|---|---|
| `project/aitoearn-backend/libs/channel-db/src/schemas/hook-template.schema.ts` | Add `userId` and compound indexes for user-scoped hooks. |
| `project/aitoearn-backend/libs/channel-db/src/schemas/script-template.schema.ts` | Add `userId` and compound indexes for user-scoped scripts. |
| `project/aitoearn-backend/libs/channel-db/src/schemas/account-ops-config.schema.ts` | Add `userId` for direct config filtering and retain account ownership checks. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/hook-template.repository.ts` | Add list/get/update/delete helpers scoped by `userId`. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/script-template.repository.ts` | Add list/get/update/delete helpers scoped by `userId`. |
| `project/aitoearn-backend/libs/channel-db/src/repositories/account-ops-config.repository.ts` | Add list/upsert helpers scoped by `userId` and `accountId`. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/comment-capability.service.ts` | Pass `userId` through capability status writes after account config becomes user-scoped. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.service.ts` | Pass `userId` into comment capability updates. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.controller.ts` | Pass token user id to capability reads that may persist status. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/acquisition-content.dto.ts` | Add list/update/delete DTOs for strategy endpoints. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/acquisition-content.vo.ts` | Return complete hook/script/config fields needed by UI. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/strategy-template.service.ts` | Own validation, duplicate checks, ownership checks, and CRUD orchestration. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/acquisition-content.controller.ts` | Expose strategy list/update/delete routes; keep static routes before dynamic routes. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts` | Import `ChannelSharedModule` so `StrategyTemplateService` can inject `ChannelAccountService`. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/content-generation.service.ts` | Load account operation config and pass it into prompt creation. |
| `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/content-generation.service.spec.ts` | Add constructor mock and account config prompt test. |
| `project/aitoearn-web/src/api/types/operationStrategy.ts` | Typed frontend contracts for hooks, scripts, account configs, list responses, and payloads. |
| `project/aitoearn-web/src/api/operationStrategy.ts` | Frontend API wrappers for strategy endpoints. |
| `project/aitoearn-web/src/app/[lng]/operation-strategy/page.tsx` | Render the real `OperationStrategyPage`. |
| `project/aitoearn-web/src/app/[lng]/operation-strategy/OperationStrategyPage/index.tsx` | Page-level layout, tab state, and data refresh orchestration. |
| `project/aitoearn-web/src/app/[lng]/operation-strategy/components/HookTemplateManager/index.tsx` | Hook table, drawer form, status actions. |
| `project/aitoearn-web/src/app/[lng]/operation-strategy/components/ScriptTemplateManager/index.tsx` | Script table, drawer form, scene/risk/variable controls. |
| `project/aitoearn-web/src/app/[lng]/operation-strategy/components/AccountOpsConfigManager/index.tsx` | Account list and config editor. |
| `project/aitoearn-web/src/app/[lng]/operation-strategy/components/StrategyStatusTag/index.tsx` | Shared enabled/capability/risk display. |
| `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json` | Add Chinese operation-strategy UI labels. |
| `project/aitoearn-web/src/app/i18n/locales/en/route.json` | Add English operation-strategy UI labels. |

## API Contract

Backend route prefix remains `@Controller('/acquisition')`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/strategy/hooks` | List current user's hook templates with filters and pagination. |
| `POST` | `/strategy/hooks` | Create one hook template. |
| `PATCH` | `/strategy/hooks/:id` | Update hook content, scope, weight, or enabled state. |
| `DELETE` | `/strategy/hooks/:id` | Delete a hook owned by current user. |
| `GET` | `/strategy/scripts` | List current user's script templates with filters and pagination. |
| `POST` | `/strategy/scripts` | Create one script template. |
| `PATCH` | `/strategy/scripts/:id` | Update script content, scope, risk, constraints, or enabled state. |
| `DELETE` | `/strategy/scripts/:id` | Delete a script owned by current user. |
| `GET` | `/strategy/accounts/configs` | List current user's connected accounts and operation configs. |
| `GET` | `/strategy/accounts/:accountId/config` | Get one account operation config after ownership check. |
| `POST` | `/strategy/accounts/:accountId/config` | Upsert one account operation config after ownership check. |

## Data Rules

- `hook_template` and `script_template` records must store `userId`; all list/detail/update/delete operations include `{ userId }` in repository filters.
- Hook/script duplicate names are scoped per user: `{ userId, name }`.
- Account config writes must verify `ChannelAccountService.getAccountInfo(accountId)` exists and `account.userId === token.id`.
- `account_ops_config` must be tenant-scoped by `{ userId, accountId }`. Do not rely on globally unique `accountId` unless the production schema contract explicitly guarantees it.
- Account config reads may return `null` when an account has no config row yet; the UI must merge `null` configs with `defaultConfig` before displaying or editing values.
- Public hook content cannot contain contact info or sensitive words. Server validation rejects it with `ResponseCode.ValidationFailed` and `{ field, reason, hits }`.
- Public comment scripts cannot include contact info unless both conditions are true: `scene === private_message_wechat_guide` and `platformConstraints.allowWechatId === true`.
- `HookSelectionService.selectHook()` must filter by `userId`; generated content must not use another user's templates.
- `ScriptTemplateRepository.listByScene()` must support `userId` so reply suggestions can safely consume user-owned scripts.

## Tasks

### Task 1: Make Strategy Storage User-Scoped

**Files:**
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/hook-template.schema.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/script-template.schema.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/account-ops-config.schema.ts`

- [ ] **Step 1: Add `userId` to hook templates**

In `hook-template.schema.ts`, add this field near `name`:

```ts
@Prop({ required: true, index: true, type: String })
userId: string
```

After `HookTemplateSchema` is created, add these indexes:

```ts
HookTemplateSchema.index({ userId: 1, name: 1 }, { unique: true, name: 'uniq_hook_template_user_name' })
HookTemplateSchema.index({ userId: 1, enabled: 1, category: 1 }, { name: 'idx_hook_template_selection' })
```

- [ ] **Step 2: Add `userId` to script templates**

In `script-template.schema.ts`, add this field near `name`:

```ts
@Prop({ required: true, index: true, type: String })
userId: string
```

After `ScriptTemplateSchema` is created, add these indexes:

```ts
ScriptTemplateSchema.index({ userId: 1, name: 1 }, { unique: true, name: 'uniq_script_template_user_name' })
ScriptTemplateSchema.index({ userId: 1, enabled: 1, scene: 1 }, { name: 'idx_script_template_scene_selection' })
```

- [ ] **Step 3: Add `userId` to account operation config**

In `account-ops-config.schema.ts`, add this field near `accountId`:

```ts
@Prop({ required: true, index: true, type: String })
userId: string
```

Replace the existing global unique `accountId` decorator with a non-unique indexed field:

```ts
@Prop({ required: true, index: true, type: String })
accountId: string
```

Then add this compound unique index after `AccountOpsConfigSchema` is created:

```ts
AccountOpsConfigSchema.index(
  { userId: 1, accountId: 1 },
  { unique: true, name: 'uniq_account_ops_config_user_account' },
)
```

- [ ] **Step 4: Run schema build**

Run:

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build completes without Mongoose decorator or duplicate index type errors.

### Task 2: Add Repository CRUD Helpers

**Files:**
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/hook-template.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/script-template.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/account-ops-config.repository.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/comment-capability.service.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.service.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.controller.ts`

- [ ] **Step 1: Replace global hook name lookup with user-scoped lookup**

Change `getByName(name: string)` to:

```ts
async getByName(userId: string, name: string) {
  return await this.hookTemplateModel.findOne({ userId, name }).lean({ virtuals: true }).exec()
}
```

Add list/detail/update/delete helpers:

```ts
async listByUser(userId: string, query: {
  category?: string
  enabled?: boolean
  keyword?: string
  page: number
  pageSize: number
}) {
  const filter: any = { userId }
  if (query.category) filter.category = query.category
  if (typeof query.enabled === 'boolean') filter.enabled = query.enabled
  if (query.keyword) filter.name = { $regex: query.keyword, $options: 'i' }
  return await this.findWithPagination({
    page: query.page,
    pageSize: query.pageSize,
    filter,
    options: { sort: { updatedAt: -1 } },
  })
}

async getByIdAndUser(id: string, userId: string) {
  return await this.hookTemplateModel.findOne({ _id: id, userId }).lean({ virtuals: true }).exec()
}

async updateByIdAndUser(id: string, userId: string, data: Partial<HookTemplate>) {
  return await this.updateOne({ _id: id, userId }, { $set: data })
}

async deleteByIdAndUser(id: string, userId: string) {
  return await this.deleteOne({ _id: id, userId })
}
```

- [ ] **Step 2: Make hook selection user-scoped**

Change `listEnabledForSelection` signature to include `userId`:

```ts
async listEnabledForSelection(query: {
  userId: string
  platform: string
  accountId?: string
  category?: string
}) {
  return await this.hookTemplateModel.find({
    userId: query.userId,
    enabled: true,
    $and: [
      { $or: [{ applicablePlatforms: { $size: 0 } }, { applicablePlatforms: { $in: [query.platform] } }] },
      { $or: [{ applicableAccountIds: { $size: 0 } }, { applicableAccountIds: { $in: query.accountId ? [query.accountId] : [] } }] },
      { $or: [{ applicableCategories: { $size: 0 } }, { applicableCategories: { $in: query.category ? [query.category] : [] } }] },
    ],
  }).lean({ virtuals: true }).exec()
}
```

- [ ] **Step 3: Add user-scoped script helpers**

In `script-template.repository.ts`, replace `getByName(name: string)` with:

```ts
async getByName(userId: string, name: string) {
  return await this.scriptTemplateModel.findOne({ userId, name }).lean({ virtuals: true }).exec()
}
```

Add helpers:

```ts
async listByUser(userId: string, query: {
  scene?: string
  riskLevel?: string
  enabled?: boolean
  keyword?: string
  page: number
  pageSize: number
}) {
  const filter: any = { userId }
  if (query.scene) filter.scene = query.scene
  if (query.riskLevel) filter.riskLevel = query.riskLevel
  if (typeof query.enabled === 'boolean') filter.enabled = query.enabled
  if (query.keyword) filter.name = { $regex: query.keyword, $options: 'i' }
  return await this.findWithPagination({
    page: query.page,
    pageSize: query.pageSize,
    filter,
    options: { sort: { updatedAt: -1 } },
  })
}

async getByIdAndUser(id: string, userId: string) {
  return await this.scriptTemplateModel.findOne({ _id: id, userId }).lean({ virtuals: true }).exec()
}

async updateByIdAndUser(id: string, userId: string, data: Partial<ScriptTemplate>) {
  return await this.updateOne({ _id: id, userId }, { $set: data })
}

async deleteByIdAndUser(id: string, userId: string) {
  return await this.deleteOne({ _id: id, userId })
}

async listByScene(userId: string, scene: string, category?: string) {
  return await this.scriptTemplateModel.find({
    userId,
    scene,
    enabled: true,
    $or: [{ applicableCategories: { $size: 0 } }, { applicableCategories: { $in: category ? [category] : [] } }],
  }).lean({ virtuals: true }).exec()
}
```

- [ ] **Step 4: Add account config list/upsert helpers**

In `account-ops-config.repository.ts`, replace `upsertByAccountId(accountId, data)` with:

```ts
async upsertByAccountId(userId: string, accountId: string, data: Partial<AccountOpsConfig>) {
  return await this.updateOne(
    { userId, accountId },
    {
      $set: { ...data, userId },
      $setOnInsert: { accountId },
    },
    { upsert: true },
  )
}
```

Add:

```ts
async getByAccountId(userId: string, accountId: string) {
  return await this.accountOpsConfigModel.findOne({ userId, accountId }).lean({ virtuals: true }).exec()
}

async listByUser(userId: string) {
  return await this.accountOpsConfigModel.find({ userId }, undefined, { sort: { updatedAt: -1 } }).lean({ virtuals: true }).exec()
}
```

`getByAccountId` intentionally returns `null` when the account has no saved config yet. Service and UI code must merge that `null` result with the documented `defaultConfig` instead of treating it as an error.

Update `updateCommentCapability` so callers must pass `userId` as the first argument; all existing and future callers must be updated from `updateCommentCapability(accountId, status, reason, meta)` to `updateCommentCapability(userId, accountId, status, reason, meta)`. If a caller only has `accountId`, first resolve ownership through `ChannelAccountService` at the service layer:

```ts
async updateCommentCapability(
  userId: string,
  accountId: string,
  status: CommentFetchCapabilityStatus,
  reason = '',
  meta: Record<string, unknown> = {},
) {
  return await this.upsertByAccountId(userId, accountId, {
    commentFetchStatus: status,
    commentFetchStatusReason: reason,
    commentFetchCheckedAt: new Date(),
    commentFetchMeta: meta,
  })
}
```

Then update the acquisition capability call chain so the new `userId` argument is always available:

```ts
// comment-capability.service.ts
async save(
  userId: string,
  accountId: string,
  status: AcquisitionCapabilityStatus,
  reason = '',
  meta: Record<string, unknown> = {},
) {
  const mapped = this.mapStatus(status)
  return await this.accountOpsConfigRepository.updateCommentCapability(userId, accountId, mapped, reason, meta)
}
```

```ts
// acquisition.service.ts
await this.commentCapabilityService.save(userId, dto.accountId, defaultStatus.status, defaultStatus.reason)
await this.commentCapabilityService.save(userId, dto.accountId, enriched.capabilityStatus, enriched.capabilityReason, {
  platform,
  fetchedAt: new Date().toISOString(),
})

async getCapability(userId: string, accountId: string, platformValue: AcquisitionPlatform | AcquisitionFetchWorkDto['platform']) {
  const platform = this.toPlatform(platformValue)
  const provider = this.providers[platform]
  if (!provider) {
    const defaultStatus = this.commentCapabilityService.getDefaultStatus(platform)
    await this.commentCapabilityService.save(userId, accountId, defaultStatus.status, defaultStatus.reason)
    return defaultStatus
  }
  const capability = await provider.getCapabilityStatus(accountId)
  await this.commentCapabilityService.save(userId, accountId, capability.status, capability.reason, capability.meta || {})
  return capability
}
```

```ts
// acquisition.controller.ts
@Get('/capability')
async getCapability(@GetToken() token: TokenInfo, @Query() query: AcquisitionCapabilityQueryDto) {
  return await this.acquisitionService.getCapability(token.id, query.accountId, query.platform as AcquisitionFetchWorkDto['platform'])
}
```

- [ ] **Step 5: Run repository tests**

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/content/strategy-template.service.spec.ts
```

Expected before service updates: tests fail with TypeScript/runtime errors about changed repository method signatures. Keep this failure as the TDD checkpoint.

### Task 3: Extend Backend DTOs, VOs, and Service Methods

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/acquisition-content.dto.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/acquisition-content.vo.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/strategy-template.service.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/strategy-template.service.spec.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.module.ts`

- [ ] **Step 1: Add list/update DTOs**

First update the channel-db import in `acquisition-content.dto.ts`:

```ts
import { HookTemplateCategory, ScriptTemplateScene } from '@yikart/channel-db'
```

Then replace the existing `CreateHookTemplateSchema` and `CreateScriptTemplateSchema`, and add the list/update schemas:

```ts
const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(80).optional(),
})

export const ListHookTemplateSchema = PaginationQuerySchema.extend({
  category: z.nativeEnum(HookTemplateCategory).optional(),
  enabled: z.coerce.boolean().optional(),
})
export class ListHookTemplateDto extends createZodDto(ListHookTemplateSchema, 'ListHookTemplateDto') {}

export const CreateHookTemplateSchema = z.object({
  name: z.string().min(1).max(40).describe('模板名称'),
  category: z.nativeEnum(HookTemplateCategory).describe('钩子类型'),
  content: z.string().min(1).max(500).describe('钩子内容'),
  weight: z.number().min(0).max(100).default(1).describe('权重'),
  enabled: z.boolean().default(true).describe('是否启用'),
  applicablePlatforms: z.array(z.string()).default([]).describe('适用平台'),
  applicableCategories: z.array(z.string()).default([]).describe('适用类目'),
  applicableAccountIds: z.array(z.string()).default([]).describe('适用账号'),
})
export class CreateHookTemplateDto extends createZodDto(CreateHookTemplateSchema, 'CreateHookTemplateDto') {}

export const UpdateHookTemplateSchema = CreateHookTemplateSchema.extend({
  category: z.nativeEnum(HookTemplateCategory).optional(),
  weight: z.number().min(0).max(100).optional(),
  enabled: z.boolean().optional(),
  applicableAccountIds: z.array(z.string()).default([]).optional(),
}).partial()
export class UpdateHookTemplateDto extends createZodDto(UpdateHookTemplateSchema, 'UpdateHookTemplateDto') {}

export const ListScriptTemplateSchema = PaginationQuerySchema.extend({
  scene: z.nativeEnum(ScriptTemplateScene).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  enabled: z.coerce.boolean().optional(),
})
export class ListScriptTemplateDto extends createZodDto(ListScriptTemplateSchema, 'ListScriptTemplateDto') {}

export const CreateScriptTemplateSchema = z.object({
  name: z.string().min(1).max(40).describe('模板名称'),
  content: z.string().min(1).max(1000).describe('话术内容'),
  scene: z.nativeEnum(ScriptTemplateScene).describe('适用场景'),
  variables: z.array(z.string().min(1).max(40)).max(20).default([]).describe('变量名'),
  enabled: z.boolean().default(true).describe('是否启用'),
  applicableCategories: z.array(z.string()).default([]).describe('适用类目'),
  riskLevel: z.enum(['low', 'medium', 'high']).default('low').describe('风险等级'),
  platformConstraints: z.object({
    allowWechatId: z.boolean().default(false),
    requireManualConfirm: z.boolean().default(true),
    blockedPlatforms: z.array(z.string()).default([]),
  }).default({}).describe('平台约束'),
})
export class CreateScriptTemplateDto extends createZodDto(CreateScriptTemplateSchema, 'CreateScriptTemplateDto') {}

export const UpdateScriptTemplateSchema = CreateScriptTemplateSchema.extend({
  variables: z.array(z.string().min(1).max(40)).max(20).optional(),
  enabled: z.boolean().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  platformConstraints: z.object({
    allowWechatId: z.boolean().default(false),
    requireManualConfirm: z.boolean().default(true),
    blockedPlatforms: z.array(z.string()).default([]),
  }).optional(),
}).partial()
export class UpdateScriptTemplateDto extends createZodDto(UpdateScriptTemplateSchema, 'UpdateScriptTemplateDto') {}
```

- [ ] **Step 2: Expand VOs**

Update `HookTemplateVoSchema`:

```ts
export const HookTemplateVoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  category: z.string(),
  content: z.string(),
  weight: z.number(),
  enabled: z.boolean(),
  applicablePlatforms: z.array(z.string()).default([]),
  applicableCategories: z.array(z.string()).default([]),
  applicableAccountIds: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
```

Update `ScriptTemplateVoSchema`:

```ts
export const ScriptTemplateVoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  content: z.string(),
  scene: z.string(),
  variables: z.array(z.string()).default([]),
  enabled: z.boolean(),
  applicableCategories: z.array(z.string()).default([]),
  riskLevel: z.string(),
  platformConstraints: z.object({
    allowWechatId: z.boolean().default(false),
    requireManualConfirm: z.boolean().default(true),
    blockedPlatforms: z.array(z.string()).default([]),
  }).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
```

- [ ] **Step 3: Add service tests for ownership and duplicate names**

In `strategy-template.service.spec.ts`, update mocks with new methods:

```ts
import { HookTemplateCategory, ScriptTemplateScene } from '@yikart/channel-db'

const hookTemplateRepository = {
  create: vi.fn(),
  getByName: vi.fn(),
  listByUser: vi.fn(),
  getByIdAndUser: vi.fn(),
  updateByIdAndUser: vi.fn(),
  deleteByIdAndUser: vi.fn(),
}
const scriptTemplateRepository = {
  create: vi.fn(),
  getByName: vi.fn(),
  listByUser: vi.fn(),
  getByIdAndUser: vi.fn(),
  updateByIdAndUser: vi.fn(),
  deleteByIdAndUser: vi.fn(),
}
const accountOpsConfigRepository = {
  upsertByAccountId: vi.fn(),
  getByAccountId: vi.fn(),
  listByUser: vi.fn(),
}
const channelAccountService = {
  getAccountInfo: vi.fn(),
  getUserAccountList: vi.fn(),
}
```

Add this test:

```ts
it('rejects account config updates for accounts not owned by the user', async () => {
  channelAccountService.getAccountInfo.mockResolvedValue({ id: 'account-1', userId: 'other-user' })

  await expect(service.upsertAccountConfig('user-1', 'account-1', {
    dailyPublishLimit: 10,
  } as any)).rejects.toMatchObject({ code: ResponseCode.ChannelAccountNotFound })
})

it('converts concurrent duplicate hook creates into validation errors', async () => {
  hookTemplateRepository.getByName.mockResolvedValue(null)
  hookTemplateRepository.create.mockRejectedValue({ code: 11000 })

  await expect(service.createHookTemplate('user-1', {
    name: '福利引导',
    category: HookTemplateCategory.BenefitGuide,
    content: '评论区告诉我你的尺码，我来给建议',
    weight: 1,
    enabled: true,
    applicablePlatforms: [],
    applicableCategories: [],
    applicableAccountIds: [],
  } as any)).rejects.toMatchObject({
    code: ResponseCode.ValidationFailed,
    data: { field: 'name', reason: 'hook_template_name_exists' },
  })
})

it('rejects public script contact info unless the scene is private-message WeChat guide', async () => {
  await expect(service.createScriptTemplate('user-1', {
    name: '公开引导',
    scene: ScriptTemplateScene.CommentPraise,
    content: '加我微信 abc123',
    variables: [],
    enabled: true,
    applicableCategories: [],
    riskLevel: 'high',
    platformConstraints: { allowWechatId: true, requireManualConfirm: true, blockedPlatforms: [] },
  } as any)).rejects.toMatchObject({
    code: ResponseCode.ValidationFailed,
    data: { field: 'content' },
  })
})
```

- [ ] **Step 4: Update service constructor**

Import and inject `ChannelAccountService`:

```ts
import { ChannelAccountService } from '../../channel/platforms/channel-account.service'
```

```ts
constructor(
  private readonly hookTemplateRepository: HookTemplateRepository,
  private readonly scriptTemplateRepository: ScriptTemplateRepository,
  private readonly accountOpsConfigRepository: AccountOpsConfigRepository,
  private readonly sensitiveWordService: SensitiveWordService,
  private readonly channelAccountService: ChannelAccountService,
) {}
```

- [ ] **Step 5: Import `ChannelSharedModule` in `AcquisitionModule`**

`ChannelAccountService` is exported from `ChannelSharedModule`, so `AcquisitionModule` must import it before Nest can resolve the new constructor dependency:

```ts
import { ChannelSharedModule } from '../channel/platforms/channel-shared.module'
```

Add it to the module imports array:

```ts
@Module({
  imports: [
    XhsBridgeModule,
    DouyinModule,
    DouyinApiModule,
    ChannelDbModule,
    SensitiveWordModule,
    AitoearnAiClientModule,
    PublishModule,
    ChannelSharedModule,
  ],
  // ...
})
export class AcquisitionModule {}
```

- [ ] **Step 6: Add service CRUD methods**

Add these methods to `StrategyTemplateService`:

```ts
async listHookTemplates(userId: string, query: ListHookTemplateDto) {
  return await this.hookTemplateRepository.listByUser(userId, query)
}

async createHookTemplate(userId: string, data: CreateHookTemplateDto) {
  const risk = this.sensitiveWordService.check(data.content || '')
  if (!risk.passed) {
    throw new AppException(ResponseCode.ValidationFailed, { field: 'content', reason: 'public_hook_blocked_words', hits: risk.hits })
  }
  const duplicated = await this.hookTemplateRepository.getByName(userId, String(data.name))
  if (duplicated) {
    throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'hook_template_name_exists' })
  }
  try {
    return await this.hookTemplateRepository.create({ ...data, userId })
  }
  catch (error) {
    if (this.isDuplicateKeyError(error)) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'hook_template_name_exists' })
    }
    throw error
  }
}

async updateHookTemplate(userId: string, id: string, data: UpdateHookTemplateDto) {
  if (data.content) {
    const risk = this.sensitiveWordService.check(data.content)
    if (!risk.passed) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'content', reason: 'public_hook_blocked_words', hits: risk.hits })
    }
  }
  if (data.name) {
    const duplicated = await this.hookTemplateRepository.getByName(userId, data.name)
    if (duplicated && String(duplicated.id) !== id) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'hook_template_name_exists' })
    }
  }
  const updated = await this.hookTemplateRepository.updateByIdAndUser(id, userId, data as any)
  if (!updated) throw new AppException(ResponseCode.StrategyTemplateNotFound)
  return updated
}

async deleteHookTemplate(userId: string, id: string) {
  const existing = await this.hookTemplateRepository.getByIdAndUser(id, userId)
  if (!existing) throw new AppException(ResponseCode.StrategyTemplateNotFound)
  await this.hookTemplateRepository.deleteByIdAndUser(id, userId)
  return { deleted: true }
}
```

Add these script methods with the existing private-WeChat rule preserved:

```ts
async listScriptTemplates(userId: string, query: ListScriptTemplateDto) {
  return await this.scriptTemplateRepository.listByUser(userId, query)
}

async createScriptTemplate(userId: string, data: CreateScriptTemplateDto) {
  this.assertScriptTemplateSafety(data)
  const duplicated = await this.scriptTemplateRepository.getByName(userId, String(data.name))
  if (duplicated) {
    throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'script_template_name_exists' })
  }
  try {
    return await this.scriptTemplateRepository.create({ ...data, userId })
  }
  catch (error) {
    if (this.isDuplicateKeyError(error)) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'script_template_name_exists' })
    }
    throw error
  }
}

async updateScriptTemplate(userId: string, id: string, data: UpdateScriptTemplateDto) {
  const existing = await this.scriptTemplateRepository.getByIdAndUser(id, userId)
  if (!existing) throw new AppException(ResponseCode.StrategyTemplateNotFound)
  this.assertScriptTemplateSafety({ ...existing, ...data })
  if (data.name) {
    const duplicated = await this.scriptTemplateRepository.getByName(userId, data.name)
    if (duplicated && String(duplicated.id) !== id) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'name', reason: 'script_template_name_exists' })
    }
  }
  const updated = await this.scriptTemplateRepository.updateByIdAndUser(id, userId, data as any)
  if (!updated) throw new AppException(ResponseCode.StrategyTemplateNotFound)
  return updated
}

async deleteScriptTemplate(userId: string, id: string) {
  const existing = await this.scriptTemplateRepository.getByIdAndUser(id, userId)
  if (!existing) throw new AppException(ResponseCode.StrategyTemplateNotFound)
  await this.scriptTemplateRepository.deleteByIdAndUser(id, userId)
  return { deleted: true }
}

private assertScriptTemplateSafety(data: Pick<CreateScriptTemplateDto, 'content' | 'scene' | 'platformConstraints'>) {
  const content = String(data.content || '')
  const risk = this.sensitiveWordService.check(content)
  const allowWechatId = Boolean(data.platformConstraints?.allowWechatId)
  const isPrivateWechatScene = data.scene === ScriptTemplateScene.PrivateMessageWechatGuide
  const exempted = allowWechatId && isPrivateWechatScene
  if (!risk.passed && !exempted) {
    throw new AppException(ResponseCode.ValidationFailed, { field: 'content', reason: 'script_template_blocked_words', hits: risk.hits })
  }
}

private isDuplicateKeyError(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: number }).code === 11000
}
```

- [ ] **Step 7: Update account config service methods**

Replace `upsertAccountConfig(accountId, data)` with:

```ts
import { Account } from '@yikart/mongodb'

private async assertAccountOwner(userId: string, accountId: string): Promise<Account> {
  const account = await this.channelAccountService.getAccountInfo(accountId)
  if (!account || account.userId !== userId) {
    throw new AppException(ResponseCode.ChannelAccountNotFound)
  }
  return account
}

async getAccountConfig(userId: string, accountId: string) {
  await this.assertAccountOwner(userId, accountId)
  return await this.accountOpsConfigRepository.getByAccountId(userId, accountId)
}

async upsertAccountConfig(userId: string, accountId: string, data: UpsertAccountOpsConfigDto) {
  await this.assertAccountOwner(userId, accountId)
  return await this.accountOpsConfigRepository.upsertByAccountId(userId, accountId, data)
}

async listAccountConfigs(userId: string) {
  const [accounts, configs] = await Promise.all([
    this.channelAccountService.getUserAccountList(userId),
    this.accountOpsConfigRepository.listByUser(userId),
  ])
  const configByAccountId = new Map(configs.map(config => [String(config.accountId), config]))
  return accounts.map(account => ({
    accountId: account.id,
    platform: account.type,
    nickname: account.nickname,
    avatar: account.avatar || '',
    status: account.status,
    config: configByAccountId.get(String(account.id)) || null,
  }))
}
```

`ChannelAccountService.getUserAccountList(userId)` currently delegates to a Mongo `find({ userId })`, so a user with no connected accounts returns `[]`. Do not catch and suppress unexpected database errors here; those should still fail the request and surface in logs.

- [ ] **Step 8: Run service tests**

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/content/strategy-template.service.spec.ts
```

Expected: all strategy service tests pass.

### Task 4: Add Backend Strategy Routes

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/acquisition-content.controller.ts`

- [ ] **Step 1: Import new DTOs and VOs**

Extend the controller imports:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'

import {
  CreateHookTemplateDto,
  CreateScriptTemplateDto,
  GenerateAcquisitionContentDto,
  ListAcquisitionContentDto,
  ListHookTemplateDto,
  ListScriptTemplateDto,
  ReviewAcquisitionContentDto,
  ScheduleAcquisitionContentDto,
  UpdateHookTemplateDto,
  UpdatePlatformContentDto,
  UpdateScriptTemplateDto,
  UpsertAccountOpsConfigDto,
} from './acquisition-content.dto'

import {
  AccountOpsConfigVo,
  AcquisitionContentListVo,
  AcquisitionContentVo,
  HookTemplateListVo,
  HookTemplateVo,
  ScriptTemplateListVo,
  ScriptTemplateVo,
} from './acquisition-content.vo'
```

- [ ] **Step 2: Add list routes before id routes**

Place list routes before `PATCH /strategy/hooks/:id` and `DELETE /strategy/hooks/:id`:

```ts
@ApiDoc({ summary: 'List hook templates', query: ListHookTemplateDto.schema, response: HookTemplateListVo })
@Get('/strategy/hooks')
async listHookTemplates(@GetToken() token: TokenInfo, @Query() query: ListHookTemplateDto) {
  const [list, total] = await this.strategyTemplateService.listHookTemplates(token.id, query)
  return new HookTemplateListVo(list, total, query)
}

@ApiDoc({ summary: 'List script templates', query: ListScriptTemplateDto.schema, response: ScriptTemplateListVo })
@Get('/strategy/scripts')
async listScriptTemplates(@GetToken() token: TokenInfo, @Query() query: ListScriptTemplateDto) {
  const [list, total] = await this.strategyTemplateService.listScriptTemplates(token.id, query)
  return new ScriptTemplateListVo(list, total, query)
}
```

- [ ] **Step 3: Add update/delete routes**

```ts
@ApiDoc({ summary: 'Update hook template', body: UpdateHookTemplateDto.schema, response: HookTemplateVo })
@Patch('/strategy/hooks/:id')
async updateHookTemplate(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: UpdateHookTemplateDto) {
  const template = await this.strategyTemplateService.updateHookTemplate(token.id, id, body)
  return HookTemplateVo.create(template)
}

@ApiDoc({ summary: 'Delete hook template' })
@Delete('/strategy/hooks/:id')
async deleteHookTemplate(@GetToken() token: TokenInfo, @Param('id') id: string) {
  return await this.strategyTemplateService.deleteHookTemplate(token.id, id)
}

@ApiDoc({ summary: 'Update script template', body: UpdateScriptTemplateDto.schema, response: ScriptTemplateVo })
@Patch('/strategy/scripts/:id')
async updateScriptTemplate(@GetToken() token: TokenInfo, @Param('id') id: string, @Body() body: UpdateScriptTemplateDto) {
  const template = await this.strategyTemplateService.updateScriptTemplate(token.id, id, body)
  return ScriptTemplateVo.create(template)
}

@ApiDoc({ summary: 'Delete script template' })
@Delete('/strategy/scripts/:id')
async deleteScriptTemplate(@GetToken() token: TokenInfo, @Param('id') id: string) {
  return await this.strategyTemplateService.deleteScriptTemplate(token.id, id)
}
```

- [ ] **Step 4: Add account config read/list routes**

Place `/strategy/accounts/configs` before `/strategy/accounts/:accountId/config`:

```ts
@ApiDoc({ summary: 'List account operation configs' })
@Get('/strategy/accounts/configs')
async listAccountConfigs(@GetToken() token: TokenInfo) {
  return { list: await this.strategyTemplateService.listAccountConfigs(token.id) }
}

@ApiDoc({ summary: 'Get acquisition account operations config', response: AccountOpsConfigVo })
@Get('/strategy/accounts/:accountId/config')
async getAccountConfig(@GetToken() token: TokenInfo, @Param('accountId') accountId: string) {
  const config = await this.strategyTemplateService.getAccountConfig(token.id, accountId)
  return config ? AccountOpsConfigVo.create(config) : null
}
```

Update existing upsert route:

```ts
const config = await this.strategyTemplateService.upsertAccountConfig(token.id, accountId, body)
```

- [ ] **Step 5: Run backend build**

Run:

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build succeeds.

### Task 5: Add Frontend Strategy API Types

**Files:**
- Create: `project/aitoearn-web/src/api/types/operationStrategy.ts`
- Create: `project/aitoearn-web/src/api/operationStrategy.ts`

- [ ] **Step 1: Create type contracts**

Create `operationStrategy.ts` under `src/api/types`:

```ts
import type { AcquisitionPlatform } from './acquisitionContent'

export type HookTemplateCategory =
  | 'follow_guide'
  | 'private_message_guide'
  | 'profile_guide'
  | 'benefit_guide'
  | 'stock_urgency'
  | 'size_consulting'
  | 'wechat_guide'

export type ScriptTemplateScene =
  | 'comment_ask_price'
  | 'comment_ask_link'
  | 'comment_ask_size'
  | 'comment_praise'
  | 'comment_price_objection'
  | 'comment_negative'
  | 'private_message_first'
  | 'private_message_value'
  | 'private_message_wechat_guide'

export type ScriptTemplateRiskLevel = 'low' | 'medium' | 'high'

export interface HookTemplate {
  id: string
  userId: string
  name: string
  category: HookTemplateCategory
  content: string
  weight: number
  enabled: boolean
  applicablePlatforms: AcquisitionPlatform[]
  applicableCategories: string[]
  applicableAccountIds: string[]
  createdAt: string
  updatedAt: string
}

export interface ScriptTemplate {
  id: string
  userId: string
  name: string
  scene: ScriptTemplateScene
  content: string
  variables: string[]
  enabled: boolean
  applicableCategories: string[]
  riskLevel: ScriptTemplateRiskLevel
  platformConstraints: {
    allowWechatId: boolean
    requireManualConfirm: boolean
    blockedPlatforms: AcquisitionPlatform[]
  }
  createdAt: string
  updatedAt: string
}

export interface AccountOpsConfig {
  id?: string
  accountId: string
  dailyPublishLimit: number
  dailyInteractionLimit: number
  dailyCommentFetchLimit: number
  dailyWechatGuideLimit: number
  defaultWechatId: string
  defaultScriptStrategy: string
  replyTone: 'friendly' | 'professional' | 'promotion' | 'restrained'
  enableAutoGenerate: boolean
  enableCommentFetch: boolean
  blockPublicContactInfo: boolean
  sensitiveWords: string[]
  commentFetchStatus?: string
  commentFetchStatusReason?: string
  commentFetchCheckedAt?: string
}

export interface StrategyListResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export type CreateHookTemplatePayload = Pick<
  HookTemplate,
  'name' | 'category' | 'content' | 'weight' | 'enabled' | 'applicablePlatforms' | 'applicableCategories' | 'applicableAccountIds'
>

export type UpdateHookTemplatePayload = Partial<CreateHookTemplatePayload>

export type CreateScriptTemplatePayload = Pick<
  ScriptTemplate,
  'name' | 'scene' | 'content' | 'variables' | 'enabled' | 'applicableCategories' | 'riskLevel' | 'platformConstraints'
>

export type UpdateScriptTemplatePayload = Partial<CreateScriptTemplatePayload>

export type UpsertAccountOpsConfigPayload = Omit<
  AccountOpsConfig,
  'id' | 'accountId' | 'commentFetchStatus' | 'commentFetchStatusReason' | 'commentFetchCheckedAt'
>
```

- [ ] **Step 2: Create API wrappers**

Create `src/api/operationStrategy.ts`:

```ts
import http from '@/utils/request'
import type {
  AccountOpsConfig,
  CreateHookTemplatePayload,
  CreateScriptTemplatePayload,
  HookTemplate,
  ScriptTemplate,
  StrategyListResponse,
  UpdateHookTemplatePayload,
  UpdateScriptTemplatePayload,
  UpsertAccountOpsConfigPayload,
} from './types/operationStrategy'

function unwrap<T>(response: any, fallback: string): T {
  if (!response || String(response.code) !== '0') throw new Error(response?.message || fallback)
  return response.data
}

export async function listHookTemplates(params: Record<string, string | number | boolean | undefined>) {
  return unwrap<StrategyListResponse<HookTemplate>>(
    await http.get('acquisition/strategy/hooks', params),
    'list hook templates failed',
  )
}

export async function createHookTemplate(data: CreateHookTemplatePayload) {
  return unwrap<HookTemplate>(await http.post('acquisition/strategy/hooks', data), 'create hook template failed')
}

export async function updateHookTemplate(id: string, data: UpdateHookTemplatePayload) {
  return unwrap<HookTemplate>(await http.patch(`acquisition/strategy/hooks/${id}`, data), 'update hook template failed')
}

export async function deleteHookTemplate(id: string) {
  return unwrap<{ deleted: boolean }>(await http.delete(`acquisition/strategy/hooks/${id}`), 'delete hook template failed')
}

export async function listScriptTemplates(params: Record<string, string | number | boolean | undefined>) {
  return unwrap<StrategyListResponse<ScriptTemplate>>(
    await http.get('acquisition/strategy/scripts', params),
    'list script templates failed',
  )
}

export async function createScriptTemplate(data: CreateScriptTemplatePayload) {
  return unwrap<ScriptTemplate>(await http.post('acquisition/strategy/scripts', data), 'create script template failed')
}

export async function updateScriptTemplate(id: string, data: UpdateScriptTemplatePayload) {
  return unwrap<ScriptTemplate>(await http.patch(`acquisition/strategy/scripts/${id}`, data), 'update script template failed')
}

export async function deleteScriptTemplate(id: string) {
  return unwrap<{ deleted: boolean }>(await http.delete(`acquisition/strategy/scripts/${id}`), 'delete script template failed')
}

export async function listAccountOpsConfigs() {
  return unwrap<{ list: Array<{ accountId: string; platform: string; nickname: string; avatar: string; status: string; config: AccountOpsConfig | null }> }>(
    await http.get('acquisition/strategy/accounts/configs'),
    'list account operation configs failed',
  )
}

export async function upsertAccountOpsConfig(accountId: string, data: UpsertAccountOpsConfigPayload) {
  return unwrap<AccountOpsConfig>(
    await http.post(`acquisition/strategy/accounts/${accountId}/config`, data),
    'upsert account operation config failed',
  )
}
```

- [ ] **Step 3: Run web type check**

Run:

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected: type check passes.

### Task 6: Build the Operation Strategy Page

**Files:**
- Modify: `project/aitoearn-web/src/app/[lng]/operation-strategy/page.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/operation-strategy/OperationStrategyPage/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/operation-strategy/components/HookTemplateManager/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/operation-strategy/components/ScriptTemplateManager/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/operation-strategy/components/AccountOpsConfigManager/index.tsx`
- Create: `project/aitoearn-web/src/app/[lng]/operation-strategy/components/StrategyStatusTag/index.tsx`

- [ ] **Step 1: Replace roadmap page**

Change `page.tsx`:

```tsx
import OperationStrategyPage from './OperationStrategyPage'

export default function Page() {
  return <OperationStrategyPage />
}
```

- [ ] **Step 2: Create page shell**

Create `OperationStrategyPage/index.tsx`:

```tsx
'use client'

import { Card, Space, Tabs, Typography } from 'antd'
import { useTransClient } from '@/app/i18n/client'
import HookTemplateManager from '../components/HookTemplateManager'
import ScriptTemplateManager from '../components/ScriptTemplateManager'
import AccountOpsConfigManager from '../components/AccountOpsConfigManager'

const { Text, Title } = Typography

export default function OperationStrategyPage() {
  const { t } = useTransClient('route')

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8fb', padding: '24px 28px 32px' }}>
      <Space direction="vertical" size={18} style={{ width: '100%', maxWidth: 1480, margin: '0 auto' }}>
        <div>
          <Text type="secondary">{t('operationStrategy.eyebrow')}</Text>
          <Title level={2} style={{ margin: '4px 0 0', lineHeight: 1.2 }}>{t('operationStrategy.title')}</Title>
          <Text type="secondary">{t('operationStrategy.subtitle')}</Text>
        </div>
        <Card style={{ borderRadius: 8, borderColor: '#e8edf5' }} styles={{ body: { padding: 16 } }}>
          <Tabs
            items={[
              { key: 'hooks', label: t('operationStrategy.tabs.hooks'), children: <HookTemplateManager /> },
              { key: 'scripts', label: t('operationStrategy.tabs.scripts'), children: <ScriptTemplateManager /> },
              { key: 'accounts', label: t('operationStrategy.tabs.accounts'), children: <AccountOpsConfigManager /> },
            ]}
          />
        </Card>
      </Space>
    </div>
  )
}
```

- [ ] **Step 3: Build hook manager**

Implement `HookTemplateManager` with this state and handler structure:

```tsx
const HOOK_CATEGORIES: HookTemplateCategory[] = [
  'follow_guide',
  'private_message_guide',
  'profile_guide',
  'benefit_guide',
  'stock_urgency',
  'size_consulting',
  'wechat_guide',
]

const PLATFORM_OPTIONS: AcquisitionPlatform[] = ['xhs', 'douyin', 'kwai']

const [rows, setRows] = useState<HookTemplate[]>([])
const [total, setTotal] = useState(0)
const [page, setPage] = useState(1)
const [pageSize, setPageSize] = useState(20)
const [filters, setFilters] = useState<{ category?: HookTemplateCategory; enabled?: boolean; keyword?: string }>({})
const [drawerOpen, setDrawerOpen] = useState(false)
const [active, setActive] = useState<HookTemplate | null>(null)
const [loading, setLoading] = useState(false)
const [form] = Form.useForm<CreateHookTemplatePayload>()

const load = useCallback(async () => {
  setLoading(true)
  try {
    const data = await listHookTemplates({ page, pageSize, ...filters })
    setRows(data.list)
    setTotal(data.total)
  }
  finally {
    setLoading(false)
  }
}, [filters, page, pageSize])

useEffect(() => { void load() }, [load])

function openCreate() {
  setActive(null)
  form.setFieldsValue({
    name: '',
    category: 'follow_guide',
    content: '',
    weight: 1,
    enabled: true,
    applicablePlatforms: [],
    applicableCategories: [],
    applicableAccountIds: [],
  })
  setDrawerOpen(true)
}

function openEdit(record: HookTemplate) {
  setActive(record)
  form.setFieldsValue(record)
  setDrawerOpen(true)
}

async function submit() {
  const values = await form.validateFields()
  if (active) await updateHookTemplate(active.id, values)
  else await createHookTemplate(values)
  message.success(t('operationStrategy.messages.saved'))
  setDrawerOpen(false)
  await load()
}

async function remove(record: HookTemplate) {
  await deleteHookTemplate(record.id)
  message.success(t('operationStrategy.messages.deleted'))
  await load()
}
```

Render category/enabled filters, keyword `Input.Search`, create button, a table with columns `name`, `category`, `content`, `scope`, `weight`, `enabled`, `updatedAt`, `actions`, and a drawer form with fields `name`, `category`, `content`, `weight`, `enabled`, `applicablePlatforms`, `applicableCategories`, `applicableAccountIds`. Delete actions must use `Popconfirm` with `operationStrategy.confirm.delete`.

Use i18n keys in the visible JSX, not hardcoded Chinese labels:

```tsx
const columns: ColumnsType<HookTemplate> = [
  { title: t('operationStrategy.columns.name'), dataIndex: 'name', width: 160 },
  { title: t('operationStrategy.columns.category'), dataIndex: 'category', width: 160 },
  { title: t('operationStrategy.columns.content'), dataIndex: 'content', ellipsis: true },
  { title: t('operationStrategy.columns.scope'), render: (_, record) => `${record.applicablePlatforms.length || t('operationStrategy.scope.allPlatforms')} / ${record.applicableCategories.length || t('operationStrategy.scope.allCategories')}` },
  { title: t('operationStrategy.columns.weight'), dataIndex: 'weight', width: 90 },
  { title: t('operationStrategy.columns.enabled'), render: (_, record) => <StrategyStatusTag enabled={record.enabled} /> },
  { title: t('operationStrategy.columns.updatedAt'), dataIndex: 'updatedAt', width: 180 },
  {
    title: t('operationStrategy.columns.actions'),
    width: 180,
    render: (_, record) => (
      <Space>
        <Button type="link" onClick={() => openEdit(record)}>{t('operationStrategy.actions.edit')}</Button>
        <Popconfirm title={t('operationStrategy.confirm.delete')} onConfirm={() => remove(record)}>
          <Button type="link" danger>{t('operationStrategy.actions.delete')}</Button>
        </Popconfirm>
      </Space>
    ),
  },
]

return (
  <Space direction="vertical" size={16} style={{ width: '100%' }}>
    <Space wrap>
      <Select allowClear placeholder={t('operationStrategy.filters.category')} options={HOOK_CATEGORIES.map(value => ({ value, label: t(`operationStrategy.hookCategories.${value}`) }))} onChange={category => setFilters(prev => ({ ...prev, category }))} />
      <Select allowClear placeholder={t('operationStrategy.filters.enabled')} options={[{ value: true, label: t('operationStrategy.status.enabled') }, { value: false, label: t('operationStrategy.status.disabled') }]} onChange={enabled => setFilters(prev => ({ ...prev, enabled }))} />
      <Input.Search placeholder={t('operationStrategy.filters.keyword')} onSearch={keyword => setFilters(prev => ({ ...prev, keyword }))} />
      <Button type="primary" onClick={openCreate}>{t('operationStrategy.actions.create')}</Button>
    </Space>
    <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ current: page, pageSize, total, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize) } }} />
    <Drawer title={active ? t('operationStrategy.actions.edit') : t('operationStrategy.actions.create')} open={drawerOpen} onClose={() => setDrawerOpen(false)} extra={<Button type="primary" onClick={submit}>{t('operationStrategy.actions.save')}</Button>}>
      <Form layout="vertical" form={form}>
        <Form.Item name="name" label={t('operationStrategy.fields.name')} rules={[{ required: true, message: t('operationStrategy.validation.required') }]}><Input /></Form.Item>
        <Form.Item name="category" label={t('operationStrategy.fields.category')} rules={[{ required: true, message: t('operationStrategy.validation.required') }]}><Select options={HOOK_CATEGORIES.map(value => ({ value, label: t(`operationStrategy.hookCategories.${value}`) }))} /></Form.Item>
        <Form.Item name="content" label={t('operationStrategy.fields.content')} rules={[{ required: true, message: t('operationStrategy.validation.required') }, { max: 500, message: t('operationStrategy.validation.max500') }]}><Input.TextArea rows={5} /></Form.Item>
        <Form.Item name="weight" label={t('operationStrategy.fields.weight')}><InputNumber min={0} max={100} /></Form.Item>
        <Form.Item name="enabled" label={t('operationStrategy.fields.enabled')} valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name="applicablePlatforms" label={t('operationStrategy.fields.applicablePlatforms')}><Select mode="multiple" options={PLATFORM_OPTIONS.map(value => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="applicableCategories" label={t('operationStrategy.fields.applicableCategories')}><Select mode="tags" /></Form.Item>
        <Form.Item name="applicableAccountIds" label={t('operationStrategy.fields.applicableAccountIds')}><Select mode="tags" /></Form.Item>
      </Form>
    </Drawer>
  </Space>
)
```

Ant Design form should use these rules:

```tsx
rules={[{ required: true, message: t('operationStrategy.validation.required') }]}
```

For content length:

```tsx
rules={[
  { required: true, message: t('operationStrategy.validation.required') },
  { max: 500, message: t('operationStrategy.validation.max500') },
]}
```

- [ ] **Step 4: Build script manager**

Implement `ScriptTemplateManager` with this state and handler structure:

```tsx
const SCRIPT_SCENES: ScriptTemplateScene[] = [
  'comment_ask_price',
  'comment_ask_link',
  'comment_ask_size',
  'comment_praise',
  'comment_price_objection',
  'comment_negative',
  'private_message_first',
  'private_message_value',
  'private_message_wechat_guide',
]

const RISK_LEVELS: ScriptTemplateRiskLevel[] = ['low', 'medium', 'high']

const [rows, setRows] = useState<ScriptTemplate[]>([])
const [total, setTotal] = useState(0)
const [page, setPage] = useState(1)
const [pageSize, setPageSize] = useState(20)
const [filters, setFilters] = useState<{ scene?: ScriptTemplateScene; riskLevel?: ScriptTemplateRiskLevel; enabled?: boolean; keyword?: string }>({})
const [drawerOpen, setDrawerOpen] = useState(false)
const [active, setActive] = useState<ScriptTemplate | null>(null)
const [loading, setLoading] = useState(false)
const [form] = Form.useForm<CreateScriptTemplatePayload>()

const load = useCallback(async () => {
  setLoading(true)
  try {
    const data = await listScriptTemplates({ page, pageSize, ...filters })
    setRows(data.list)
    setTotal(data.total)
  }
  finally {
    setLoading(false)
  }
}, [filters, page, pageSize])

useEffect(() => { void load() }, [load])

function openCreate() {
  setActive(null)
  form.setFieldsValue({
    name: '',
    scene: 'comment_praise',
    content: '',
    variables: [],
    enabled: true,
    applicableCategories: [],
    riskLevel: 'low',
    platformConstraints: { allowWechatId: false, requireManualConfirm: true, blockedPlatforms: [] },
  })
  setDrawerOpen(true)
}

function openEdit(record: ScriptTemplate) {
  setActive(record)
  form.setFieldsValue(record)
  setDrawerOpen(true)
}

async function submit() {
  const values = await form.validateFields()
  if (active) await updateScriptTemplate(active.id, values)
  else await createScriptTemplate(values)
  message.success(t('operationStrategy.messages.saved'))
  setDrawerOpen(false)
  await load()
}

async function remove(record: ScriptTemplate) {
  await deleteScriptTemplate(record.id)
  message.success(t('operationStrategy.messages.deleted'))
  await load()
}
```

Render scene/risk/enabled filters, keyword `Input.Search`, create button, a table with columns `name`, `scene`, `content`, `variables`, `riskLevel`, `enabled`, `updatedAt`, `actions`, and a drawer form with fields `name`, `scene`, `content`, `variables`, `applicableCategories`, `riskLevel`, `platformConstraints.allowWechatId`, `platformConstraints.requireManualConfirm`, `platformConstraints.blockedPlatforms`. Delete actions must use `Popconfirm` with `operationStrategy.confirm.delete`.

Use this JSX structure so all visible labels go through i18n:

```tsx
const columns: ColumnsType<ScriptTemplate> = [
  { title: t('operationStrategy.columns.name'), dataIndex: 'name', width: 160 },
  { title: t('operationStrategy.columns.scene'), dataIndex: 'scene', width: 180 },
  { title: t('operationStrategy.columns.content'), dataIndex: 'content', ellipsis: true },
  { title: t('operationStrategy.columns.variables'), render: (_, record) => record.variables.join(', ') || '-' },
  { title: t('operationStrategy.columns.riskLevel'), render: (_, record) => t(`operationStrategy.risk.${record.riskLevel}`) },
  { title: t('operationStrategy.columns.enabled'), render: (_, record) => <StrategyStatusTag enabled={record.enabled} /> },
  { title: t('operationStrategy.columns.updatedAt'), dataIndex: 'updatedAt', width: 180 },
  {
    title: t('operationStrategy.columns.actions'),
    render: (_, record) => (
      <Space>
        <Button type="link" onClick={() => openEdit(record)}>{t('operationStrategy.actions.edit')}</Button>
        <Popconfirm title={t('operationStrategy.confirm.delete')} onConfirm={() => remove(record)}>
          <Button type="link" danger>{t('operationStrategy.actions.delete')}</Button>
        </Popconfirm>
      </Space>
    ),
  },
]

return (
  <Space direction="vertical" size={16} style={{ width: '100%' }}>
    <Space wrap>
      <Select allowClear placeholder={t('operationStrategy.filters.scene')} options={SCRIPT_SCENES.map(value => ({ value, label: t(`operationStrategy.scenes.${value}`) }))} onChange={scene => setFilters(prev => ({ ...prev, scene }))} />
      <Select allowClear placeholder={t('operationStrategy.filters.riskLevel')} options={RISK_LEVELS.map(value => ({ value, label: t(`operationStrategy.risk.${value}`) }))} onChange={riskLevel => setFilters(prev => ({ ...prev, riskLevel }))} />
      <Select allowClear placeholder={t('operationStrategy.filters.enabled')} options={[{ value: true, label: t('operationStrategy.status.enabled') }, { value: false, label: t('operationStrategy.status.disabled') }]} onChange={enabled => setFilters(prev => ({ ...prev, enabled }))} />
      <Input.Search placeholder={t('operationStrategy.filters.keyword')} onSearch={keyword => setFilters(prev => ({ ...prev, keyword }))} />
      <Button type="primary" onClick={openCreate}>{t('operationStrategy.actions.create')}</Button>
    </Space>
    <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ current: page, pageSize, total, onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize) } }} />
    <Drawer title={active ? t('operationStrategy.actions.edit') : t('operationStrategy.actions.create')} open={drawerOpen} onClose={() => setDrawerOpen(false)} extra={<Button type="primary" onClick={submit}>{t('operationStrategy.actions.save')}</Button>}>
      <Form layout="vertical" form={form}>
        <Form.Item name="name" label={t('operationStrategy.fields.name')} rules={[{ required: true, message: t('operationStrategy.validation.required') }]}><Input /></Form.Item>
        <Form.Item name="scene" label={t('operationStrategy.fields.scene')} rules={[{ required: true, message: t('operationStrategy.validation.required') }]}><Select options={SCRIPT_SCENES.map(value => ({ value, label: t(`operationStrategy.scenes.${value}`) }))} /></Form.Item>
        <Form.Item name="content" label={t('operationStrategy.fields.content')} rules={[{ required: true, message: t('operationStrategy.validation.required') }, { max: 1000, message: t('operationStrategy.validation.max1000') }]}><Input.TextArea rows={6} /></Form.Item>
        <Form.Item name="variables" label={t('operationStrategy.fields.variables')}><Select mode="tags" /></Form.Item>
        <Form.Item name="applicableCategories" label={t('operationStrategy.fields.applicableCategories')}><Select mode="tags" /></Form.Item>
        <Form.Item name="riskLevel" label={t('operationStrategy.fields.riskLevel')}><Select options={RISK_LEVELS.map(value => ({ value, label: t(`operationStrategy.risk.${value}`) }))} /></Form.Item>
        <Form.Item name={['platformConstraints', 'allowWechatId']} label={t('operationStrategy.fields.allowWechatId')} valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name={['platformConstraints', 'requireManualConfirm']} label={t('operationStrategy.fields.requireManualConfirm')} valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name={['platformConstraints', 'blockedPlatforms']} label={t('operationStrategy.fields.blockedPlatforms')}><Select mode="multiple" options={PLATFORM_OPTIONS.map(value => ({ value, label: value }))} /></Form.Item>
      </Form>
    </Drawer>
  </Space>
)
```

The UI should show a warning text when `allowWechatId` is enabled:

```tsx
<Alert
  type="warning"
  showIcon
  message={t('operationStrategy.scripts.wechatPrivateOnly') }
/>
```

- [ ] **Step 5: Build account config manager**

Implement `AccountOpsConfigManager` with this state and handler structure:

```tsx
type AccountConfigRow = Awaited<ReturnType<typeof listAccountOpsConfigs>>['list'][number]

const [rows, setRows] = useState<AccountConfigRow[]>([])
const [active, setActive] = useState<AccountConfigRow | null>(null)
const [drawerOpen, setDrawerOpen] = useState(false)
const [loading, setLoading] = useState(false)
const [form] = Form.useForm<UpsertAccountOpsConfigPayload>()

const load = useCallback(async () => {
  setLoading(true)
  try {
    const data = await listAccountOpsConfigs()
    setRows(data.list)
  }
  finally {
    setLoading(false)
  }
}, [])

useEffect(() => { void load() }, [load])

function openEdit(row: AccountConfigRow) {
  setActive(row)
  form.setFieldsValue({ ...defaultConfig, ...(row.config || {}) })
  setDrawerOpen(true)
}

async function submit() {
  if (!active) return
  const values = await form.validateFields()
  await upsertAccountOpsConfig(active.accountId, values)
  message.success(t('operationStrategy.messages.saved'))
  setDrawerOpen(false)
  await load()
}
```

Render the account table with columns `platform`, `avatar/nickname`, `dailyPublishLimit`, `dailyInteractionLimit`, `dailyCommentFetchLimit`, `dailyWechatGuideLimit`, `replyTone`, `commentFetchStatus`, and `actions`. The edit drawer uses `InputNumber` for limits, `Switch` for booleans, `Select` for `replyTone`, and `Select mode="tags"` for `sensitiveWords`.

Use this JSX structure for the table and drawer:

```tsx
const columns: ColumnsType<AccountConfigRow> = [
  { title: t('operationStrategy.columns.platform'), dataIndex: 'platform', width: 120 },
  { title: t('operationStrategy.columns.account'), render: (_, row) => <Space><Avatar src={row.avatar} />{row.nickname || row.accountId}</Space> },
  { title: t('operationStrategy.columns.dailyPublishLimit'), render: (_, row) => row.config?.dailyPublishLimit ?? defaultConfig.dailyPublishLimit },
  { title: t('operationStrategy.columns.dailyInteractionLimit'), render: (_, row) => row.config?.dailyInteractionLimit ?? defaultConfig.dailyInteractionLimit },
  { title: t('operationStrategy.columns.dailyCommentFetchLimit'), render: (_, row) => row.config?.dailyCommentFetchLimit ?? defaultConfig.dailyCommentFetchLimit },
  { title: t('operationStrategy.columns.dailyWechatGuideLimit'), render: (_, row) => row.config?.dailyWechatGuideLimit ?? defaultConfig.dailyWechatGuideLimit },
  { title: t('operationStrategy.columns.replyTone'), render: (_, row) => t(`operationStrategy.tone.${row.config?.replyTone || defaultConfig.replyTone}`) },
  { title: t('operationStrategy.columns.commentFetchStatus'), render: (_, row) => row.config?.commentFetchStatus || '-' },
  { title: t('operationStrategy.columns.actions'), render: (_, row) => <Button type="link" onClick={() => openEdit(row)}>{t('operationStrategy.actions.edit')}</Button> },
]

return (
  <Space direction="vertical" size={16} style={{ width: '100%' }}>
    <Button onClick={load}>{t('operationStrategy.actions.refresh')}</Button>
    <Table rowKey="accountId" loading={loading} columns={columns} dataSource={rows} pagination={false} />
    <Drawer title={t('operationStrategy.tabs.accounts')} open={drawerOpen} onClose={() => setDrawerOpen(false)} extra={<Button type="primary" onClick={submit}>{t('operationStrategy.actions.save')}</Button>}>
      <Form layout="vertical" form={form}>
        <Form.Item name="dailyPublishLimit" label={t('operationStrategy.columns.dailyPublishLimit')}><InputNumber min={0} max={100} /></Form.Item>
        <Form.Item name="dailyInteractionLimit" label={t('operationStrategy.columns.dailyInteractionLimit')}><InputNumber min={0} max={1000} /></Form.Item>
        <Form.Item name="dailyCommentFetchLimit" label={t('operationStrategy.columns.dailyCommentFetchLimit')}><InputNumber min={0} max={1000} /></Form.Item>
        <Form.Item name="dailyWechatGuideLimit" label={t('operationStrategy.columns.dailyWechatGuideLimit')}><InputNumber min={0} max={1000} /></Form.Item>
        <Form.Item name="replyTone" label={t('operationStrategy.columns.replyTone')}><Select options={['friendly', 'professional', 'promotion', 'restrained'].map(value => ({ value, label: t(`operationStrategy.tone.${value}`) }))} /></Form.Item>
        <Form.Item name="enableAutoGenerate" label={t('operationStrategy.fields.enableAutoGenerate')} valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name="enableCommentFetch" label={t('operationStrategy.fields.enableCommentFetch')} valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name="blockPublicContactInfo" label={t('operationStrategy.fields.blockPublicContactInfo')} valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name="sensitiveWords" label={t('operationStrategy.fields.sensitiveWords')}><Select mode="tags" /></Form.Item>
      </Form>
    </Drawer>
  </Space>
)
```

Default form values when `config` is `null`:

```ts
const defaultConfig = {
  dailyPublishLimit: 10,
  dailyInteractionLimit: 50,
  dailyCommentFetchLimit: 20,
  dailyWechatGuideLimit: 10,
  defaultWechatId: '',
  defaultScriptStrategy: '',
  replyTone: 'friendly',
  enableAutoGenerate: true,
  enableCommentFetch: true,
  blockPublicContactInfo: true,
  sensitiveWords: [],
}
```

- [ ] **Step 6: Run frontend verification**

Run:

```bash
cd project/aitoearn-web
pnpm run type-check
pnpm build
```

Expected: type check and build pass.

### Task 7: Wire Strategy Usage Into Generation and Replies

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/hook-selection.service.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/content-generation.service.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-suggestion.service.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/strategy-template.service.spec.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/content/content-generation.service.spec.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-suggestion.service.spec.ts`

- [ ] **Step 1: Make hook selection user-scoped**

Change `selectHook` signature:

```ts
async selectHook(query: { userId: string, platform: string, accountId?: string, category?: string }) {
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
```

Update `ContentGenerationService.generate()` call:

```ts
const hook = dto.autoAttachHook
  ? await this.hookSelectionService.selectHook({
    userId,
    platform: normalized.platform,
    accountId: dto.accountIds[0],
    category: dto.productCategory,
  })
  : null
```

- [ ] **Step 2: Use account config in content generation**

Update imports in `content-generation.service.ts`:

```ts
import { AccountOpsConfig, AccountOpsConfigRepository, AcquisitionContentRepository, AcquisitionContentStatus } from '@yikart/channel-db'
```

Inject `AccountOpsConfigRepository` after `AcquisitionContentRepository`:

```ts
constructor(
  private readonly aiService: AiService,
  private readonly acquisitionContentRepository: AcquisitionContentRepository,
  private readonly accountOpsConfigRepository: AccountOpsConfigRepository,
  private readonly hookSelectionService: HookSelectionService,
  private readonly platformContentAdapter: PlatformContentAdapterService,
  private readonly sensitiveWordService: SensitiveWordService,
) {}
```

At the start of `ContentGenerationService.generate()`, load first account config when `accountIds[0]` exists and pass it into prompt creation:

```ts
const accountConfig = dto.accountIds[0]
  ? await this.accountOpsConfigRepository.getByAccountId(userId, dto.accountIds[0])
  : null
const prompt = this.buildPrompt(dto, accountConfig)
```

Replace the existing `const prompt = this.buildPrompt(dto)` line with the code above.

Change `buildPrompt` to create a mutable `lines` array:

```ts
private buildPrompt(dto: GenerateAcquisitionContentDto, accountConfig?: AccountOpsConfig | null) {
  const lines = [
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
  ]

  if (accountConfig?.replyTone) {
    lines.push(`账号语气: ${accountConfig.replyTone}`)
  }
  if (accountConfig?.sensitiveWords?.length) {
    lines.push(`账号自定义敏感词: ${accountConfig.sensitiveWords.join(',')}`)
  }

  return lines.join('\n')
}
```

Update `content-generation.service.spec.ts` setup so the constructor receives an `accountOpsConfigRepository` mock:

```ts
const accountOpsConfigRepository = {
  getByAccountId: vi.fn(),
}
```

Add a test that sets `accountOpsConfigRepository.getByAccountId.mockResolvedValue({ replyTone: 'professional', sensitiveWords: ['竞品词'] })`, calls `generate()`, and asserts the AI user prompt contains `账号语气: professional` and `账号自定义敏感词: 竞品词`.

- [ ] **Step 3: Let reply suggestion consume script templates**

In `ReplySuggestionService`, inject `ScriptTemplateRepository` and choose a public comment script before calling AI:

```ts
const scripts = await this.scriptTemplateRepository.listByScene(
  userId,
  'comment_praise',
  '',
)
const scriptInstruction = scripts[0]?.content
  ? `优先参考这条话术模板，但不要照抄: ${scripts[0].content}`
  : '没有可用话术模板时，生成一条自然、简短、无联系方式的公开评论回复。'
```

Use it in the user message:

```ts
{ role: 'user', content: `平台: ${lead.platform}\n用户评论: ${lead.sourceContent || ''}\n${scriptInstruction}` }
```

- [ ] **Step 4: Run backend tests**

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/acquisition/content/strategy-template.service.spec.ts apps/aitoearn-server/src/core/acquisition/content/content-generation.service.spec.ts apps/aitoearn-server/src/core/acquisition/leads/reply-suggestion.service.spec.ts
pnpm nx run aitoearn-server:build
```

Expected: tests and build pass.

### Task 8: Add i18n Labels and Browser Acceptance

**Files:**
- Modify: `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json`
- Modify: `project/aitoearn-web/src/app/i18n/locales/en/route.json`

- [ ] **Step 1: Add route labels**

Add this key group to both locale files, translated in each language:

```json
{
  "operationStrategy.eyebrow": "运营资产",
  "operationStrategy.title": "运营策略",
  "operationStrategy.subtitle": "管理内容钩子、回复话术、账号级运营规则和敏感词校验。",
  "operationStrategy.tabs.hooks": "钩子库",
  "operationStrategy.tabs.scripts": "话术模板库",
  "operationStrategy.tabs.accounts": "账号策略",
  "operationStrategy.actions.create": "新建",
  "operationStrategy.actions.edit": "编辑",
  "operationStrategy.actions.delete": "删除",
  "operationStrategy.actions.enable": "启用",
  "operationStrategy.actions.disable": "停用",
  "operationStrategy.actions.save": "保存",
  "operationStrategy.actions.refresh": "刷新",
  "operationStrategy.actions.cancel": "取消",
  "operationStrategy.actions.confirm": "确认",
  "operationStrategy.confirm.delete": "确认删除这条策略资产？",
  "operationStrategy.messages.saved": "已保存",
  "operationStrategy.messages.deleted": "已删除",
  "operationStrategy.messages.loadFailed": "加载失败",
  "operationStrategy.messages.saveFailed": "保存失败",
  "operationStrategy.messages.deleteFailed": "删除失败",
  "operationStrategy.filters.category": "钩子类型",
  "operationStrategy.filters.scene": "话术场景",
  "operationStrategy.filters.riskLevel": "风险等级",
  "operationStrategy.filters.enabled": "启用状态",
  "operationStrategy.filters.keyword": "搜索名称或内容",
  "operationStrategy.columns.name": "名称",
  "operationStrategy.columns.category": "类型",
  "operationStrategy.columns.scene": "场景",
  "operationStrategy.columns.content": "内容",
  "operationStrategy.columns.scope": "适用范围",
  "operationStrategy.columns.weight": "权重",
  "operationStrategy.columns.enabled": "状态",
  "operationStrategy.columns.variables": "变量",
  "operationStrategy.columns.riskLevel": "风险",
  "operationStrategy.columns.updatedAt": "更新时间",
  "operationStrategy.columns.actions": "操作",
  "operationStrategy.columns.platform": "平台",
  "operationStrategy.columns.account": "账号",
  "operationStrategy.columns.dailyPublishLimit": "发布上限",
  "operationStrategy.columns.dailyInteractionLimit": "互动上限",
  "operationStrategy.columns.dailyCommentFetchLimit": "评论抓取上限",
  "operationStrategy.columns.dailyWechatGuideLimit": "微信引导上限",
  "operationStrategy.columns.replyTone": "回复语气",
  "operationStrategy.columns.commentFetchStatus": "评论抓取状态",
  "operationStrategy.fields.name": "名称",
  "operationStrategy.fields.category": "钩子类型",
  "operationStrategy.fields.scene": "话术场景",
  "operationStrategy.fields.content": "内容",
  "operationStrategy.fields.weight": "权重",
  "operationStrategy.fields.enabled": "启用",
  "operationStrategy.fields.applicablePlatforms": "适用平台",
  "operationStrategy.fields.applicableCategories": "适用类目",
  "operationStrategy.fields.applicableAccountIds": "适用账号",
  "operationStrategy.fields.variables": "变量",
  "operationStrategy.fields.riskLevel": "风险等级",
  "operationStrategy.fields.allowWechatId": "允许微信号",
  "operationStrategy.fields.requireManualConfirm": "需要人工确认",
  "operationStrategy.fields.blockedPlatforms": "禁用平台",
  "operationStrategy.fields.enableAutoGenerate": "启用自动生成",
  "operationStrategy.fields.enableCommentFetch": "启用评论抓取",
  "operationStrategy.fields.blockPublicContactInfo": "拦截公开联系方式",
  "operationStrategy.fields.sensitiveWords": "敏感词",
  "operationStrategy.scope.allPlatforms": "全部平台",
  "operationStrategy.scope.allCategories": "全部类目",
  "operationStrategy.hookCategories.follow_guide": "关注引导",
  "operationStrategy.hookCategories.private_message_guide": "私信引导",
  "operationStrategy.hookCategories.profile_guide": "主页引导",
  "operationStrategy.hookCategories.benefit_guide": "福利引导",
  "operationStrategy.hookCategories.stock_urgency": "库存紧迫",
  "operationStrategy.hookCategories.size_consulting": "尺码咨询",
  "operationStrategy.hookCategories.wechat_guide": "微信引导",
  "operationStrategy.scenes.comment_ask_price": "评论问价格",
  "operationStrategy.scenes.comment_ask_link": "评论求链接",
  "operationStrategy.scenes.comment_ask_size": "评论问尺码",
  "operationStrategy.scenes.comment_praise": "评论夸赞",
  "operationStrategy.scenes.comment_price_objection": "评论价格异议",
  "operationStrategy.scenes.comment_negative": "负面评论",
  "operationStrategy.scenes.private_message_first": "私信首轮",
  "operationStrategy.scenes.private_message_value": "私信价值说明",
  "operationStrategy.scenes.private_message_wechat_guide": "私信微信引导",
  "operationStrategy.validation.required": "请填写必填项",
  "operationStrategy.validation.max500": "最多 500 个字符",
  "operationStrategy.validation.max1000": "最多 1000 个字符",
  "operationStrategy.status.enabled": "已启用",
  "operationStrategy.status.disabled": "已停用",
  "operationStrategy.risk.low": "低",
  "operationStrategy.risk.medium": "中",
  "operationStrategy.risk.high": "高",
  "operationStrategy.tone.friendly": "友好",
  "operationStrategy.tone.professional": "专业",
  "operationStrategy.tone.promotion": "促销",
  "operationStrategy.tone.restrained": "克制",
  "operationStrategy.scripts.wechatPrivateOnly": "微信号只能用于私信人工确认场景，不会用于公开评论。"
}
```

Use English translations in `en/route.json` with the same keys.

- [ ] **Step 2: Run browser acceptance checks**

Start or reuse local services:

```bash
cd project/aitoearn-web
pnpm dev -p 6061
```

Open:

```text
http://127.0.0.1:6061/zh-CN/operation-strategy
```

Accept when all checks pass:

- The page no longer renders the roadmap cards.
- Hook tab loads an empty table or existing hook rows without console errors.
- Creating a hook with safe content succeeds and appears in the table.
- Creating a hook containing `微信` fails with a visible validation message.
- Script tab can create a private-message WeChat script only when `allowWechatId` is enabled.
- Account tab lists connected accounts and saves numeric limits.
- Reloading the page keeps saved templates/configs.

- [ ] **Step 3: Run final verification**

Run:

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build

cd ../aitoearn-web
pnpm run type-check
pnpm build

cd ../..
git diff --check
```

Expected: all commands exit with code `0`.

## Migration Notes

Before running any production migration, dry-run the affected row count and record the result:

```js
db.hook_template.countDocuments({ userId: { $exists: false } })
db.script_template.countDocuments({ userId: { $exists: false } })
db.account_ops_config.countDocuments({ userId: { $exists: false } })
```

If local or deployed MongoDB already contains templates without `userId`, choose one owner before enabling unique indexes:

```js
db.hook_template.updateMany({ userId: { $exists: false } }, { $set: { userId: "OWNER_USER_ID" } })
db.script_template.updateMany({ userId: { $exists: false } }, { $set: { userId: "OWNER_USER_ID" } })
db.account_ops_config.updateMany({ userId: { $exists: false } }, { $set: { userId: "OWNER_USER_ID" } })
```

Before adding `{ userId, name }` unique indexes, inspect duplicate names:

```js
db.hook_template.aggregate([{ $group: { _id: { userId: "$userId", name: "$name" }, count: { $sum: 1 }, ids: { $push: "$_id" } } }, { $match: { count: { $gt: 1 } } }])
db.script_template.aggregate([{ $group: { _id: { userId: "$userId", name: "$name" }, count: { $sum: 1 }, ids: { $push: "$_id" } } }, { $match: { count: { $gt: 1 } } }])
db.account_ops_config.aggregate([{ $group: { _id: { userId: "$userId", accountId: "$accountId" }, count: { $sum: 1 }, ids: { $push: "$_id" } } }, { $match: { count: { $gt: 1 } } }])
```

Resolve duplicate rows by renaming, deleting unused drafts, or merging applicability arrays before deployment.

If MongoDB already has the old global unique index on `accountId`, create the new compound `{ userId, accountId }` unique index first, then drop the old global index after the new index exists. This avoids a window where account config writes are not protected by a uniqueness constraint:

```js
db.account_ops_config.createIndex({ userId: 1, accountId: 1 }, { unique: true, name: "uniq_account_ops_config_user_account" })
db.account_ops_config.dropIndex("accountId_1")
```

## Review Checklist

- Strategy routes are authenticated through existing `@GetToken()` usage.
- Every template query includes `userId`.
- Account config updates verify account ownership through `ChannelAccountService`.
- Route order keeps `/strategy/accounts/configs` before `/strategy/accounts/:accountId/config`.
- Frontend calls use the shared `http` wrapper and typed unwrap helpers.
- Public content validation stays server-side; frontend messages are advisory only.
- `operation-strategy` uses i18n keys instead of hardcoded visible strings.
- Every public `StrategyTemplateService` method has at least one focused Vitest case covering success and one relevant failure path.
