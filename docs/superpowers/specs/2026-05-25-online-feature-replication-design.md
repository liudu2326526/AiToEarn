# Online Feature Replication Design

## Goal

Bring the local open-source `AitoBee` web/backend stack as close as practical to the current production behavior of `https://aitoearn.cn/en?role=creator`, with priority on feature parity and runtime behavior rather than merely matching copy.

This document is based on the live page inspected on 2026-05-25. The live site rendered `Gold Rush Square` as the default creator-facing page, while the local page at `http://127.0.0.1:6061/en?role=creator` rendered the draft-box content management page.

## Parity Scope

### Must Replicate

1. Role-aware entry behavior
   - `role=creator` opens the creator task marketplace.
   - `role=advertiser` opens the advertiser task publishing view.
   - No role query defaults to the live behavior: marketplace first, not draft box.

2. Navigation shape
   - Desktop/mobile primary groups: `Content`, `Check-in`, `Gold`, `Publish`, `Interact`.
   - Sidebar/application routes: `Gold Rush Square`, `Content Management`, `AI Check-in`, `AI Publish`, `XHS Data`, `Note Comment Search`, `My Channels`, `Extension`.
   - Keep the local `AitoBee` logo/name unless the product decision is to restore `AiToEarn`.

3. Creator marketplace
   - Role switch: `Creator / Accept tasks`, `Advertiser / Publish tasks`.
   - Task filters: platform, tags, sort, advanced filters, date range, keyword search.
   - Task cards: platform, task type, pinned/sold-out badges, AI score, follower limit, participant count, cap amount, reward amount, settlement unit, one-click-post indicator, `Accept Task`.
   - Task detail page with task requirements, reward rules, accepted accounts, submission requirements, and activity/metric tracking.

4. Advertiser task publishing
   - Create tasks for fixed-price, CPM, CPE, and interaction tasks.
   - Configure platforms, target accounts/follower limits, budget/cap, reward rules, tags, date range, task copy, media/material requirements, and one-click-post draft binding.
   - Advertiser task list and task status management.

5. Creator task workflow
   - Accept task.
   - Bind creator channel/account.
   - Submit post/work link or one-click publish result.
   - Track review/settlement status.
   - Display sold-out and capacity limits consistently.

6. Gold/balance workflow
   - Creator balance and advertiser balance.
   - Ledger entries for task acceptance, submission, approval, settlement, refund, and failed review.
   - Gold page showing balances, pending settlement, available amount, and history.

7. XHS Data and Note Comment Search
   - Restore visible entry points.
   - XHS data page should use the existing plugin/bridge path for note detail, comments, and account status.
   - Note comment search should guide users to configure the plugin/bridge when local capture is unavailable.

8. Metrics and auditability
   - Track `task_square_page_view`, `task_detail_view`, `task_accept`, `task_submit`, and `task_approved`.
   - Store creator/ad task state transitions with enough data for review and support.

### Out of Scope for First Parity Pass

- Real payment withdrawal, invoicing, tax, and external payment provider integration.
- Administrative moderation console beyond the minimum review API/state required to unblock creator/advertiser flows.
- Exact production private recommendation/ranking algorithm. The local version can start with deterministic sort rules while preserving API shape.

## Current Local State

### Frontend

- `/[lng]` always renders `DraftBoxCore`, so `role=creator` is ignored.
- Visible routes are defined in `project/aitoearn-web/src/app/layout/routerData.tsx` and currently include only content management, AI publish, task history, publish, and agent assets.
- `project/aitoearn-web/src/app/[lng]/brand-promotion` contains plan/material stores and tab UI, but does not have a page route connected to the visible app.
- XHS plugin code exists under `project/aitoearn-web/src/store/plugin/plats/xhs`, including local bridge guidance, but there is no visible XHS data page route.
- Local brand metadata is already `AitoBee` in `BrandWordmark` and `utils/general.ts`.

### Backend

- Existing reusable pieces:
  - Publishing records and platform publishing providers under `apps/aitoearn-server/src/core/channel/publishing`.
  - Channel accounts and platform OAuth under `apps/aitoearn-server/src/core/channel/platforms`.
  - Engagement/comment APIs under `apps/aitoearn-server/src/core/channel/engagement`.
  - Interaction records under `apps/aitoearn-server/src/core/channel/interact`.
  - XHS data-cube service under `apps/aitoearn-server/src/core/channel/data-cube/xhs-data.service.ts`.
  - Metric constants already include task marketplace events in `libs/helpers/src/metric-event/metric-event.constants.ts`.
