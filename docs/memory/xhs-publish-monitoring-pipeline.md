# XHS Publish To Work Data Monitoring Pipeline

This memory document records the current code path for the XHS publish -> publish result -> monitored post -> data/comment collection flow.

Keep this document current. If a change significantly modifies XHS publishing, MultiPost integration, publish result callbacks, `publish_record` completion, monitored-post backfill, or work-data collection behavior, update this document in the same change.

## End-To-End Flow

1. The user publishes an XHS post from the AitoBee publish dialog.
2. The web app routes XHS publishing through the vendored MultiPost extension adapter.
3. MultiPost opens the XHS creator page, fills the post, submits it, and reports an initial pending result.
4. AitoBee creates a `publish_record` and maps the MultiPost `traceId` to the publish record id.
5. After XHS redirects or the script opens the note manager page, the extension backfills the latest XHS note id or work link.
6. The web app receives the final extension result and calls the server `plat/publish/pluginResult` endpoint.
7. The server updates the `publish_record`. If a real XHS `noteId` is available, it immediately upserts a `monitored_post` row with `source: published_backfill`.
8. If the link is still missing `xsec_token`, the monitored row stays `monitorStatus: published` and `fetchStatus: reviewing` or `pending_confirmation`.
9. Pending XHS rows are also queued for token refresh. The web app polls `plat/publish/xhsTokenRefreshJobs`, forwards jobs to MultiPost, and the extension scans the XHS note manager. If the manager only exposes a matching note card without `xsec_token`, the content script returns the card cover click point. The background script uses the Chrome `debugger` API to dispatch a real mouse click, then captures the tokenized detail URL from Chrome tab updates.
10. When a tokenized link is available, the server updates the same `monitored_post` row to `monitorStatus: active`, `fetchStatus: idle`, and enqueues an acquisition post backfill job.
11. The acquisition provider drives the XHS Bridge extension, captures post metrics and comments, persists snapshots, and updates the monitored-post row.

Current behavior: there is an automatic fetch immediately after published-backfill enqueue. There is not currently a scheduler that periodically scans all active monitored posts by `nextFetchAt`; `nextFetchAt` exists on the schema but is not consumed by a scheduler.

## Pending XHS Review Backfill Recovery

Status: implemented for the server and Work Data read model. Plugin-side extraction still depends on the creator note-manager page successfully reporting the bare note id or tokenized work link.

Observed on 2026-05-30: a MultiPost XHS publish for title `山的那边是什么` at 14:35 reached XHS Creator note manager, but the note remained in `审核中`. The corresponding `publish_record` stayed at `linkStatus: pending` with `workLink: ""`, `linkMeta.pendingConfirmation: true`, and `dataId` equal to the MultiPost request trace id (`req-1780122902041-dhy0ee2h`). No `monitored_post` was created, because the backend correctly blocks XHS published-backfill monitoring unless a link with `xsec_token` is available.

Observed again on 2026-06-01: after an XHS publish for title `山的那边是什么`, the creator note manager DOM exposed the newly published note id in `.note-card[data-impression]` (`noteTarget.value.noteId`, e.g. `6a1cf8dc000000000803e2af`). The latest local `publishRecord` still had `dataId: "req-1780283591198-n6d0xvwg"`, `workLink: ""`, and `linkMeta.pendingConfirmation: true`. This confirms the plugin can parse the bare note id from the creator page, but the current payload path does not upload it.

Root cause: XHS does not expose a usable public `explore` link with `xsec_token` while the note is still under review. The plugin-side `xhs-note-manager.ts` can parse a fallback bare note id from `data-impression`, but its current `MULTIPOST_EXTENSION_PUBLISH_RESULT` payload only includes `noteLink/workLink` when `noteLink.xsecToken` exists:

```ts
...(noteLink?.xsecToken ? noteLink : { pendingConfirmation: true })
```

So when the note is still `审核中`, the plugin reports only `pendingConfirmation: true` and drops the parsed bare `workLink`. The frontend and backend are already capable of carrying and saving a bare work link if it appears in the payload.

A previous plugin behavior also consumed `xhs_pending_backfill` on the first note-manager scan even when only pending/no-token state was available, so an item could remain pending forever after review approval unless another final result was manually triggered.

Current behavior after the monitored-post unification change: Work Data no longer merges display-only rows from `publish_record`. Once `plat/publish/pluginResult` can parse a real note id from `noteId`, `workLink`, `linkMeta.unverifiedWorkLink`, or a non-`req-*` `dataId`, it writes the row directly to `monitored_post`. Records that only have a `req-*` trace id stay in `publish_record` and are not shown in Work Data.

Remaining work:

- Reintroduce plugin-side bare note id reporting carefully: when `findLatestNoteLink()` returns a fallback bare link without `xsecToken`, include `workLink` plus `pendingConfirmation: true` in the result payload so the server can persist `publishRecord.dataId` as the real note id and `linkMeta.unverifiedWorkLink` as the bare `explore` URL.
- Do not consume `xhs_pending_backfill` when only a bare/no-token note id is found; keep the marker for later tokenized-link recovery so automatic monitoring can still start after review approval.
- Make pending backfill durable and observable beyond the current single `chrome.storage.local` marker, because one marker can be overwritten by another publish and already-consumed historical pending records cannot recover automatically.
- Add a server-side pending publish recovery path for XHS MultiPost records, e.g. periodically scan recent `publish_record` rows with `linkStatus: pending`, `pendingConfirmation: true`, and no `workLink`, then ask the plugin/bridge to inspect the creator note manager/profile and update the record when an `xsec_token` link is available.
- Keep plugin-side bare note id reporting verified against the live XHS creator page, because Work Data now depends on `monitored_post` and will not render a `publish_record` fallback row.
- Historical pending `publish_record` rows that already contain a real note id can be recovered through `POST /acquisition/work-data/monitored-posts/backfill-published`. The recovery path only selects XHS pending-confirmation records whose `dataId` is a real note id and skips any `req-*` trace ids or records that already have a matching `monitored_post`.

## Frontend Publish Path

- `project/aitoearn-web/src/store/plugin/multipost.adapter.ts`
  - `canUseMultiPost()` gates MultiPost to `platform === 'xhs'`.
  - `buildMultiPostSyncData()` converts AitoBee publish params into MultiPost image/video payloads.
  - `publishWithMultiPost()` sends `MULTIPOST_EXTENSION_PUBLISH_NOW` through `window.postMessage`.
- `project/aitoearn-web/src/store/plugin/store.ts`
  - `registerMultiPostResultListener()` listens for `MULTIPOST_EXTENSION_PUBLISH_RESULT` and calls `updatePluginPublishResultApi()`.
  - The publish completion path creates a `publish_record` with pending link state for MultiPost results and stores the `traceId -> publishRecordId` mapping in `multiPostRecordMap`.
  - If that in-memory mapping is unavailable when a final MultiPost result arrives, the frontend still sends the result with `traceId` so the server can resolve the matching publish record.
- `project/aitoearn-web/src/api/plat/publish.ts`
  - `apiCreatePublishRecord()` posts to `plat/publish/createRecord`.
  - `updatePluginPublishResultApi()` posts to `plat/publish/pluginResult` with either `id` or `traceId`, and forwards optional XHS metadata such as `authorUserId`, `xsecToken`, and `xsecSource`.

## MultiPost Extension Path

- `project/aitoearn-extension/multipost-extension/src/contents/extension.ts`
  - Content script runs on `<all_urls>`.
  - For trusted origins, it forwards `MULTIPOST_*` page messages to the extension background script.
  - It forwards `MULTIPOST_EXTENSION_PUBLISH_RESULT` runtime messages back to the page via `window.postMessage`.
- `project/aitoearn-extension/multipost-extension/src/background/index.ts`
  - Handles `MULTIPOST_EXTENSION_PUBLISH_NOW`.
  - Tracks the source AitoBee tab by `traceId`.
  - For `MULTIPOST_EXTENSION_PUBLISH_RESULT`, sends the result back to the recorded source tab. There is currently no plugin-side broadcast fallback after the 2026-06-01 rollback.
  - Handles `MULTIPOST_EXTENSION_REFRESH_XHS_TOKEN` for pending XHS monitor rows.
  - Reuses the best existing `creator.xiaohongshu.com/*/note-manager` tab or creates one, then sends `REFRESH_XHS_TOKEN` to the XHS token refresher content script. When multiple note-manager tabs exist, it prefers the newer `/new/note-manager` tab, active/highlighted tabs, grouped MultiPost tabs, and later tab ids rather than blindly using the first `chrome.tabs.query()` result.
  - If the note manager reports a matching card without a token link, it sends `OPEN_XHS_NOTE_CARD`, receives the card cover click point, focuses the target window/tab, uses `chrome.debugger` `Input.dispatchMouseEvent` to issue a real mouse click, listens to Chrome tab created/updated URLs, parses the resulting `xiaohongshu.com/explore/...?...xsec_token=...` URL, and calls `updateTokenFromPlugin`.
  - If an old note-manager tab does not have the token-refresher content script after an extension rebuild/reload, it reloads the tab once and retries `REFRESH_XHS_TOKEN`.
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
  - Current bug/limitation: if only a bare note id is found, `findLatestNoteLink()` returns a bare `workLink`, but the send payload drops it because it only spreads `noteLink` when `noteLink.xsecToken` exists. This leaves `publishRecord.dataId` stuck at the MultiPost trace id.
  - Intended behavior: a bare/no-token note id should be sent as `workLink` with `pendingConfirmation: true`, and the marker should remain for later tokenized-link recovery.
- `project/aitoearn-extension/multipost-extension/src/contents/xhs-token-refresher.ts`
  - Runs on `creator.xiaohongshu.com` and handles background `REFRESH_XHS_TOKEN` messages.
  - First scans note-manager `a[href]` links for a matching note id with `xsec_token`.
  - Then scans `.note-card[data-impression]` for the requested note id. If the card exists but has no tokenized link, it returns `canOpenDetail: true` so background can open/click the detail page.
  - Handles `OPEN_XHS_NOTE_CARD` by resolving the matching note card cover center point. It does not use DOM `element.click()`, because XHS detail opening depends on real pointer events and browser user activation.
