# Online Feature Replication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replicate the live `aitoearn.cn` creator/advertiser task marketplace, gold ledger, and XHS data entry points in the local `AitoBee` app.

**Architecture:** Add a local promotion marketplace domain to the backend, then wire new frontend routes to that API. Preserve existing publishing, channel account, engagement, XHS plugin, and draft/material systems instead of replacing them.

**Tech Stack:** Next.js app router, Zustand, pnpm, NestJS, Nx, Mongoose, MongoDB, BullMQ/Redis, existing channel publishing and plugin modules.

**Local Ports:** Use the repo runtime convention from `AGENTS.md`: frontend `6061`, local API proxy `7001`, server `3002`, and AI service `3010`.

---

## File Structure

Backend create:

- `project/aitoearn-backend/libs/channel-db/src/schemas/promotion-task.schema.ts`
- `project/aitoearn-backend/libs/channel-db/src/schemas/promotion-application.schema.ts`
- `project/aitoearn-backend/libs/channel-db/src/schemas/promotion-ledger.schema.ts`
- `project/aitoearn-backend/libs/channel-db/src/repositories/promotion-task.repository.ts`
- `project/aitoearn-backend/libs/channel-db/src/repositories/promotion-application.repository.ts`
- `project/aitoearn-backend/libs/channel-db/src/repositories/promotion-ledger.repository.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/promotion-marketplace/promotion-marketplace.constants.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/promotion-marketplace/promotion-marketplace.dto.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/promotion-marketplace/promotion-marketplace.vo.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/promotion-marketplace/promotion-marketplace.service.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/promotion-marketplace/promotion-marketplace.controller.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/promotion-marketplace/promotion-marketplace.module.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/promotion-marketplace/promotion-marketplace.service.spec.ts`

Backend modify:

- `project/aitoearn-backend/libs/channel-db/src/schemas/index.ts`
- `project/aitoearn-backend/libs/channel-db/src/repositories/index.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/app.module.ts`

Frontend create:

- `project/aitoearn-web/src/api/promotion.ts`
- `project/aitoearn-web/src/app/[lng]/task-square/page.tsx`
- `project/aitoearn-web/src/app/[lng]/task-square/TaskSquarePage.tsx`
- `project/aitoearn-web/src/app/[lng]/task-square/taskSquareStore.ts`
- `project/aitoearn-web/src/app/[lng]/task-square/components/RoleSwitch.tsx`
- `project/aitoearn-web/src/app/[lng]/task-square/components/TaskFilters.tsx`
- `project/aitoearn-web/src/app/[lng]/task-square/components/TaskCard.tsx`
- `project/aitoearn-web/src/app/[lng]/task/[taskId]/page.tsx`
- `project/aitoearn-web/src/app/[lng]/task/[taskId]/TaskDetailPage.tsx`
- `project/aitoearn-web/src/app/[lng]/task/[taskId]/taskDetailStore.ts`
- `project/aitoearn-web/src/app/[lng]/advertiser/tasks/page.tsx`
- `project/aitoearn-web/src/app/[lng]/advertiser/tasks/AdvertiserTasksPage.tsx`
- `project/aitoearn-web/src/app/[lng]/advertiser/tasks/advertiserTaskStore.ts`
- `project/aitoearn-web/src/app/[lng]/gold/page.tsx`
- `project/aitoearn-web/src/app/[lng]/gold/GoldPage.tsx`
- `project/aitoearn-web/src/app/[lng]/gold/goldStore.ts`
- `project/aitoearn-web/src/app/[lng]/xhs-data/page.tsx`
- `project/aitoearn-web/src/app/[lng]/xhs-data/XhsDataPage.tsx`
- `project/aitoearn-web/src/app/[lng]/note-comment-search/page.tsx`
- `project/aitoearn-web/src/app/[lng]/note-comment-search/NoteCommentSearchPage.tsx`
- `project/aitoearn-web/src/app/[lng]/HomeRoleRouter.tsx`

Frontend modify:

