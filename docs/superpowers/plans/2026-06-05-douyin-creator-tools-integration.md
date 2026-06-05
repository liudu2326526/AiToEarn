# Douyin Creator Tools Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate `wenyg/douyin-creator-tools` as a local Playwright CLI executor for Douyin Creator Center comment and DM import/reply flows in AitoEarn.

**Architecture:** Keep `douyin-creator-tools` as an external local tool and call its CLI from the AitoEarn Nest backend through explicit services and BullMQ jobs. Persist imported comments/DMs into the existing acquisition lead model, and execute replies through the existing reply-task pipeline with a Douyin adapter. Default all send operations to dry-run and require human confirmation before real sending.

**Tech Stack:** NestJS, Nx, Mongoose, BullMQ, Node child process, Zod DTOs, Next.js App Router, Ant Design, `douyin-creator-tools` Playwright CLI.

---

## Scope

### In Scope

- Configure a local `douyin-creator-tools` path and Playwright profile path.
- Add a backend CLI wrapper that can run:
  - `npm run comments:export`
  - `npm run comments:reply -- --dry-run <plan.json>`
  - `npm run comments:reply -- <plan.json>`
  - `npm run dm:export`
  - `npm run dm:reply -- --dry-run <plan.json>`
  - `npm run dm:reply -- <plan.json>`
- Import Douyin Creator Center comment export results into existing comment snapshots and leads.
- Import Douyin DM conversations into leads with `sourceType = private_message`.
- Add a Douyin reply adapter for comment and DM reply execution.
- Add backend APIs for status, import, dry-run task creation, and confirmed send task creation. Reply execution must still go through `LeadReplyTask -> ReplyTaskExecutorService -> PlatformReplyAdapter`; controllers must not bypass the task table and call the CLI directly for replies.
- Add frontend actions on the Leads page.
- Keep safety defaults: dry-run first, batch limits, visible browser, no captcha bypass.

### Out of Scope

- Video Account Assistant implementation.
- Rewriting Playwright logic into the browser extension.
- Fully unattended DM sending.
- Official Douyin Open Platform IM callback integration.
- Deploying this automation to cloud production servers.

---

## File Map