- `project/aitoearn-extension/multipost-extension/src/utils/xhs-token-link.ts`
  - Shared parser for XHS explore/profile URLs and `xsec_token` metadata.
  - Builds the fallback `https://www.xiaohongshu.com/explore/{noteId}?xsec_source=pc_creatormng` URL when the note card cannot be clicked.
- `project/aitoearn-extension/multipost-extension/src/utils/xhs-click-point.ts`
  - Shared helper for converting a note card cover rect into a click point used by the debugger fallback.
- `project/aitoearn-extension/multipost-extension/src/utils/xhs-note-manager-tab.ts`
  - Shared helper for choosing the most likely current XHS note-manager tab when duplicate creator tabs are open.

## Server Publish Result And Backfill Path

- `project/aitoearn-backend/apps/aitoearn-server/src/core/channel/publish.controller.ts`
  - `createRecord()` creates the initial publish record.
  - `updatePluginPublishResult()` handles `plat/publish/pluginResult`.
  - `pluginResult` accepts either a publish record `id` or a MultiPost `traceId`; the trace fallback is used when a page reload or extension lifecycle event loses the frontend in-memory mapping.
  - On failure, it marks the publish record failed.
  - On `pendingConfirmation` or missing `workLink`, it keeps the publish record in publishing/pending state. If a real XHS note id is available, it upserts `monitored_post` immediately with `monitorStatus: published` and `fetchStatus: reviewing` or `pending_confirmation`.
  - Bare/no-token links save the note id into `publishRecord.dataId`, store the bare URL in `linkMeta.unverifiedWorkLink`, and create/update the same `monitored_post` row instead of relying on a virtual Work Data row.
  - Tokenized results update the same `monitored_post` row to `monitorStatus: active`, `fetchStatus: idle`, `linkStatus: ready`, persist token metadata, and enqueue `addAcquisitionPostBackfillJob()`.
  - `updateTokenFromPlugin()` updates both `publish_record` and `monitored_post`, then removes the token refresh job after successful processing.
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
  - Does not call `pending-published-posts`; Work Data is now backed only by `monitored_post`.
  - Pending-review XHS rows are real `monitored_post` rows with `monitorStatus: published` and `fetchStatus: reviewing` or `pending_confirmation`.
  - Loads acquisition capability status for XHS/Douyin/Kwai.
- `project/aitoearn-web/src/app/[lng]/work-data/components/MonitoredPostTable/index.tsx`
  - Renders monitored posts, metrics, comment count, fetch status, and actions.
  - Uses `fetchStatus` rather than `rowType` to control actions. `reviewing` and `pending_confirmation` disable fetch and pause/resume, show the XHS token refresh action when a `publishRecordId` is present, and delete only removes the `monitored_post` row.
  - The refresh action calls `fetchMonitoredPost()`.
  - Pause/resume calls `updateMonitoredPostStatus()`.
- `project/aitoearn-web/src/hooks/useXhsTokenRefresh.ts`
  - Polls pending XHS token refresh jobs and sends `MULTIPOST_EXTENSION_REFRESH_XHS_TOKEN` to MultiPost.
  - Listens for extension responses for the same action and surfaces refresh failures such as untrusted domain, missing content script, note card not found, or detail fallback timeout instead of silently swallowing them.
- `project/aitoearn-web/src/app/[lng]/work-data/components/AddMonitoredPostDialog/index.tsx`
  - Manual add flow calls `createMonitoredPost()`.
- `project/aitoearn-web/src/api/workData.ts`
  - Frontend API wrapper for `acquisition/work-data/monitored-posts` and nested fetch/comments/snapshots endpoints.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.controller.ts`
  - Server routes for manual create, list, detail, fetch-now, status update, snapshots, and comments.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/acquisition/work-data/work-data.service.ts`
  - `createManual()` creates `source: manual` monitored posts.
  - `backfillHistoricalXhsPublishedMonitors()` migrates historical XHS pending publish records with real `publishRecord.dataId` values into `monitored_post`, skips `req-*`, and avoids overwriting existing monitored records.
  - For XHS manual URLs, `createManual()` persists `xsec_token` metadata from the URL and does not treat MultiPost virtual account ids such as `multipost-rednote` as real author profile ids.
  - `fetchNow()` handles user-triggered immediate collection.
  - `processWorkerFetch()` handles queue-triggered collection.
  - `updateMonitoredPostFromFetchResult()` updates title, cover, latest metrics, latest comment count, snapshot id, fetch status, and fetch log.
  - Before XHS collection, `resolveFreshPostUrl()` uses fresh stored token metadata first, then falls back to token metadata embedded in the saved `postUrl`; only missing URL/token metadata with a real author profile id triggers profile token refresh.

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
  - Stores the monitored work identity, source, monitor status, fetch status, latest metrics, latest comment count, xsec token metadata, latest snapshot id, and optional publish linkage fields: `publishRecordId`, `publishTraceId`, `linkStatus`, and `linkError`.
  - XHS published-backfill identity must use the real note id in `postId`. Do not write `req-*` trace ids to `postId`.
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