- `project/aitoearn-web/src/app/[lng]/page.tsx`
- `project/aitoearn-web/src/app/layout/routerData.tsx`
- `project/aitoearn-web/src/app/i18n/locales/en/route.json`
- `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json`
- `project/aitoearn-web/src/app/i18n/locales/en/common.json`
- `project/aitoearn-web/src/app/i18n/locales/zh-CN/common.json`

## Task 1: Capture Live Baseline

- [ ] Save current live DOM text for `/en`, `/en?role=creator`, and `/en?role=advertiser`.

Run:

```bash
node <<'NODE'
const urls = [
  'https://aitoearn.cn/en',
  'https://aitoearn.cn/en?role=creator',
  'https://aitoearn.cn/en?role=advertiser',
]
for (const url of urls) {
  const res = await fetch(url)
  const html = await res.text()
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '\\n[script]\\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\\n[style]\\n')
    .replace(/<[^>]+>/g, '\\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .split('\\n')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 220)
    .join('\\n')
  console.log(`\\n===== ${url} =====\\n${text}`)
}
NODE
```

Expected:

- Creator route includes `Gold Rush Square`, `Creator`, `Accept tasks`, `Advertiser`, `Publish tasks`, `Accept Task`, and at least one CPM/CPE reward unit such as `Per 1K`.
- Advertiser route includes the advertiser role copy and no fatal error.

- [ ] Save local baseline for `/en?role=creator`.

Run:

```bash
curl -L --max-time 20 -s 'http://127.0.0.1:6061/en?role=creator' \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(s.replace(/<script[\\s\\S]*?<\\/script>/gi,'\\n[script]\\n').replace(/<style[\\s\\S]*?<\\/style>/gi,'\\n[style]\\n').replace(/<[^>]+>/g,'\\n').split('\\n').map(x=>x.trim()).filter(Boolean).slice(0,120).join('\\n')))"
```

Expected:

- Current output still contains `Content Management` and does not contain `Gold Rush Square`. This confirms the gap before implementation.

## Task 2: Add Backend Data Models

- [ ] Create `project/aitoearn-backend/libs/channel-db/src/schemas/promotion-task.schema.ts`.

Code:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum PromotionSettlementType {
  Fixed = 'fixed',
  Cpm = 'cpm',
  Cpe = 'cpe',
  Interaction = 'interaction',
}

export enum PromotionTaskStatus {
  Draft = 'draft',
  Published = 'published',
  Paused = 'paused',
  SoldOut = 'sold_out',
  Ended = 'ended',
  Archived = 'archived',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'promotionTask' })
export class PromotionTask extends BaseTemp {
  id: string

  @Prop({ required: true, index: true })
  advertiserUserId: string

  @Prop({ required: true })
  title: string

  @Prop({ default: '' })
  description: string

  @Prop({ required: true, index: true })
  platform: string

  @Prop({ type: [String], default: [] })
  tags: string[]

  @Prop({ required: true, enum: PromotionSettlementType })
  settlementType: PromotionSettlementType

  @Prop({ default: 0 })
  rewardAmount: number

  @Prop({ default: 0 })
  cpmRewardPerThousand: number

  @Prop({ default: 0 })
  cpeRewardPerThousand: number

  @Prop({ default: 0 })
  capAmount: number

  @Prop({ default: 0 })
  followerLimit: number

  @Prop({ default: 0 })
  quotaTotal: number

  @Prop({ default: 0 })
  quotaAccepted: number

  @Prop({ type: Date })
  startsAt?: Date

  @Prop({ type: Date })
  endsAt?: Date

  @Prop({ default: false })
  oneClickPostEnabled: boolean

  @Prop()
  materialGroupId?: string

  @Prop({ required: true, enum: PromotionTaskStatus, default: PromotionTaskStatus.Draft, index: true })
  status: PromotionTaskStatus

  @Prop({ default: false })
  pinned: boolean

  @Prop({ default: null })
  aiScore?: number
}

