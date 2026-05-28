# Admin Management Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal administrator page for operating users, credits, promotion tasks, AI generation logs, and runtime configuration without exposing it to ordinary users.

**Architecture:** Add an admin-only backend module under `aitoearn-server` and a protected frontend route under `aitoearn-web`. The backend owns all permission checks and write operations; the frontend is only an authenticated operator UI that calls `/admin/*` APIs through the existing API proxy.

**Tech Stack:** NestJS, Nx, pnpm, Mongoose, MongoDB, Redis, Next.js App Router, React, Zustand, existing fetch/toast/i18n helpers, lucide-react icons.

**Local Ports:** Follow `AGENTS.md`: frontend `6061`, local API proxy `7001`, server `3002`, and AI service `3010`. Frontend admin APIs should call the local API proxy instead of hard-coding `3002`.

---

## Confirmed Scope

This page is an operations console, not a public SaaS billing portal.

In scope:

- Admin login reuse through the existing email-password login.
- Admin-only route: `/[lng]/admin`.
- User list, search, detail drawer, status controls, and manual credit adjustment.
- Credit operation audit trail.
- Promotion task overview and status management.
- AI generation log overview for troubleshooting failed or expensive generations.
- Read-only environment/config health checks for key local dependencies.

Out of scope for this pass:

- User-facing recharge/payment.
- Payment provider integration.
- Multi-admin role hierarchy beyond a simple admin allowlist.
- Full platform OAuth setup UI.
- Editing third-party secrets from the browser.

## Product Requirements

### Admin Access

- Ordinary users must not see or enter the admin page.
- Admin identity should be controlled by server-side config first, for example:
  - `ADMIN_EMAILS=admin@aitoearn.local,owner@example.com`
  - optional future DB role field can be added later.
- Every `/admin/*` API must verify:
  - valid token from `@GetToken()`;
  - user exists and is not deleted;
  - user email is in the admin allowlist.
- Frontend route hiding is only convenience; backend authorization is mandatory.

### Dashboard

The first screen should be a dense operational dashboard:

- Total active users.
- New users today / this week.
- Total available credits.
- Credits consumed today.
- Failed AI jobs today.
- Pending promotion task applications.
- Dependency status cards:
  - MongoDB reachable.
  - Redis reachable.
  - Server process reachable.
  - AI service reachable if `3010` is running.

### User Management

User table columns:

- User ID.
- Name.
- Email.
- Status.
- Credits balance.
- Created time.
- Last credit operation summary.

Filters:

- Keyword: ID, name, email, phone.
- Status.
- Created time range.
- Credits range.

Actions:

- View user detail.
- Disable / enable user.
- Soft delete user.
- Manually add credits.
- Manually deduct credits.

Credit adjustment rules:

- Amount must be a positive integer.
- Deduction cannot make balance negative.
- Operator must provide a reason.
- Backend writes both `creditsBalance` and nested `credits.balance`.
- Backend records an immutable ledger row for audit.
- If the project does not yet have a generic credits ledger collection, create one instead of relying only on `credits.lastOperation`.

### Promotion Management

Admin should be able to inspect and operate the promotion marketplace created in `promotion-marketplace`:

- List promotion tasks.
- Filter by status, settlement type, advertiser, and date.
- View applications under a task.
- Approve or reject applications when needed.
- Update task status.
- Inspect generated ledger rows.

The page should reuse the current promotion schemas:

- `promotion-task.schema.ts`
- `promotion-application.schema.ts`
- `promotion-ledger.schema.ts`

### AI Logs

Admin should be able to inspect AI calls without exposing secrets:

- List `AiLog` rows by user, status, type, model, provider/channel, and date.
- Show prompt/result metadata only when already stored and safe to display.
- Never display third-party API keys.
- Provide quick links to related user and asset IDs when available.

### Config Health

The admin page should show configuration presence, not secret values:

- LLM base URL configured: yes/no.
- LLM API key configured: yes/no.
- Volcengine key configured: yes/no.
- OBS/MinIO storage configured: yes/no.
- Mail transport configured: yes/no.
- XHS bridge reachable: yes/no.

Secret fields must be masked and never returned to frontend.

## Backend File Structure

Create:

- `project/aitoearn-backend/apps/aitoearn-server/src/core/admin/admin.module.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/admin/admin.controller.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/admin/admin.service.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/admin/admin.dto.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/admin/admin.vo.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/admin/admin.guard.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/admin/admin.controller.spec.ts`
- `project/aitoearn-backend/libs/mongodb/src/schemas/credits-ledger.schema.ts`
- `project/aitoearn-backend/libs/mongodb/src/repositories/credits-ledger.repository.ts`

