# XHS Publish To Work Data Monitoring Pipeline

This memory document records the current code path for the XHS publish -> publish result -> monitored post -> data/comment collection flow.

Keep this document current. If a change significantly modifies XHS publishing, MultiPost integration, publish result callbacks, `publish_record` completion, monitored-post backfill, or work-data collection behavior, update this document in the same change.

## End-To-End Flow

1. The user publishes an XHS post from the AitoBee publish dialog.
2. The web app routes XHS publishing through the vendored MultiPost extension adapter.
3. MultiPost opens the XHS creator page, fills the post, submits it, and reports an initial pending result.
4. AitoBee creates a `publish_record` and maps the MultiPost `traceId` to the publish record id.
5. After XHS redirects or the script opens the note manager page, the extension backfills the latest XHS work link.
6. The web app receives the final extension result and calls the server `plat/publish/pluginResult` endpoint.
7. The server updates the `publish_record`. If a `workLink` is present, it enqueues an acquisition post backfill job.
8. The backfill worker upserts a `monitored_post` row with `source: published_backfill`.
9. The worker immediately runs the acquisition fetch path for that post.
10. The acquisition provider drives the XHS Bridge extension, captures post metrics and comments, persists snapshots, and updates the monitored-post row.

Current behavior: there is an automatic fetch immediately after published-backfill enqueue. There is not currently a scheduler that periodically scans all active monitored posts by `nextFetchAt`; `nextFetchAt` exists on the schema but is not consumed by a scheduler.

## TODO: Pending XHS Review Backfill Recovery

Status: open.

Observed on 2026-05-30: a MultiPost XHS publish for title `山的那边是什么` at 14:35 reached XHS Creator note manager, but the note remained in `审核中`. The corresponding `publish_record` stayed at `linkStatus: pending` with `workLink: ""`, `linkMeta.pendingConfirmation: true`, and `dataId` equal to the MultiPost request trace id (`req-1780122902041-dhy0ee2h`). No `monitored_post` was created, because the backend correctly blocks XHS published-backfill monitoring unless a link with `xsec_token` is available.

Root cause: XHS does not expose a usable public `explore` link with `xsec_token` while the note is still under review. A previous plugin behavior consumed `xhs_pending_backfill` on the first note-manager scan even when only pending/no-token state was available, so an item could remain pending forever after review approval unless another final result was manually triggered.

Current mitigation: `project/aitoearn-extension/multipost-extension/src/contents/xhs-note-manager.ts` was changed so it only removes `xhs_pending_backfill` after finding a link with `xsecToken`; no-token/pending scans keep the marker for up to 24 hours and throttle repeated pending reports. The local extension build was regenerated and reloaded once during the investigation.

Remaining work:

- Make pending backfill durable and observable beyond the current single `chrome.storage.local` marker, because one marker can be overwritten by another publish and already-consumed historical pending records cannot recover automatically.
- Add a server-side pending publish recovery path for XHS MultiPost records, e.g. periodically scan recent `publish_record` rows with `linkStatus: pending`, `pendingConfirmation: true`, and no `workLink`, then ask the plugin/bridge to inspect the creator note manager/profile and update the record when an `xsec_token` link is available.
- Expose pending-review state in the Work Data or publish UI so the user can distinguish "not monitored yet because XHS is still reviewing" from "monitoring failed".
- Once a pending record receives a tokenized work link, enqueue `AcquisitionPostBackfill` and create the `monitored_post` entry using the existing published-backfill flow.

## Frontend Publish Path

- `project/aitoearn-web/src/store/plugin/multipost.adapter.ts`
  - `canUseMultiPost()` gates MultiPost to `platform === 'xhs'`.
  - `buildMultiPostSyncData()` converts AitoBee publish params into MultiPost image/video payloads.
  - `publishWithMultiPost()` sends `MULTIPOST_EXTENSION_PUBLISH_NOW` through `window.postMessage`.
- `project/aitoearn-web/src/store/plugin/store.ts`
  - `registerMultiPostResultListener()` listens for `MULTIPOST_EXTENSION_PUBLISH_RESULT` and calls `updatePluginPublishResultApi()`.
  - The publish completion path creates a `publish_record` with pending link state for MultiPost results and stores the `traceId -> publishRecordId` mapping in `multiPostRecordMap`.