export const PromotionTaskSchema = SchemaFactory.createForClass(PromotionTask)
```

- [ ] Create `project/aitoearn-backend/libs/channel-db/src/schemas/promotion-application.schema.ts`.

Code:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum PromotionApplicationStatus {
  Accepted = 'accepted',
  Submitted = 'submitted',
  Reviewing = 'reviewing',
  Approved = 'approved',
  Rejected = 'rejected',
  Settled = 'settled',
  Canceled = 'canceled',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'promotionApplication' })
export class PromotionApplication extends BaseTemp {
  id: string

  @Prop({ required: true, index: true })
  taskId: string

  @Prop({ required: true, index: true })
  creatorUserId: string

  @Prop({ required: true })
  accountId: string

  @Prop({ required: true })
  platform: string

  @Prop({ required: true, enum: PromotionApplicationStatus, default: PromotionApplicationStatus.Accepted })
  status: PromotionApplicationStatus

  @Prop({ default: '' })
  workLink: string

  @Prop()
  publishRecordId?: string

  @Prop({ type: Date })
  submittedAt?: Date

  @Prop({ type: Date })
  reviewedAt?: Date

  @Prop({ default: '' })
  reviewReason: string
}

export const PromotionApplicationSchema = SchemaFactory.createForClass(PromotionApplication)
```

- [ ] Create `project/aitoearn-backend/libs/channel-db/src/schemas/promotion-ledger.schema.ts`.

Code:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum PromotionLedgerStatus {
  Pending = 'pending',
  Available = 'available',
  Frozen = 'frozen',
  Refunded = 'refunded',
  Voided = 'voided',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'promotionLedger' })
export class PromotionLedger extends BaseTemp {
  id: string

  @Prop({ required: true, index: true })
  userId: string

  @Prop({ required: true })
  role: 'creator' | 'advertiser'

  @Prop({ required: true })
  taskId: string

  @Prop()
  applicationId?: string

  @Prop({ required: true })
  amount: number

  @Prop({ required: true })
  direction: 'credit' | 'debit'

  @Prop({ required: true, enum: PromotionLedgerStatus })
  status: PromotionLedgerStatus

  @Prop({ required: true })
  type: string
}

export const PromotionLedgerSchema = SchemaFactory.createForClass(PromotionLedger)
```

- [ ] Export and register all three schemas from `libs/channel-db/src/schemas/index.ts`.

Required registration:

```ts
import { PromotionApplication, PromotionApplicationSchema } from './promotion-application.schema'
import { PromotionLedger, PromotionLedgerSchema } from './promotion-ledger.schema'
import { PromotionTask, PromotionTaskSchema } from './promotion-task.schema'

export * from './promotion-application.schema'
export * from './promotion-ledger.schema'
export * from './promotion-task.schema'

export const schemas = [
  // existing schemas remain unchanged
  { name: PromotionTask.name, schema: PromotionTaskSchema },
  { name: PromotionApplication.name, schema: PromotionApplicationSchema },
  { name: PromotionLedger.name, schema: PromotionLedgerSchema },
] as const
```

- [ ] Create `promotion-task.repository.ts`, `promotion-application.repository.ts`, and `promotion-ledger.repository.ts`.

Required repository responsibilities:

```ts
// promotion-task.repository.ts
createTask(data: Partial<PromotionTask>): Promise<PromotionTask>
findVisibleTasks(filter: RootFilterQuery<PromotionTask>, page: number, pageSize: number): Promise<{ list: PromotionTask[], total: number }>
findTaskById(id: string): Promise<PromotionTask | null>
updateTask(id: string, data: Partial<PromotionTask>): Promise<PromotionTask | null>
incrementAcceptedCount(id: string, amount: number): Promise<PromotionTask | null>

// promotion-application.repository.ts
createApplication(data: Partial<PromotionApplication>): Promise<PromotionApplication>
findByTaskCreatorAndAccount(taskId: string, creatorUserId: string, accountId: string): Promise<PromotionApplication | null>
findApplicationById(id: string): Promise<PromotionApplication | null>
updateApplication(id: string, data: Partial<PromotionApplication>): Promise<PromotionApplication | null>
listCreatorApplications(creatorUserId: string, page: number, pageSize: number): Promise<{ list: PromotionApplication[], total: number }>