Modify:

- `project/aitoearn-backend/apps/aitoearn-server/src/app.module.ts`
- `project/aitoearn-backend/libs/mongodb/src/schemas/index.ts`
- `project/aitoearn-backend/libs/mongodb/src/repositories/index.ts`
- `project/aitoearn-backend/libs/mongodb/src/repositories/user.repository.ts`
- `project/aitoearn-backend/libs/helpers/src/credits/credits-helper.service.ts`

## Backend API Contract

All routes are under `/admin`.

### `GET /admin/summary`

Returns dashboard metrics:

```ts
interface AdminSummaryVO {
  users: {
    activeTotal: number
    newToday: number
    newThisWeek: number
  }
  credits: {
    totalBalance: number
    consumedToday: number
  }
  ai: {
    failedToday: number
    totalToday: number
  }
  promotion: {
    pendingApplications: number
    activeTasks: number
  }
  health: {
    mongodb: 'ok' | 'error'
    redis: 'ok' | 'error'
    server: 'ok'
    aiService: 'ok' | 'error' | 'not_configured'
  }
}
```

### `GET /admin/users`

Query:

```ts
interface AdminListUsersQuery {
  pageNo: number
  pageSize: number
  keyword?: string
  status?: string
  createdAt?: string[]
  minCredits?: number
  maxCredits?: number
}
```

Returns paginated users with credits.

### `GET /admin/users/:id`

Returns user detail:

- public user fields;
- credits;
- latest credit ledger rows;
- account count;
- recent AI log count;
- recent promotion applications.

### `PATCH /admin/users/:id/status`

Body:

```ts
interface AdminUpdateUserStatusDto {
  status: 'OPEN' | 'CLOSE'
  reason: string
}
```

### `POST /admin/users/:id/credits`

Body:

```ts
interface AdminAdjustCreditsDto {
  type: 'add' | 'deduct'
  amount: number
  reason: string
}
```

Rules:

- `amount > 0`.
- `reason` length between 3 and 200.
- deduct path must use the same atomic balance guard as `deductCreditsById`.
- write a ledger row with `operatorUserId`, `targetUserId`, `type`, `amount`, `balanceAfter`, and `reason`.

### `GET /admin/credits/ledger`

Query by user, operator, type, and date range.

### `GET /admin/ai/logs`

List `AiLog` rows for operational troubleshooting.

### `GET /admin/promotion/tasks`

List promotion tasks with application and ledger counts.

### `PATCH /admin/promotion/tasks/:id/status`

Admin override for task status with reason.

## Frontend File Structure

Create:

- `project/aitoearn-web/src/app/[lng]/admin/page.tsx`
- `project/aitoearn-web/src/app/[lng]/admin/AdminPageContent.tsx`
- `project/aitoearn-web/src/app/[lng]/admin/components/AdminSummaryCards.tsx`
- `project/aitoearn-web/src/app/[lng]/admin/components/AdminUsersTable.tsx`
- `project/aitoearn-web/src/app/[lng]/admin/components/AdminUserDetailDrawer.tsx`
- `project/aitoearn-web/src/app/[lng]/admin/components/AdminCreditAdjustDialog.tsx`
- `project/aitoearn-web/src/app/[lng]/admin/components/AdminPromotionTasksTable.tsx`
- `project/aitoearn-web/src/app/[lng]/admin/components/AdminAiLogsTable.tsx`
- `project/aitoearn-web/src/api/admin.ts`
- `project/aitoearn-web/src/api/types/admin.ts`

Modify:

- `project/aitoearn-web/src/app/layout/routerData.tsx`
- `project/aitoearn-web/src/store/user.ts`
- `project/aitoearn-web/src/app/i18n/locales/zh-CN/route.json`
- `project/aitoearn-web/src/app/i18n/locales/en/route.json`
- `project/aitoearn-web/src/app/i18n/locales/zh-CN/common.json`
- `project/aitoearn-web/src/app/i18n/locales/en/common.json`

## Frontend UX

Route:

- `/zh-CN/admin`
- `/en/admin`

Navigation:

- Only show the admin nav item when current user is admin.
- If the frontend does not yet know admin status, hide the item until `/user/mine` or `/admin/summary` confirms.

Layout:

- Use the existing sidebar shell.
- Keep a compact SaaS operations style.
- Use tables, filters, drawers, dialogs, badges, and status cards.
- Do not use a marketing-style landing page.

Recommended tabs:

- Overview.
- Users.
- Credits.
- Promotion.
- AI Logs.
- Config Health.

User safety:

- Dangerous actions require confirmation dialog.
- Credit changes require reason input.
- Show before/after balance in the confirmation.
- Display success/failure toast.

## Implementation Tasks

### Task 1: Add Admin Authorization

- [ ] Add `ADMIN_EMAILS` reading in backend config.
- [ ] Create `AdminGuard`.
- [ ] Add tests:
  - non-authenticated request rejected;
  - authenticated non-admin rejected;
  - configured admin email allowed.

### Task 2: Add Credits Ledger

- [ ] Add `CreditsLedger` schema.
- [ ] Add repository.
- [ ] Register schema and repository exports.
- [ ] Update `CreditsHelperService` or admin service to write ledger rows for admin adjustments.
- [ ] Add tests for add/deduct ledger writes.

### Task 3: Add Admin User APIs

- [ ] Implement user list with filters.
- [ ] Implement user detail.
- [ ] Implement status update.
- [ ] Implement credit adjustment.
- [ ] Test duplicate, missing user, insufficient balance, invalid reason, and successful adjustment.

### Task 4: Add Admin Summary APIs

- [ ] Implement dashboard metrics from existing repositories.
- [ ] Add config health checks that return booleans/status only.
- [ ] Test that secret values are never returned.

### Task 5: Add Admin Promotion APIs

- [ ] Reuse promotion repositories.
- [ ] Add task list and status override endpoints.
- [ ] Write tests for status transition and audit reason.

### Task 6: Add Admin AI Log APIs

- [ ] Reuse `AiLogRepository`.
- [ ] Add filters and pagination.
- [ ] Mask or omit sensitive fields.
- [ ] Test pagination and masking.

### Task 7: Add Frontend Admin API Client

- [ ] Add `src/api/types/admin.ts`.
- [ ] Add `src/api/admin.ts`.
- [ ] Use existing request helpers and auth token behavior.

### Task 8: Add Admin Page

- [ ] Create `/[lng]/admin`.
- [ ] Add summary cards.
- [ ] Add user table and user detail drawer.
- [ ] Add credit adjustment dialog.
- [ ] Add promotion and AI log tables.
- [ ] Add config health panel.

### Task 9: Add Navigation and i18n

- [ ] Add route text in Chinese and English.
- [ ] Add admin nav item hidden behind admin check.
- [ ] Verify ordinary users cannot see the nav item and cannot load admin APIs.

### Task 10: Verification

Run backend checks:

```bash
cd project/aitoearn-backend
pnpm exec vitest run apps/aitoearn-server/src/core/admin/admin.controller.spec.ts
pnpm exec nx build aitoearn-server
```

Run frontend checks:

```bash
cd project/aitoearn-web
pnpm run type-check
pnpm build
```

Run browser smoke tests against `http://127.0.0.1:6061`:

- Login as non-admin, confirm `/zh-CN/admin` blocks access.
- Login as admin, confirm admin nav appears.
- Open admin dashboard.
- Search users.
- Open a user detail drawer.
- Add a small number of credits with reason.
- Confirm user balance changes.
- Confirm ledger row appears.
- Try deducting more than balance and confirm a friendly error.
- Open promotion and AI logs tabs.

## Risks and Mitigations

- **Risk:** Ordinary users discover admin route.
  - **Mitigation:** Backend guard is mandatory on every `/admin/*` endpoint.

- **Risk:** Credit adjustment corrupts balance.
  - **Mitigation:** Use repository atomic increment/deduct methods and immutable ledger rows.

- **Risk:** Secrets leak through config health.
  - **Mitigation:** Return only configured/missing status, never raw env values.

- **Risk:** Admin page grows too broad.
  - **Mitigation:** First version focuses on user operations, credits, promotion, AI logs, and health only.

- **Risk:** Existing user schema has no explicit role.
  - **Mitigation:** Use `ADMIN_EMAILS` allowlist now; add DB role only after admin operations stabilize.

## Open Decisions Before Implementation

1. Which email(s) should be configured as initial admins?
2. Should admin credit adjustments support both add and deduct in the first version, or only add?
3. Should the admin page be visible in the main sidebar or only accessible by direct URL for now?