### Backend New Files

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-automation.module.ts`
  Registers the automation controller and services.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-automation.controller.ts`
  Exposes status/import/reply endpoints for the web app.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-automation.dto.ts`
  Zod DTOs for import and reply requests.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-cli.service.ts`
  Runs the external CLI, writes plan files, reads output JSON, handles timeout and exit codes.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-automation.service.ts`
  Converts CLI results into AitoEarn domain models and orchestrates reply dry-run/send.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/platform-reply-adapters/douyin-creator-reply.adapter.ts`
  Implements `PlatformReplyAdapter` by calling `DouyinCreatorAutomationService`.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/*.spec.ts`
  Unit tests for CLI wrapper and service conversion behavior.

### Backend Modified Files

- `project/aitoearn-backend/apps/aitoearn-server/src/config.ts`
  Add config fields for tool directory, profile directory, output directory, timeout, and default dry-run.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.constants.ts`
  Add `DouyinCreatorCenter` data source.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/platform-reply-adapters/index.ts`
  Extend adapter request with `targetType`, optional `targetIdentity`, and relaxed comment-specific fields.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/platform-reply-adapters/registry.ts`
  Register Douyin adapter for `platform === 'douyin'`.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-task-executor.service.ts`
  Remove XHS-only guard and pass target metadata into adapters.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-automation.service.ts`
  Allow Douyin public-comment tasks and Douyin private-message tasks with conservative validation.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/acquisition-leads.dto.ts`
  Add optional `sourceType` query filtering so public-comment and private-message leads can be separated.

- `project/aitoearn-backend/libs/channel-db/src/schemas/lead-reply-task.schema.ts`
  Add `DouyinCreatorCli` executor kind, add target fields for private-message tasks, and relax comment-only required fields.

- `project/aitoearn-backend/libs/channel-db/src/repositories/lead.repository.ts`
  Add a standards-compliant create/update helper for private-message leads.

- `project/aitoearn-backend/libs/channel-db/src/repositories/lead.repository.spec.ts`
  Cover DM lead upsert uniqueness.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-management.service.ts`
  Report Douyin Creator Center private-message capability.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-management.service.spec.ts`
  Cover capability status changes.

- `project/aitoearn-backend/apps/aitoearn-server/src/app.module.ts`
  Import the new module.

### Frontend Modified Files

- `project/aitoearn-web/src/api/leads.ts`
  Add APIs for Douyin Creator status/import/dry-run/send and expose `sourceType` on leads.

- `project/aitoearn-web/src/app/[lng]/leads/LeadsPage/index.tsx`
  Wire page actions and refresh flow.

- `project/aitoearn-web/src/app/[lng]/leads/components/PrivateMessageStatusPanel/index.tsx`
  Show Douyin Creator Center capability status.

- `project/aitoearn-web/src/app/[lng]/leads/components/LeadToolbar/index.tsx`
  Add import comments/import DMs buttons.

- `project/aitoearn-web/src/app/[lng]/leads/components/LeadDetailDrawer/index.tsx`
  Add dry-run and confirmed-send UX states.

- `project/aitoearn-web/src/app/i18n/locales/{en,zh,ja}/route.json`
  Add `leads.douyinCreator.*` user-facing strings in all supported locale files.

### Documentation Modified Files

- `README.md`
  Add a concise China-environment note for local Douyin Creator Center automation.

- `README_EN.md`
  Add the same capability note in English.

- `README_JA.md`
  Add the same capability note in Japanese.

---

## Task 1: Backend Config And CLI Wrapper

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/config.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-cli.service.ts`
- Test: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-cli.service.spec.ts`

- [ ] Step 1: Add tests for CLI command construction.

  Cover these cases:
  - Missing tool directory returns unavailable status.
  - `comments:reply` includes `--dry-run` when requested.
  - CLI timeout returns a typed failure.
  - Output JSON is parsed from the requested output path.

  Run:

  ```bash
  cd /Users/macbook/Documents/trae_projects/AiToEarn/project/aitoearn-backend
  pnpm nx run aitoearn-server:test -- apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-cli.service.spec.ts
  ```

  Expected: fail because the service does not exist yet.

- [ ] Step 2: Add config values.

  Add these config fields:

  ```ts
  const booleanFromEnv = (value: string | undefined, fallback: boolean) => {
    if (value === undefined || value === '') return fallback
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
  }

  douyinCreatorAutomation: {
    toolsDir: process.env.DOUYIN_CREATOR_TOOLS_DIR || '',
    profileDir: process.env.DOUYIN_CREATOR_PROFILE_DIR || '',
    outputDir: process.env.DOUYIN_CREATOR_OUTPUT_DIR || '/tmp/aitoearn-douyin-creator',
    timeoutMs: Number(process.env.DOUYIN_CREATOR_TIMEOUT_MS || 180000),
    defaultDryRun: booleanFromEnv(process.env.DOUYIN_CREATOR_DEFAULT_DRY_RUN, true),
  }
  ```

- [ ] Step 3: Implement `DouyinCreatorCliService`.

  Required public methods:

  ```ts
  getStatus(): Promise<{
    configured: boolean
    toolsDir: string
    profileDir: string
    outputDir: string
    message: string
  }>

  exportComments(input: { workTitle?: string; exportAll?: boolean; limit?: number }): Promise<Record<string, unknown>>
  replyComments(input: { plan: unknown; dryRun: boolean; limit?: number }): Promise<Record<string, unknown>>
  exportDms(input: { limit?: number }): Promise<Record<string, unknown>>
  replyDms(input: { plan: unknown; dryRun: boolean; limit?: number }): Promise<Record<string, unknown>>
  ```

  Implementation notes:
  - Use `node:child_process` `spawn`.
  - `cwd` must be `toolsDir`.
  - Create a per-run directory under `outputDir`.
  - Write plan JSON to that directory for reply methods.
  - Always pass `--out <absolute-result-path>`.
  - Kill the child process after `timeoutMs`.
  - Return parsed JSON plus CLI stdout/stderr summary.

- [ ] Step 4: Run the focused test and make it pass.

  ```bash
  cd /Users/macbook/Documents/trae_projects/AiToEarn/project/aitoearn-backend
  pnpm nx run aitoearn-server:test -- apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-cli.service.spec.ts
  ```

- [ ] Step 5: Commit this task if working on a clean feature branch.

  ```bash
  git add project/aitoearn-backend/apps/aitoearn-server/src/config.ts \
    project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-cli.service.ts \
    project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-cli.service.spec.ts
  git commit -m "feat: add douyin creator cli wrapper"
  ```

---

## Task 2: Module, DTOs, And Status API

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-automation.module.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-automation.controller.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-automation.dto.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/app.module.ts`

- [ ] Step 1: Add DTOs.

  Required schemas:

  ```ts
  export const DouyinCreatorImportCommentsSchema = z.object({
    workTitle: z.string().optional().describe('Creator Center work title filter; omit only when exportAll is true'),
    exportAll: z.boolean().default(false).describe('Whether to export all visible works instead of a single work'),
    limit: z.coerce.number().int().min(1).max(5000).default(500).describe('Maximum comments to import; import limit is separate from reply-send batch limit'),
  })

  export const DouyinCreatorImportDmsSchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50).describe('Maximum existing DM conversations to import'),
  })

  export const DouyinCreatorReplySchema = z.object({
    leadIds: z.array(z.string()).min(1).max(20).describe('Lead IDs to create reply tasks for'),
    dryRun: z.boolean().default(true).describe('Create review/dry-run tasks instead of confirmed send tasks'),
    limit: z.coerce.number().int().min(1).max(20).default(20).describe('Maximum reply tasks to create in this request'),
  })
  ```

  `limit.max(5000)` on imports is intentionally higher than send limits because importing only reads Creator Center data. Reply creation and confirmed sends stay capped at 20.

- [ ] Step 2: Add module and controller.

  Required endpoints:

  ```text
  GET  /acquisition/douyin-creator/status
  POST /acquisition/douyin-creator/comments/import
  POST /acquisition/douyin-creator/dms/import
  POST /acquisition/douyin-creator/comments/reply
  POST /acquisition/douyin-creator/dms/reply
  ```

  Controller requirements:
  - Add `@ApiTags('Acquisition/Douyin Creator')`.
  - Add `@ApiDoc` or the existing local Swagger helper on every endpoint.
  - Import `ApiDoc` from `@yikart/common` if that is the current controller pattern.
  - Reply endpoints must create or confirm `LeadReplyTask` records and enqueue them; they must not call `DouyinCreatorCliService.replyComments` or `replyDms` directly.

- [ ] Step 3: Import the module in `app.module.ts`.

- [ ] Step 4: Run TypeScript build.

  ```bash
  cd /Users/macbook/Documents/trae_projects/AiToEarn/project/aitoearn-backend
  pnpm nx run aitoearn-server:build
  ```

---

## Task 3: Comment Import Into Existing Acquisition Flow

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.constants.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-automation.service.ts`
- Test: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-automation.service.spec.ts`

- [ ] Step 1: Add data source.

  Add:

  ```ts
  DouyinCreatorCenter = 'douyin_creator_center'
  ```

  to `AcquisitionDataSource`.

- [ ] Step 2: Write tests for comment conversion.

  Input shape from `douyin-creator-tools` comment export:

  ```json
  {
    "selectedWork": { "title": "作品标题", "publishText": "06-01" },
    "comments": [
      {
        "username": "用户A",
        "commentText": "想了解",
        "publishText": "刚刚",
        "replyMessage": ""
      }
    ]
  }
  ```

  Assert the service creates normalized comments with:
  - `platform = douyin`
  - `dataSource = douyin_creator_center`
  - stable generated `commentId` when no platform comment id is available
  - `content = commentText`
  - `userName = username`

- [ ] Step 3: Implement import orchestration.

  `importComments(userId, dto, operatorId)` must:
  - Call `DouyinCreatorCliService.exportComments`.
  - Convert comments into comment snapshots.
  - Persist comment snapshots through existing repository methods.
  - Materialize leads through existing lead materialization logic, or directly upsert leads if the exported data does not map cleanly to `CommentSnapshot`.
  - Return `{ imported, materialized, resultPath, warnings }`.

- [ ] Step 4: Run focused tests.

  ```bash
  cd /Users/macbook/Documents/trae_projects/AiToEarn/project/aitoearn-backend
  pnpm nx run aitoearn-server:test -- apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-automation.service.spec.ts
  ```

---

## Task 4: DM Leads Import

**Files:**
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/lead.repository.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/repositories/lead.repository.spec.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-automation.service.ts`

- [ ] Step 1: Add repository test for DM upsert.

  Test behavior:
  - `sourceType = private_message`.
  - Same `userId/platform/accountId/userName` updates existing DM lead.
  - Latest message replaces `sourceContent`.
  - Stage defaults to `messaged`.
  - `listByUser` can filter `sourceType = public_comment` and `sourceType = private_message`.

- [ ] Step 2: Freeze the `dm:export` JSON contract in service tests.

  Use this input fixture:

  ```json
  {
    "fetchedAt": "2026-06-05T00:00:00.000Z",
    "mode": "dm_export",
    "pageUrl": "https://creator.douyin.com/creator-micro/data/following/chat",
    "count": 2,
    "conversations": [
      {
        "username": "睡不醒镁人",
        "lastMessage": "滴滴滴",
        "lastMessageTime": "刚刚",
        "unsupportedMessage": false,
        "replyMessage": ""
      },
      {
        "username": "AI剧阿涛",
        "lastMessage": "你收到一条新类型消息，请打开抖音app查看",
        "lastMessageTime": "05-27",
        "unsupportedMessage": true,
        "replyMessage": ""
      }
    ]
  }
  ```

  Expected conversion:
  - First conversation creates or updates a DM lead.
  - Second conversation is skipped with warning code `unsupported_dm_message`.

- [ ] Step 3: Add `createOrUpdateByPrivateMessage` to `LeadRepository`.

  Required input:

  ```ts
  {
    userId: string
    platform: string
    accountId: string
    userName: string
    userAvatar?: string
    sourceContent: string
    externalConversationId: string
    lastMessageTime?: string
  }
  ```

  Store DM identity conservatively:
  - `postId = 'private_message'`
  - `commentId = externalConversationId`
  - `sourceType = private_message`
  - `stage = messaged`
  - `status = in_progress`
  - Add an inline schema/repository comment explaining `postId = 'private_message'` is a pseudo post id used only to reuse the existing unique index for DM leads.

- [ ] Step 4: Implement `importDms`.

  It must:
  - Call `DouyinCreatorCliService.exportDms`.
  - Skip unsupported messages that only say “请打开抖音app查看”.
  - Create or update one lead per supported conversation.
  - Append `materialized` activity log for newly created leads.
  - Extend `LeadListQuerySchema` with `sourceType: z.enum(['public_comment', 'private_message', 'manual']).optional().describe('线索来源类型')`.
  - Ensure list/detail APIs return `sourceType` so DM leads do not masquerade as public comment leads.

- [ ] Step 5: Run repository and service tests.

  ```bash
  cd /Users/macbook/Documents/trae_projects/AiToEarn/project/aitoearn-backend
  pnpm nx run aitoearn-server:test -- libs/channel-db/src/repositories/lead.repository.spec.ts \
    apps/aitoearn-server/src/core/acquisition/douyin-creator-automation/douyin-creator-automation.service.spec.ts
  ```

---

## Task 5: Reply Task Target Metadata

**Files:**
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/lead-reply-task.schema.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/platform-reply-adapters/index.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-task-executor.service.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-task-executor.service.spec.ts`

- [ ] Step 1: Add tests for target metadata passthrough.

  Cover:
  - Public comment task passes `targetType = public_comment`.
  - Private message task passes `targetType = private_message`.
  - Douyin tasks are no longer rejected before adapter lookup.
  - DM tasks can be persisted with empty `postId`, `postUrl`, and `commentId`.
  - Douyin Creator tasks use `executorKind = douyin_creator_cli`.

- [ ] Step 2: Extend schema.

  Add executor kind:

  ```ts
  export enum LeadReplyExecutorKind {
    BrowserPlugin = 'browser_plugin',
    DouyinCreatorCli = 'douyin_creator_cli',
  }
  ```

  Relax comment-only fields so DM tasks can be represented without fake comment data:

  ```ts
  @Prop({ type: String, default: '', index: true })
  postId: string

  @Prop({ type: String, default: '' })
  postUrl: string

  @Prop({ type: String, default: '', index: true })
  commentId: string
  ```

  Add target fields:

  ```ts
  @Prop({ required: true, enum: ['public_comment', 'private_message'], default: 'public_comment', index: true, type: String })
  targetType: 'public_comment' | 'private_message'

  @Prop({ type: Object, default: () => ({}) })
  targetIdentity: Record<string, unknown>
  ```

- [ ] Step 3: Extend adapter request.

  Replace the current comment-only request with a union so DM execution cannot accidentally depend on `postId/postUrl/commentId`:

  ```ts
  export type PlatformReplyRequest =
    | {
        taskId: string
        targetType: 'public_comment'
        postId: string
        postUrl: string
        commentId: string
        replyContent: string
        targetIdentity?: Record<string, unknown>
      }
    | {
        taskId: string
        targetType: 'private_message'
        postId?: string
        postUrl?: string
        commentId?: string
        replyContent: string
        targetIdentity: {
          conversationUsername: string
          lastMessage?: string
          lastMessageTime?: string
        }
      }
  ```

- [ ] Step 4: Remove the XHS-only guard in `ReplyTaskExecutorService`.

  Replace the hard-coded platform rejection with adapter registry lookup. If registry throws `PlatformNotSupported`, mark task as `human_required` with `platform_not_supported`.
  Pass `targetType` and `targetIdentity` into `adapter.execute`. For legacy tasks without `targetType`, default to `public_comment`.

- [ ] Step 5: Run executor tests.

  ```bash
  cd /Users/macbook/Documents/trae_projects/AiToEarn/project/aitoearn-backend
  pnpm nx run aitoearn-server:test -- apps/aitoearn-server/src/core/acquisition/leads/reply-task-executor.service.spec.ts
  ```

---

## Task 6: Douyin Reply Adapter

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/platform-reply-adapters/douyin-creator-reply.adapter.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/platform-reply-adapters/registry.ts`
- Test: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/platform-reply-adapters/douyin-creator-reply.adapter.spec.ts`

- [ ] Step 1: Write adapter tests.

  Cover:
  - `public_comment` calls `replyComments`.
  - `private_message` calls `replyDms`.
  - CLI `sentCount > 0` maps to `success = true`.
  - CLI dry-run result maps to `needHumanAssist = true` with `failureReason = dry_run_completed`.
  - CLI error maps to `success = false`.
  - Missing `conversationUsername` returns `needHumanAssist = true` and does not call the CLI.

- [ ] Step 2: Implement adapter.

  Required behavior:
  - Build comment plan:

    ```json
    {
      "comments": [
        {
          "username": "<lead userName from targetIdentity>",
          "commentText": "<source content from targetIdentity>",
          "replyMessage": "<replyContent>"
        }
      ]
    }
    ```

  - Build DM plan:

    ```json
    {
      "conversations": [
        {
          "username": "<conversationUsername>",
          "lastMessage": "<lastMessage>",
          "lastMessageTime": "<lastMessageTime>",
          "replyMessage": "<replyContent>"
        }
      ]
    }
    ```

  - The adapter reads `targetIdentity.dryRun` or the task confirmation flag passed by the automation service. Review tasks must call the CLI with `dryRun = true`; confirmed-send tasks must call the CLI with `dryRun = false`.

- [ ] Step 3: Register Douyin adapter.

  `PlatformReplyAdapterRegistry.get('douyin')` returns `DouyinCreatorReplyAdapter`.

- [ ] Step 4: Run adapter and executor tests.

  ```bash
  cd /Users/macbook/Documents/trae_projects/AiToEarn/project/aitoearn-backend
  pnpm nx run aitoearn-server:test -- apps/aitoearn-server/src/core/acquisition/leads/platform-reply-adapters/douyin-creator-reply.adapter.spec.ts \
    apps/aitoearn-server/src/core/acquisition/leads/reply-task-executor.service.spec.ts
  ```

---

## Task 7: Reply Automation For Douyin Comments And DMs

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-automation.service.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/reply-automation.service.spec.ts`

- [ ] Step 1: Add tests for Douyin task creation.

  Cover:
  - Douyin public-comment lead creates queued task with `targetType = public_comment`.
  - Douyin private-message lead creates human-required task by default when review is required.
  - Batch auto-reply keeps Douyin DM tasks in `human_required` unless explicitly confirmed.
  - `createSingleTask` no longer throws `PlatformNotSupported` for Douyin.
  - `retryTask` accepts failed or human-required Douyin tasks when the task has valid target metadata.
  - `resolveBatchStatus` can queue Douyin public comments and hold Douyin DMs for review.
  - `resolveTaskError` no longer reports `platform_not_supported` for Douyin.

- [ ] Step 2: Replace all XHS-only guards with platform-aware validation.

  Update every XHS hard-code in `reply-automation.service.ts`, including:
  - The `createSingleTask` entry guard that currently rejects `lead.platform !== 'xhs'`.
  - The `retryTask` guard that currently rejects `task.platform !== 'xhs'`.
  - `resolveBatchStatus`, which currently downgrades every non-XHS lead.
  - `resolveTaskError`, which currently reports `platform_not_supported` for every non-XHS lead.
  - Rename `assertExecutableXhsLead`, `assertExecutableXhsTask`, and `hasExecutableXhsFields` to platform-neutral helpers or keep XHS-specific helpers behind a dispatcher.

  Required rules:
  - XHS public comment still requires `postId`, `postUrl`, `xsec_token`, `commentId`.
  - Douyin public comment requires `commentId` or enough `targetIdentity` to match username/comment text.
  - Douyin private message requires `userName` and non-empty reply content.

- [ ] Step 3: Populate `targetType` and `targetIdentity` when creating tasks.

  For public comments:

  ```ts
  targetType: 'public_comment',
  targetIdentity: {
    username: lead.userName,
    commentText: lead.sourceContent,
    postTitle: lead.postTitle,
  }
  ```

  For private messages:

  ```ts
  targetType: 'private_message',
  targetIdentity: {
    conversationUsername: lead.userName,
    lastMessage: lead.sourceContent,
    dryRun: true,
  }
  ```

  Set `executorKind` by platform:
  - XHS: `LeadReplyExecutorKind.BrowserPlugin`
  - Douyin: `LeadReplyExecutorKind.DouyinCreatorCli`

- [ ] Step 4: Run reply automation tests.

  ```bash
  cd /Users/macbook/Documents/trae_projects/AiToEarn/project/aitoearn-backend
  pnpm nx run aitoearn-server:test -- apps/aitoearn-server/src/core/acquisition/leads/reply-automation.service.spec.ts
  ```

---

## Task 8: Capability Status Updates

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-management.service.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/leads/lead-management.service.spec.ts`

- [ ] Step 1: Add tests for Douyin Creator private-message capability.

  Expected statuses:
  - Missing tools dir: `not_supported`
  - Configured but login has not been successfully probed: `manual_required`
  - Configured and last probe/import/export succeeded: `ready`

- [ ] Step 2: Inject `DouyinCreatorCliService` or status provider.

- [ ] Step 3: Add a real readiness signal.

  Do not infer `ready` from directory existence alone. Implement one of these:
  - Preferred: add `DouyinCreatorCliService.checkLogin()` that runs a lightweight CLI probe, such as `npm run users -- --check --out <path>` if the tool supports it.
  - Fallback: persist the timestamp and result of the last successful `comments:export`, `dm:export`, or login probe in Redis or process memory, and return `manual_required` until there is a recent success.

- [ ] Step 4: Update private-message capability response.

  For Douyin, return reason text that explains it uses local Creator Center automation, not official Open Platform IM.

- [ ] Step 5: Run tests.

  ```bash
  cd /Users/macbook/Documents/trae_projects/AiToEarn/project/aitoearn-backend
  pnpm nx run aitoearn-server:test -- apps/aitoearn-server/src/core/acquisition/leads/lead-management.service.spec.ts
  ```

---

## Task 9: Frontend API Client

**Files:**
- Modify: `project/aitoearn-web/src/api/leads.ts`

- [ ] Step 1: Add API types.

  Add:

  ```ts
  export interface DouyinCreatorStatus {
    configured: boolean
    toolsDir: string
    profileDir: string
    outputDir: string
    message: string
  }

  export interface DouyinCreatorImportResult {
    imported: number
    materialized: number
    warnings: string[]
  }

  export interface DouyinCreatorReplyResult {
    dryRun: boolean
    queued: number
    success: number
    humanRequired: number
    failed: number
  }
  ```

  Extend `LeadItem`:

  ```ts
  sourceType: 'public_comment' | 'private_message' | 'manual'
  ```

- [ ] Step 2: Add API functions.

  Add:

  ```ts
  getDouyinCreatorStatus()
  importDouyinCreatorComments(data)
  importDouyinCreatorDms(data)
  replyDouyinCreatorComments(data)
  replyDouyinCreatorDms(data)
  ```

  Extend `listLeads` filter params so `sourceType` can be passed to the backend.

- [ ] Step 3: Run frontend type check.

  ```bash
  cd /Users/macbook/Documents/trae_projects/AiToEarn/project/aitoearn-web
  pnpm run type-check
  ```

---

## Task 10: Frontend Leads Page Controls

**Files:**
- Modify: `project/aitoearn-web/src/app/[lng]/leads/LeadsPage/index.tsx`
- Modify: `project/aitoearn-web/src/app/[lng]/leads/components/PrivateMessageStatusPanel/index.tsx`
- Modify: `project/aitoearn-web/src/app/[lng]/leads/components/LeadToolbar/index.tsx`
- Modify: `project/aitoearn-web/src/app/[lng]/leads/components/LeadDetailDrawer/index.tsx`
- Modify: `project/aitoearn-web/src/app/i18n/locales/en/route.json`
- Modify: `project/aitoearn-web/src/app/i18n/locales/zh/route.json`
- Modify: `project/aitoearn-web/src/app/i18n/locales/ja/route.json`

- [ ] Step 1: Add toolbar actions.

  Buttons:
  - `导入抖音评论`
  - `导入抖音私信`
  - `刷新创作者中心状态`
  - Source filter options: `公开评论`, `私信`, `手动`

  Disable import buttons when status is not configured.

- [ ] Step 2: Add dry-run and send actions in detail drawer.

  For Douyin leads:
  - Primary action: `预演回复`
  - Secondary action after dry-run success: `确认发送`
  - Keep existing manual record action.

- [ ] Step 3: Add status panel copy.

  Show:
  - Tool path configured or missing.
  - Profile path.
  - Last known status message.
  - Short note: “使用本地浏览器自动化，不绕过登录、验证码或平台风控。”

- [ ] Step 4: Add i18n keys in zh/en/ja.

  Use the existing `route` namespace because `LeadsPage` calls `useTransClient('route')`. Add keys under this prefix in all three files:

  ```text
  leads.douyinCreator.statusTitle
  leads.douyinCreator.statusConfigured
  leads.douyinCreator.statusManualRequired
  leads.douyinCreator.statusReady
  leads.douyinCreator.importComments
  leads.douyinCreator.importDms
  leads.douyinCreator.refreshStatus
  leads.douyinCreator.dryRunReply
  leads.douyinCreator.confirmSend
  leads.douyinCreator.localAutomationNotice
  ```

- [ ] Step 5: Run frontend checks.

  ```bash
  cd /Users/macbook/Documents/trae_projects/AiToEarn/project/aitoearn-web
  pnpm run type-check
  pnpm run lint
  ```

---

## Task 11: End-To-End Manual Verification

**Files:**
- No code files.
- Use local `douyin-creator-tools` at `/Users/macbook/Documents/trae_projects/douyin-creator-tools`.

- [ ] Step 1: Verify external tool still works directly when the local repo exists.

  ```bash
  if [ -d /Users/macbook/Documents/trae_projects/douyin-creator-tools ]; then
    cd /Users/macbook/Documents/trae_projects/douyin-creator-tools
    npm test
    npm run lint
    npm run dm:export
    npm run dm:reply -- --dry-run comments-output/dm-conversations.json
  else
    echo "Skipping douyin-creator-tools self-check: local repo not found"
  fi
  ```

- [ ] Step 2: Start backend.

  ```bash
  cd /Users/macbook/Documents/trae_projects/AiToEarn/project/aitoearn-backend
  DOUYIN_CREATOR_TOOLS_DIR=/Users/macbook/Documents/trae_projects/douyin-creator-tools \
  DOUYIN_CREATOR_PROFILE_DIR=/Users/macbook/Documents/trae_projects/douyin-creator-tools/.playwright/douyin-profile \
  pnpm nx serve aitoearn-server
  ```

- [ ] Step 3: Start frontend.

  ```bash
  cd /Users/macbook/Documents/trae_projects/AiToEarn/project/aitoearn-web
  pnpm dev
  ```

- [ ] Step 4: Verify UI flow.

  Expected:
  - Leads page shows Douyin Creator Center status.
  - Import comments creates/updates comment leads.
  - Import DMs creates/updates private-message leads.
  - Dry-run opens Playwright browser and types reply without sending.
  - Confirmed send updates task status and lead timeline.

- [ ] Step 5: Run backend verification.

  ```bash
  cd /Users/macbook/Documents/trae_projects/AiToEarn/project/aitoearn-backend
  pnpm nx run aitoearn-server:test -- apps/aitoearn-server/src/core/acquisition/leads \
    apps/aitoearn-server/src/core/acquisition/douyin-creator-automation \
    libs/channel-db/src/repositories/lead.repository.spec.ts
  pnpm nx run aitoearn-server:build
  ```

---

## Task 12: README Capability Documentation

**Files:**
- Modify: `README.md`
- Modify: `README_EN.md`
- Modify: `README_JA.md`

- [ ] Step 1: Add a short capability note to the Douyin or acquisition section.

  Required content:
  - This is local Douyin Creator Center browser automation.
  - It requires a locally configured `DOUYIN_CREATOR_TOOLS_DIR`.
  - It uses the user's Creator Center login session in a Playwright profile.
  - It supports comment/DM import and review-first replies.
  - It does not bypass login, captcha, verification, or platform risk controls.

- [ ] Step 2: Keep environment wording explicit.

  Mention that this is intended for the China/Douyin environment and is separate from international TikTok APIs.

- [ ] Step 3: Run documentation check.

  ```bash
  cd /Users/macbook/Documents/trae_projects/AiToEarn
  git diff --check -- README.md README_EN.md README_JA.md
  ```

---

## Safety Rules

- Default `dryRun` must remain `true`.
- Batch send limit must be no higher than 20.
- DM send should only reply to existing conversations exported from Creator Center.
- Never automate login, captcha, or platform verification bypass.
- Store CLI result JSON path or summary in task logs.
- If Playwright reports verification, ambiguity, or unsupported message type, mark the task `human_required`.
- Real sends must require a separate user action after dry-run.

---

## Suggested Commit Sequence

1. `feat: add douyin creator cli wrapper`
2. `feat: add douyin creator automation api`
3. `feat: import douyin creator comments and dms`
4. `feat: add douyin reply task adapter`
5. `feat: add douyin creator controls to leads page`
6. `test: cover douyin creator automation flows`

---

## Self-Review

- Spec coverage: The plan covers CLI configuration, comment import, DM import, reply adapter, dry-run/send flows, frontend controls, and verification.
- Placeholder scan: No implementation step relies on undefined placeholder work; follow-up implementation details are scoped to concrete files and tests.
- Type consistency: `targetType`, `targetIdentity`, `sourceType = private_message`, and `douyin_creator_center` are used consistently across tasks.
- Scope check: Video Account Assistant is intentionally excluded from this plan and should get a separate plan when needed.