// promotion-ledger.repository.ts
createLedger(data: Partial<PromotionLedger>): Promise<PromotionLedger>
listLedger(userId: string, page: number, pageSize: number): Promise<{ list: PromotionLedger[], total: number }>
sumByUserAndStatus(userId: string, status: PromotionLedgerStatus): Promise<number>
```

- [ ] Export all three repositories from `libs/channel-db/src/repositories/index.ts`.
- [ ] Run backend type verification.

Run:

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected:

- Build reaches TypeScript compile for `aitoearn-server` without schema export errors.

## Task 3: Add Promotion Marketplace Service and APIs

- [ ] Write service tests for:
  - published task listing excludes draft/archived.
  - accepting a sold-out task fails.
  - accepting same task/account twice returns existing application.
  - CPM tasks expose `cpmRewardPerThousand` and use impression-based display fields.
  - approving a submission creates a creator ledger entry.

- [ ] Implement `promotion-marketplace.dto.ts` with Zod DTOs:
  - `ListPromotionTasksDto`
  - `CreatePromotionTaskDto`
  - `UpdatePromotionTaskDto`
  - `UpdatePromotionTaskStatusDto`
  - `AcceptPromotionTaskDto`
  - `SubmitPromotionApplicationDto`
  - `ReviewPromotionSubmissionDto`

- [ ] Implement `promotion-marketplace.service.ts`.

Required methods:

```ts
listTasks(userId: string, dto: ListPromotionTasksDto)
getTaskDetail(userId: string, taskId: string)
createAdvertiserTask(userId: string, dto: CreatePromotionTaskDto)
updateAdvertiserTask(userId: string, taskId: string, dto: UpdatePromotionTaskDto)
updateAdvertiserTaskStatus(userId: string, taskId: string, dto: UpdatePromotionTaskStatusDto)
acceptTask(userId: string, taskId: string, dto: AcceptPromotionTaskDto)
submitApplication(userId: string, applicationId: string, dto: SubmitPromotionApplicationDto)
reviewSubmission(userId: string, applicationId: string, dto: ReviewPromotionSubmissionDto)
getCreatorApplications(userId: string, query: PaginationDto)
getAdvertiserTasks(userId: string, query: PaginationDto)
getWalletBalance(userId: string)
getLedger(userId: string, query: PaginationDto)
```

- [ ] Implement controller routes under `/promotion`.
- [ ] Register module in `apps/aitoearn-server/src/app.module.ts`.
- [ ] Run focused tests.

Run:

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/promotion-marketplace/promotion-marketplace.service.spec.ts
```

Expected:

- All marketplace service tests pass.

## Task 4: Seed Local Demo Tasks

- [ ] Add a development-only seeding script:

Create:

`project/aitoearn-backend/scripts/seed-promotion-tasks.ts`

Seed at least these tasks:

- `Jimeng promotion task`
- `点赞收藏评论任务`
- `抖音任务推广`
- `小红书任务推广`
- `快手任务推广`

- [ ] Each seed should include fixed, CPM, CPE, interaction, sold-out, pinned, and one-click-post variants.
- [ ] Add a script entry in `project/aitoearn-backend/package.json` if this workspace already has script conventions for local seeds; otherwise document the direct `tsx` command in the script header.
- [ ] Verify API returns seeded cards.

Run:

```bash
curl -s 'http://127.0.0.1:7001/api/promotion/tasks?page=1&pageSize=12' | jq '.data.list[0]'
```

Expected:

- First item contains title, platform, settlementType, reward amount, participant count, and status fields.

## Task 5: Wire Frontend API Client

- [ ] Create `project/aitoearn-web/src/api/promotion.ts`.

Required exported functions:

```ts
export function apiListPromotionTasks(params: PromotionTaskListQuery)
export function apiGetPromotionTaskDetail(taskId: string)
export function apiAcceptPromotionTask(taskId: string, data: AcceptPromotionTaskRequest)
export function apiSubmitPromotionApplication(applicationId: string, data: SubmitPromotionApplicationRequest)
export function apiCreateAdvertiserPromotionTask(data: CreatePromotionTaskRequest)
export function apiUpdateAdvertiserPromotionTask(taskId: string, data: UpdatePromotionTaskRequest)
export function apiUpdateAdvertiserPromotionTaskStatus(taskId: string, data: UpdatePromotionTaskStatusRequest)
export function apiListAdvertiserPromotionTasks(params: PaginationQuery)
export function apiGetPromotionWalletBalance()
export function apiGetPromotionLedger(params: PaginationQuery)
```