- `project/aitoearn-web/src/api/plat/publish.ts`
  - `apiCreatePublishRecord()` posts to `plat/publish/createRecord`.
  - `updatePluginPublishResultApi()` posts to `plat/publish/pluginResult`.

## MultiPost Extension Path

- `project/aitoearn-extension/multipost-extension/src/contents/extension.ts`
  - Content script runs on `<all_urls>`.
  - For trusted origins, it forwards `MULTIPOST_*` page messages to the extension background script.
  - It forwards `MULTIPOST_EXTENSION_PUBLISH_RESULT` runtime messages back to the page via `window.postMessage`.
- `project/aitoearn-extension/multipost-extension/src/background/index.ts`
  - Handles `MULTIPOST_EXTENSION_PUBLISH_NOW`.
  - Tracks the source AitoBee tab by `traceId`.
  - For `MULTIPOST_EXTENSION_PUBLISH_RESULT`, sends the result back to the source tab.
- `project/aitoearn-extension/multipost-extension/src/sync/dynamic/rednote.ts`
  - XHS image/text publishing automation.
  - Reports `success: true, pendingConfirmation: true` before clicking publish because the page context can be destroyed immediately after submit.
  - Stores `xhs_pending_backfill` in extension storage and navigates to the note manager page.
- `project/aitoearn-extension/multipost-extension/src/sync/video/rednote.ts`
  - XHS video publishing automation.
  - Uses the same pending-result and `xhs_pending_backfill` pattern.
- `project/aitoearn-extension/multipost-extension/src/contents/xhs-note-manager.ts`
  - Runs on `creator.xiaohongshu.com`.
  - Consumes `xhs_pending_backfill`.
  - Attempts to read the latest note link from the note manager page.
  - Prefers real `a[href]` note links that include `xsec_token` and profile author user id, then falls back to note ids from `data-impression`/element attributes.
  - Sends a final `MULTIPOST_EXTENSION_PUBLISH_RESULT` with `workLink` and optional XHS metadata (`authorUserId`, `xsecToken`, `xsecSource`), or leaves the result pending if no link is found.

## Server Publish Result And Backfill Path