- Missing or incomplete pieces:
  - Marketplace task domain model.
  - Creator task acceptance/submission lifecycle.
  - Advertiser task creation lifecycle.
  - Settlement ledger and balance API.
  - Public/private task detail APIs.
  - Frontend marketplace pages.

## Recommended Architecture

### Backend Module: Promotion Marketplace

Create a new server module under:

`project/aitoearn-backend/apps/aitoearn-server/src/core/promotion-marketplace`

Responsibilities:

- Task catalog and detail APIs.
- Advertiser task creation/update/publish.
- Creator task acceptance and submission.
- Capacity/follower/platform eligibility checks.
- Settlement state transitions.
- Metric event emission.

Suggested files:

- `promotion-marketplace.module.ts`
- `promotion-marketplace.controller.ts`
- `promotion-marketplace.service.ts`
- `promotion-marketplace.dto.ts`
- `promotion-marketplace.vo.ts`
- `promotion-marketplace.constants.ts`
- `promotion-marketplace.service.spec.ts`

### Database Models

Add schemas/repositories in `project/aitoearn-backend/libs/channel-db/src`:

- `promotion-task.schema.ts`
  - advertiserUserId
  - title
  - description
  - platform
  - tags
  - settlementType: `fixed` | `cpm` | `cpe` | `interaction`
  - rewardAmount
  - cpmRewardPerThousand
  - cpeRewardPerThousand
  - capAmount
  - followerLimit
  - quotaTotal
  - quotaAccepted
  - startsAt / endsAt
  - oneClickPostEnabled
  - materialGroupId
  - status: `draft` | `published` | `paused` | `sold_out` | `ended` | `archived`
  - pinned
  - aiScore

- `promotion-application.schema.ts`
  - taskId
  - creatorUserId
  - accountId
  - platform
  - status: `accepted` | `submitted` | `reviewing` | `approved` | `rejected` | `settled` | `canceled`
  - workLink
  - publishRecordId
  - submittedAt
  - reviewedAt
  - reviewReason

- `promotion-ledger.schema.ts`
  - userId
  - role: `creator` | `advertiser`
  - taskId
  - applicationId
  - amount
  - direction: `credit` | `debit`
  - status: `pending` | `available` | `frozen` | `refunded` | `voided`
  - type: `budget_freeze` | `task_reward` | `settlement` | `refund` | `review_failed`

### API Contract

Use `/api/promotion` as the frontend-facing namespace.

Creator APIs:

- `GET /api/promotion/tasks`
  - Query: platform, tag, sort, keyword, dateRange, settlementType, page, pageSize.
  - Returns task cards matching the live marketplace card shape.

- `GET /api/promotion/tasks/:id`
  - Returns task detail, reward rules, capacity, requirements, and current user application status.

- `POST /api/promotion/tasks/:id/accept`
  - Body: accountId.
  - Creates or returns the creator application.

- `POST /api/promotion/applications/:id/submit`
  - Body: workLink, publishRecordId, evidence.
  - Moves application to review.

- `GET /api/promotion/creator/applications`
  - Creator task history and status list.

Advertiser APIs:

- `POST /api/promotion/advertiser/tasks`
  - Creates draft/published task.

- `PATCH /api/promotion/advertiser/tasks/:id`
  - Updates draft/paused task.

- `POST /api/promotion/advertiser/tasks/:id/status`
  - Body: status.
  - Publishes, pauses, resumes, archives, or manually ends an advertiser task.

- `GET /api/promotion/advertiser/tasks`
  - Advertiser task management list.

- `POST /api/promotion/advertiser/submissions/:id/review`
  - Approves/rejects creator submission.

Gold/balance APIs:

- `GET /api/promotion/wallet/balance`
- `GET /api/promotion/wallet/ledger`

### Frontend Routes

Add or restore these routes:

- `project/aitoearn-web/src/app/[lng]/task-square/page.tsx`
  - Main `Gold Rush Square`.

- `project/aitoearn-web/src/app/[lng]/task/[taskId]/page.tsx`
  - Task detail and accept/submit entry.

- `project/aitoearn-web/src/app/[lng]/advertiser/tasks/page.tsx`
  - Advertiser task list and create-task entry.

- `project/aitoearn-web/src/app/[lng]/gold/page.tsx`
  - Balance and ledger.

- `project/aitoearn-web/src/app/[lng]/xhs-data/page.tsx`
  - XHS account/note/comment data.

- `project/aitoearn-web/src/app/[lng]/note-comment-search/page.tsx`
  - Search and comment capture workflow.

- `project/aitoearn-web/src/app/[lng]/accounts/page.tsx`
  - Existing `My Channels` route. Keep the live `My Channels` label mapped to this route.