- [ ] Define local TypeScript interfaces matching backend VOs.
- [ ] Run frontend type-check.

Run:

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected:

- Type-check passes before any page code is added.

## Task 6: Implement Role-Aware Home Routing

- [ ] Create `project/aitoearn-web/src/app/[lng]/HomeRoleRouter.tsx` as a client component that reads `useSearchParams()`.
- [ ] Modify `project/aitoearn-web/src/app/[lng]/page.tsx` to render `HomeRoleRouter` instead of reading server `searchParams` directly.
- [ ] Render task square for `role=creator` or missing role.
- [ ] Render advertiser task page for `role=advertiser`.
- [ ] Keep draft-box reachable through a new explicit route, for example `/[lng]/content` or `/[lng]/draft-box`.

Expected behavior:

- `/en?role=creator` renders `Gold Rush Square`.
- `/en?role=advertiser` renders advertiser task management.
- Existing draft-box plan pages are still reachable by explicit content route.

## Task 7: Restore Live Navigation

- [ ] Update `routerData.tsx` with live-equivalent groups:
  - `Gold Rush Square` -> `/task-square`
  - `Content Management` -> `/content`
  - `AI Check-in` -> `/brand-promotion` or final check-in route
  - `AI Publish` -> `/ai-social`
  - `XHS Data` -> `/xhs-data`
  - `Note Comment Search` -> `/note-comment-search`
  - `My Channels` -> `/accounts`
  - `Publish` -> `/accounts`
  - `Extension / Install` -> `/websit/plugin-guide` or the existing plugin modal trigger used by `LayoutSidebar/components/BottomSection/PluginEntry.tsx`
  - `Interact` -> interaction/comment route if available, otherwise note comment search for first pass.

- [ ] Update route translations in English and Chinese.
- [ ] Verify top/sidebar link hrefs include the language prefix.

Run:

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected:

- No route translation type errors.

## Task 8: Build Creator Task Square

- [ ] Implement `TaskSquarePage.tsx` with:
  - title `Gold Rush Square`
  - `RoleSwitch`
  - `TaskFilters`
  - task card grid/list
  - loading skeleton
  - empty state
  - error retry state.

- [ ] Implement `TaskCard.tsx` with live fields:
  - pinned
  - sold out
  - settlement type
  - one-click post
  - AI score
  - follower limit
  - accepted/quota count
  - reward and unit
  - CPM unit text such as `Per 1K Impressions`
  - CPE unit text such as `Per 1K Engagements`
  - `Accept Task`.

- [ ] Accept action:
  - If not logged in, open login modal.
  - If no account for the task platform, link to `My Channels`.
  - If eligible, call `apiAcceptPromotionTask`.

- [ ] Verify visually in Codex browser or Playwright screenshot.

Run:

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected:

- `/en?role=creator` renders cards when seeded data exists.

## Task 9: Build Task Detail and Submission Flow

- [ ] Implement `/[lng]/task/[taskId]/page.tsx`.
- [ ] Include task requirements, reward rules, creator account binding, and submission state.
- [ ] Submit form supports:
  - manual work link
  - publishRecordId from one-click publish if available.
- [ ] On submit, call `apiSubmitPromotionApplication`.
- [ ] Show review status and ledger hint.

Verification:

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected:

- Accepted task can be opened, submitted, and status updates without frontend runtime error.

## Task 10: Build Advertiser Task Management

- [ ] Implement `/[lng]/advertiser/tasks/page.tsx`.
- [ ] Add task list with statuses: draft, published, paused, sold out, ended.
- [ ] Add create/edit modal for:
  - platform
  - title
  - description
  - tags
  - settlement type
  - reward/cap, including `cpmRewardPerThousand` for CPM and `cpeRewardPerThousand` for CPE
  - follower limit
  - quota
  - date range
  - one-click-post toggle
  - materialGroupId.