- `project/aitoearn-backend/apps/aitoearn-server/src/core/channel/publish.controller.ts`
  - `createRecord()` creates the initial publish record.
  - `updatePluginPublishResult()` handles `plat/publish/pluginResult`.
  - On failure, it marks the publish record failed.
  - On `pendingConfirmation` or missing `workLink`, it keeps the publish record in publishing/pending state.
  - On a result with `workLink`, it enqueues `addAcquisitionPostBackfillJob()` and forwards optional XHS metadata before validating/completing or marking the work link as pending.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/channel/publishing/providers/base.service.ts`
  - Official/non-plugin publishing also calls `addAcquisitionPostBackfillJob()` after `completePublishTask()` when a supported platform has a work link.
- `project/aitoearn-backend/libs/aitoearn-queue/src/queue.service.ts`
  - `addAcquisitionPostBackfillJob()` enqueues `backfill-post` on `QueueName.AcquisitionPostBackfill`.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/workers/acquisition-post-backfill.consumer.ts`
  - Consumes `AcquisitionPostBackfill`.
  - Calls `WorkDataService.processPostBackfill()`.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.service.ts`
  - `processPostBackfill()` first calls `upsertFromPublishedBackfill()`, then immediately calls `processWorkerFetch()`.
  - `upsertFromPublishedBackfill()` writes/updates `monitored_post` with `source: published_backfill`, `monitorStatus: active`, and `fetchStatus: idle`.
  - For XHS backfills, it persists `xsecToken`, `xsecSource`, and `xsecTokenUpdatedAt` from the plugin payload or URL query. It must not treat MultiPost virtual ids such as `multipost-rednote` as real XHS author profile ids.
  - Before XHS collection, cached fresh token metadata takes priority even when `authorUserId` is empty; only missing/expired tokens require a real author profile refresh.

## Work Data Page And Manual Monitoring

- `project/aitoearn-web/src/app/[lng]/work-data/WorkDataPage/index.tsx`
  - Loads monitored posts through `listMonitoredPosts()`.
  - Loads acquisition capability status for XHS/Douyin/Kwai.
- `project/aitoearn-web/src/app/[lng]/work-data/components/MonitoredPostTable/index.tsx`
  - Renders monitored posts, metrics, comment count, fetch status, and actions.
  - The refresh action calls `fetchMonitoredPost()`.
  - Pause/resume calls `updateMonitoredPostStatus()`.
- `project/aitoearn-web/src/app/[lng]/work-data/components/AddMonitoredPostDialog/index.tsx`
  - Manual add flow calls `createMonitoredPost()`.
- `project/aitoearn-web/src/api/workData.ts`
  - Frontend API wrapper for `acquisition/work-data/monitored-posts` and nested fetch/comments/snapshots endpoints.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.controller.ts`
  - Server routes for manual create, list, detail, fetch-now, status update, snapshots, and comments.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.service.ts`
  - `createManual()` creates `source: manual` monitored posts.
  - `fetchNow()` handles user-triggered immediate collection.
  - `processWorkerFetch()` handles queue-triggered collection.
  - `updateMonitoredPostFromFetchResult()` updates title, cover, latest metrics, latest comment count, snapshot id, fetch status, and fetch log.

## Acquisition And XHS Bridge Path

- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/acquisition.service.ts`
  - Selects the platform provider.
  - `fetchNow()` calls provider `fetchWorkAndComments()`, saves capability state, and persists snapshots if ready.
  - `enqueueCommentFetch()` enqueues `QueueName.AcquisitionCommentFetch`.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/workers/acquisition-comment-fetch.consumer.ts`
  - Consumes comment-fetch jobs and calls `WorkDataService.processWorkerFetch()`.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/providers/xhs/xhs-bridge-acquisition.provider.ts`
  - XHS provider backed by the local XHS Bridge extension.
  - Checks bridge connectivity for capability.
  - Navigates to XHS pages, waits for page load/DOM stability, expands comments, evaluates extractors, and normalizes post/comment data.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/providers/xhs/xhs-extractors.ts`
  - Browser-side expressions used to capture profile note tokens, expand comments, and extract note state.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge.service.ts`
  - Starts the local WebSocket bridge on `ws://127.0.0.1:9333`.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge-hub.ts`
  - Maintains the extension connection and command/response routing.
- `project/aitoearn-extension/xhs-bridge/background.js`
  - Chrome extension side for XHS Bridge commands: `navigate`, `wait_for_load`, `wait_dom_stable`, and `evaluate`.

## Persistence Model

- `project/aitoearn-backend/libs/channel-db/src/schemas/monitored-post.schema.ts`
  - Collection: `monitored_post`.
  - Stores the monitored work identity, source, monitor status, fetch status, latest metrics, latest comment count, xsec token metadata, and latest snapshot id.
- `project/aitoearn-backend/libs/channel-db/src/schemas/post-snapshot.schema.ts`
  - Collection: `post_snapshot`.
  - Stores per-fetch post snapshots and normalized metrics.
- `project/aitoearn-backend/libs/channel-db/src/schemas/comment-snapshot.schema.ts`
  - Collection: `comment_snapshot`.
  - Stores captured comments/replies, user info, like count, IP location, xsec token, fetch batch, and data source.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/snapshot-persistence.service.ts`
  - Persists post snapshots and bulk upserts comment snapshots.

## Maintenance Rules

- Update this document when changing any of these contracts:
  - MultiPost request/response action names.
  - XHS publish trace id handling.
  - `multiPostRecordMap` or publish record creation timing.
  - `plat/publish/pluginResult` behavior.
  - `PublishRecordLinkStatus` or pending-confirmation semantics.
  - `AcquisitionPostBackfill` or `AcquisitionCommentFetch` queue payloads.
  - `monitored_post` identity/upsert rules.
  - XHS Bridge command names or extractor behavior.
  - Snapshot persistence schema fields used by the work-data page.
- If adding a true periodic monitor scheduler for active posts, document its entry point, cron/interval, queue behavior, and `nextFetchAt` semantics here.
- If changing user-visible work-data behavior, keep the `work-data` page, API wrapper, backend controller/service, and i18n keys in sync.