- `project/aitoearn-web/src/app/[lng]/websit/plugin-guide/page.tsx`
  - Existing extension install guide. Keep the live `Extension / Install` entry mapped to this route or to the existing plugin modal trigger.

Update:

- `project/aitoearn-web/src/app/[lng]/page.tsx`
  - Prefer a client `HomeRoleRouter` using `useSearchParams()` so the server page can stay static if desired.
  - Route creator/default to task square.
  - Route advertiser to advertiser tasks.
  - If implementation intentionally reads `searchParams` in the server page, document that this opts the route into dynamic rendering.
  - Keep content management reachable at `/content` or `/draft-box` depending on final naming.

- `project/aitoearn-web/src/app/layout/routerData.tsx`
  - Restore live navigation entries.

### Frontend State and API Clients

Create:

- `project/aitoearn-web/src/api/promotion.ts`
- `project/aitoearn-web/src/app/[lng]/HomeRoleRouter.tsx`
- `project/aitoearn-web/src/app/[lng]/task-square/taskSquareStore.ts`
- `project/aitoearn-web/src/app/[lng]/task/[taskId]/taskDetailStore.ts`
- `project/aitoearn-web/src/app/[lng]/advertiser/tasks/advertiserTaskStore.ts`
- `project/aitoearn-web/src/app/[lng]/gold/goldStore.ts`

Reuse:

- `project/aitoearn-web/src/store/plugin/plats/xhs`
- `project/aitoearn-web/src/components/ChannelManager`
- `project/aitoearn-web/src/components/PublishDialog`
- `project/aitoearn-web/src/utils/settlement.ts`

### UI Parity Rules

- Match live information architecture first, then adapt the color system to local AitoBee blue theme.
- Cards should preserve live fields and hierarchy:
  - title
  - task type
  - one-click post badge
  - AI score
  - follower limit
  - participant count
  - reward amount/unit
  - CPM unit text for impression-based tasks
  - CPE unit text for engagement-based tasks
  - sold-out state
  - primary action.
- Empty/loading/error states must be complete because local dev often lacks real production data.
- If plugin/bridge is not configured, XHS pages must show a setup guide instead of a generic network error.

## Data Flow

1. User opens `/en?role=creator`.
2. Frontend resolves role and renders task square.
3. Task square requests `/api/promotion/tasks`.
4. User accepts a task with a connected channel account.
5. Backend checks task status, quota, account platform, follower threshold, and duplicate acceptance.
6. Backend creates `PromotionApplication`, increments accepted count, emits `task_accept`.
7. User publishes or submits a work link.
8. Backend stores submission and emits `task_submit`.
9. Advertiser/admin reviews.
10. Backend updates application, creates ledger entries, emits `task_approved`.
11. Gold page reads balance/ledger.

## Testing Strategy

Backend:

- Unit tests for:
  - task filtering
  - capacity checks
  - accept idempotency
  - duplicate submit prevention
  - ledger transitions
- Integration tests for controller/service happy path:
  - create advertiser task
  - list marketplace
  - accept as creator
  - submit work
  - approve submission

Frontend:

- Type-check with `pnpm run type-check`.
- Playwright flows:
  - `/en?role=creator` renders task square.
  - `/en?role=advertiser` renders advertiser task page.
  - task card accept button opens account selection/login guidance.
  - XHS data page shows plugin setup guidance when bridge is unavailable.

Manual parity checks:

- Compare screenshots against live:
  - marketplace first viewport
  - advanced filters
  - task detail
  - advertiser create task
  - gold balance page
  - XHS data guide state.

## Risks

- Production may use private APIs not included in the open-source repo. If so, replicate behavior with new local APIs rather than trying to depend on unavailable production services.
- Settlement is money-like state. Do not ship real withdrawal/payment until ledger invariants and review permissions are tested.
- XHS capture depends on browser/plugin state. The local version must degrade to setup guidance, not silent failure.
- Matching live copy exactly may conflict with the local rebrand to `AitoBee`. Treat naming as a product decision.

## Acceptance Criteria

- `http://127.0.0.1:6061/en?role=creator` no longer shows draft-box by default; it shows a task marketplace equivalent to live `Gold Rush Square`.
- `http://127.0.0.1:6061/en?role=advertiser` shows advertiser task creation/management.
- Navigation exposes the same major functional entries as the live site.
- Marketplace tasks can be seeded locally, listed, accepted, submitted, reviewed, and reflected in the ledger.
- XHS data and note comment search are reachable from the UI and show actionable plugin setup guidance when capture is unavailable.
- Frontend `pnpm run type-check` passes.
- Backend targeted tests for the new marketplace module pass through `pnpm nx run aitoearn-server:build` plus focused `vitest` commands.