- [ ] Create calls `apiCreateAdvertiserPromotionTask`.
- [ ] Edit calls `apiUpdateAdvertiserPromotionTask`.
- [ ] Publish/pause/archive/end actions call `apiUpdateAdvertiserPromotionTaskStatus`.
- [ ] After creation, new task appears in creator marketplace if status is published.

Verification:

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected:

- `/en?role=advertiser` no longer shows creator marketplace content by default.

## Task 11: Build Gold Page

- [ ] Implement `/[lng]/gold/page.tsx`.
- [ ] Display:
  - creator pending amount
  - creator available amount
  - advertiser frozen budget
  - advertiser remaining balance
  - ledger table.

- [ ] Add empty state for no ledger rows.
- [ ] Keep withdrawal/payment buttons disabled or hidden in first pass.

Verification:

```bash
curl -s 'http://127.0.0.1:7001/api/promotion/wallet/balance' | jq
cd project/aitoearn-web && pnpm run type-check
```

Expected:

- API returns numeric balances and frontend renders them.

## Task 12: Build XHS Data and Note Comment Search Pages

- [ ] Implement `/[lng]/xhs-data/page.tsx`.
- [ ] Use existing `xhsInteraction` functions for note details/comments when possible.
- [ ] If bridge/plugin is unavailable, render guidance from `getXhsCaptureSetupMessage`.

- [ ] Implement `/[lng]/note-comment-search/page.tsx`.
- [ ] Inputs:
  - note URL or note ID
  - optional keyword
  - optional comment pagination.
- [ ] Results:
  - note metadata
  - comments
  - reply count
  - copy/export action for local use.

Verification:

```bash
cd project/aitoearn-web
pnpm run type-check
```

Expected:

- Without plugin/bridge, both pages show clear setup guidance instead of generic network error.

## Task 13: Metrics and Audit Hooks

- [ ] Emit existing metric names from the new flows:
  - `task_square_page_view`
  - `task_detail_view`
  - `task_accept`
  - `task_submit`
  - `task_approved`

- [ ] Store application status transitions in backend logs or a simple transition array if needed for support.

Verification:

```bash
rg -n "task_square_page_view|task_detail_view|task_accept|task_submit|task_approved" project/aitoearn-web/src project/aitoearn-backend/apps/aitoearn-server/src
```

Expected:

- New flows reference the metric constants or metric helper rather than hard-coded unrelated names.

## Task 14: End-to-End Local Smoke Test

- [ ] Start local services with the current non-Docker workflow.
- [ ] Seed demo tasks.
- [ ] Open `/en?role=creator`.
- [ ] Confirm marketplace first viewport.
- [ ] Accept one task.
- [ ] Submit a work link.
- [ ] Approve submission through backend test helper or direct API.
- [ ] Open `/gold`.
- [ ] Confirm ledger entry and balance update.
- [ ] Open `/xhs-data`.
- [ ] Confirm bridge setup guidance appears if no plugin is configured.

Verification commands:

```bash
cd project/aitoearn-web
pnpm run type-check

cd ../aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/promotion-marketplace/promotion-marketplace.service.spec.ts
pnpm nx run aitoearn-server:build
```

Expected:

- Type-check passes.
- Backend tests pass.
- Build passes.
- Browser smoke matches the live first-viewport functional shape.

## Task 15: Documentation Update

- [ ] Update `README.md`, `README_EN.md`, and `README_JA.md` only after the feature works locally.
- [ ] Mention:
  - creator marketplace
  - advertiser task publishing
  - gold ledger
  - XHS data/plugin requirement.

Verification:

```bash
git diff --check
```

Expected:

- No whitespace errors.

## Execution Recommendation

Use a staged implementation:

1. Backend models and marketplace API.
2. Seed data and API smoke.
3. Frontend routing/navigation.
4. Creator marketplace.
5. Advertiser task management.
6. Gold ledger.
7. XHS data/comment search.
8. Visual parity pass.

This order creates a working vertical slice early and avoids building UI against an unstable API contract.
