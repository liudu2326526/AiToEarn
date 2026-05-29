# XHS MultiPost Extension Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make XHS publishing reliable by owning a local MultiPost extension source tree, fixing Rednote image/video automation, and wiring publish-result feedback back into AitoBee.

**Architecture:** Keep `project/aitoearn-extension/xhs-bridge` as the read-only XHS data bridge and use `project/aitoearn-extension/multipost-extension` as the forkable publishing extension. AitoBee web keeps using the MultiPost external message protocol for initial task acceptance, then receives asynchronous `PUBLISH_RESULT` events from the extension and updates `publish_record` through the backend. Rednote DOM automation lives inside the extension; AitoBee builds normalized publish payloads, creates a `PUBLISHING` publish record, and later marks it `PUBLISHED` or `FAILED`.

**Tech Stack:** Chrome Extension Manifest V3, Plasmo, React 18, TypeScript, pnpm, AitoBee Next.js web app, existing `window.postMessage` MultiPost external API.

---

## Current Source Baseline

- Source path: `project/aitoearn-extension/multipost-extension`
- Upstream remote: `https://github.com/leaperone/MultiPost-Extension.git`
- Pulled commit: `9fb4dd2 docs: add WeChat group QR code`
- License: Apache-2.0
- Current AitoBee adapter: `project/aitoearn-web/src/store/plugin/multipost.adapter.ts`
- Current AitoBee publish store: `project/aitoearn-web/src/store/plugin/store.ts`
- Current AitoBee MultiPost smoke test: `project/aitoearn-web/scripts/test-multipost-adapter.cjs`

## File Map

- `project/aitoearn-extension/multipost-extension/src/sync/dynamic/rednote.ts`
  - Owns XHS image/text publishing automation.
- `project/aitoearn-extension/multipost-extension/src/sync/video/rednote.ts`
  - Owns XHS video publishing automation.
- `project/aitoearn-extension/multipost-extension/src/sync/common.ts`
  - Opens platform tabs and injects publish scripts.
- `project/aitoearn-extension/multipost-extension/src/background/index.ts`
  - Handles `MULTIPOST_EXTENSION_PUBLISH_NOW`.
- `project/aitoearn-extension/multipost-extension/src/contents/extension.ts`
  - Bridges page `window.postMessage` requests to the extension and must also forward background publish-result events back to AitoBee pages.
- `project/aitoearn-extension/multipost-extension/src/types/external.ts`
  - Defines external request/response payloads.
- `project/aitoearn-web/src/store/plugin/multipost.adapter.ts`
  - Builds AitoBee -> MultiPost payload and receives extension responses.
- `project/aitoearn-web/src/store/plugin/store.ts`
  - Creates plugin publish records and applies asynchronous MultiPost publish results.
- `project/aitoearn-web/src/api/plat/publish.ts`
  - Adds the frontend API helper for plugin publish-result updates.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/channel/publish.dto.ts`
  - Adds the DTO for plugin publish-result updates.
- `project/aitoearn-backend/apps/aitoearn-server/src/core/channel/publish.controller.ts`
  - Adds the authenticated endpoint that marks plugin publish records published or failed.
- `project/aitoearn-web/scripts/test-multipost-adapter.cjs`
  - Fast Node smoke test for AitoBee payload shaping.

## Scope

This plan fixes the browser-extension publishing path. It does not add official XHS OpenAPI publishing because XHS publishing currently depends on user browser session automation, not a backend credentialed API.

## Verified Review Findings

- `DynamicRednote` and `VideoRednote` run inside the opened XHS creator tab. In the current upstream code their thrown errors are not returned to AitoBee because `src/sync/common.ts` registers `chrome.scripting.executeScript()` inside a tab update listener and does not await or forward the result.
- `background/index.ts` currently catches only tab creation/grouping errors around `createTabsForPlatforms(data)`, and that catch block logs without `sendResponse`. Initial rejection must be fixed, but it still does not cover DOM automation failures inside the XHS tab.
- `src/sync/video/rednote.ts` only clicks publish inside the `if (scheduledPublishTime)` block. Immediate video publishing with `isAutoPublish=true` and no scheduled time uploads/fills the form but does not click publish.
- The current plan must not rely on `throw` alone. It needs a content script -> background -> AitoBee result channel before image/video automation is made strict.
- XHS media URLs must be fetchable by the extension. Public CDN URLs with CORS are safest; internal `127.0.0.1` URLs or opaque signed URLs may fail when fetched from the XHS creator tab unless the extension moves media fetching into the background.
- The current upstream image/video scripts force `window.location.href = "https://creator.xiaohongshu.com/new/note-manager"` after clicking publish. A result helper must not treat that script-triggered navigation as confirmed success. It may report "submitted, pending confirmation" only when the publish click succeeds and no explicit XHS error appears.

## Verified Implementation Constraints

- `src/contents/extension.ts` uses `matches: ["<all_urls>"]`, so the content script can run on AitoBee pages after the domain is trusted.
- `src/sync/common.ts` calls `chrome.scripting.executeScript()` without `world`, so Chrome uses the default isolated world where `chrome.runtime.sendMessage` is available. Do not change these injections to `world: "MAIN"` unless a separate `window.postMessage` bridge is added.
- `src/background/index.ts` already returns `true` from `chrome.runtime.onMessage.addListener`, so asynchronous `sendResponse` is supported.
- Keep backend examples consistent with the current codebase style: existing channel controller methods use `@Post('...')`, `plainToInstance(...)`, and DTOs extend `createZodDto(schema)` without a second name argument.
- Keep frontend publish API helpers consistent with `project/aitoearn-web/src/api/plat/publish.ts`, which uses the local `request<T>({ url, method, data })` wrapper.

---

### Task 1: Verify Local MultiPost Source And Build

**Files:**
- Read: `project/aitoearn-extension/multipost-extension/package.json`
- Read: `project/aitoearn-extension/multipost-extension/README.md`
- Read: `project/aitoearn-extension/multipost-extension/LICENSE`

- [ ] **Step 1: Verify upstream source state**

Run:

```bash
git -C project/aitoearn-extension/multipost-extension remote -v
git -C project/aitoearn-extension/multipost-extension log -1 --oneline
```

Expected:

```text
origin https://github.com/leaperone/MultiPost-Extension.git
9fb4dd2 docs: add WeChat group QR code
```

- [ ] **Step 2: Install extension dependencies**

Run:

```bash
cd project/aitoearn-extension/multipost-extension
pnpm install
```

Expected: pnpm completes without dependency resolution errors.

- [ ] **Step 3: Build unpacked extension**

Run:

```bash
cd project/aitoearn-extension/multipost-extension
pnpm build
```

Expected: Plasmo creates a Chrome MV3 production build under `.plasmo/build/`.

- [ ] **Step 4: Load extension manually**

Open `chrome://extensions`, enable Developer Mode, click "Load unpacked", then load the Chrome MV3 production build directory generated by Plasmo.

Expected: Chrome shows the local MultiPost extension without manifest errors.

---

### Task 2: Add MultiPost Publish Result Channel

**Files:**
- Modify: `project/aitoearn-extension/multipost-extension/src/types/external.ts`
- Modify: `project/aitoearn-extension/multipost-extension/src/background/index.ts`
- Modify: `project/aitoearn-extension/multipost-extension/src/contents/extension.ts`
- Modify: `project/aitoearn-extension/multipost-extension/src/sync/common.ts`

- [ ] **Step 1: Add publish result types**

In `src/types/external.ts`, add these exported interfaces:

```ts
export interface ExtensionPublishAcceptedResult {
  accepted: boolean;
  traceId: string;
  tabs: Array<{
    id?: number;
    url?: string;
    platform: string;
  }>;
  error?: string;
}

export interface ExtensionPublishResultEvent {
  type: "MULTIPOST_EXTENSION_PUBLISH_RESULT";
  traceId: string;
  platform: string;
  success: boolean;
  workLink?: string;
  workId?: string;
  pendingConfirmation?: boolean;
  error?: string;
}
```

- [ ] **Step 2: Add trace field to SyncData**

In `src/sync/common.ts`, extend `SyncData` with:

```ts
publishTraceId?: string;
```

The resulting interface starts like:

```ts
export interface SyncData {
  platforms: SyncDataPlatform[];
  isAutoPublish: boolean;
  data: DynamicData | ArticleData | VideoData | PodcastData;
  origin?: DynamicData | ArticleData | VideoData | PodcastData;
  publishTraceId?: string;
}
```

- [ ] **Step 3: Store the source AitoBee tab for each publish trace**

In `background/index.ts`, add a module-level map:

```ts
const publishTraceSourceTabs = new Map<string, number>();
```

When handling `MULTIPOST_EXTENSION_PUBLISH_NOW`, get the source tab from `sender.tab?.id`, and reject if it is missing:

```ts
const sourceTabId = sender.tab?.id;
if (!sourceTabId) {
  sendResponse({
    accepted: false,
    traceId: request.traceId,
    tabs: [],
    error: "MultiPost publish failed: source AitoBee tab is missing",
  });
  return;
}

publishTraceSourceTabs.set(request.traceId, sourceTabId);
```

- [ ] **Step 4: Put trace metadata on SyncData before opening XHS tabs**

In the `MULTIPOST_EXTENSION_PUBLISH_NOW` handler, create a traced copy:

```ts
const tracedData = {
  ...data,
  publishTraceId: request.traceId,
};
```

Pass `tracedData` into `createTabsForPlatforms(tracedData)`.

- [ ] **Step 5: Send initial accepted or rejected response**

Replace the current success response with:

```ts
sendResponse({
  accepted: true,
  traceId: request.traceId,
  tabs: tabs.map((t: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }) => ({
    id: t.tab.id,
    url: t.tab.url,
    platform: t.platformInfo.name,
  })),
});
```

Replace the catch block with:

```ts
const message = error instanceof Error ? error.message : String(error);
sendResponse({
  accepted: false,
  traceId: request.traceId,
  tabs: [],
  error: message,
});
```

- [ ] **Step 6: Forward final publish results to the original AitoBee page**

Add a handler in `background/index.ts` for `request.action === "MULTIPOST_EXTENSION_PUBLISH_RESULT"`:

```ts
const sourceTabId = publishTraceSourceTabs.get(request.data.traceId);
if (sourceTabId) {
  chrome.tabs.sendMessage(sourceTabId, {
    type: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
    data: request.data,
  });
  if (request.data.success || request.data.error) {
    publishTraceSourceTabs.delete(request.data.traceId);
  }
}
sendResponse({ received: true });
```

- [ ] **Step 7: Forward background result events from content script to AitoBee window**

In `src/contents/extension.ts`, add:

```ts
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "MULTIPOST_EXTENSION_PUBLISH_RESULT") return;
  window.postMessage(
    {
      type: "response",
      action: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
      traceId: message.data.traceId,
      code: message.data.success ? 0 : 1,
      message: message.data.error || "success",
      data: message.data,
    },
    window.location.origin,
  );
});
```

- [ ] **Step 8: Build extension**

Run:

```bash
cd project/aitoearn-extension/multipost-extension
pnpm build
```

Expected: build passes.

---

### Task 3: Make Rednote Image Publishing Report Real Failures

**Files:**
- Modify: `project/aitoearn-extension/multipost-extension/src/sync/dynamic/rednote.ts`

- [ ] **Step 1: Add result reporting helper**

At the top of `DynamicRednote`, read the trace ID and add:

```ts
const publishTraceId = (data as SyncData & { publishTraceId?: string }).publishTraceId || "";

async function reportPublishResult(result: {
  success: boolean;
  workLink?: string;
  workId?: string;
  pendingConfirmation?: boolean;
  error?: string;
}) {
  if (!publishTraceId || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
  await chrome.runtime.sendMessage({
    action: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
    data: {
      type: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
      traceId: publishTraceId,
      platform: "DYNAMIC_REDNOTE",
      ...result,
    },
  });
}
```

- [ ] **Step 2: Wrap the existing body in try/catch**

Wrap the existing image publish flow:

```ts
try {
  // existing image publish flow
  const result = await waitForPostClickSignal("image");
  await reportPublishResult(result);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await reportPublishResult({
    success: false,
    error: message,
  });
  throw error;
}
```

This makes throws observable by AitoBee through the result channel from Task 2.

- [ ] **Step 3: Replace silent returns with thrown errors**

In `DynamicRednote`, every current failure branch like this:

```ts
console.error("未找到上传图文按钮");
return;
```

must become:

```ts
throw new Error("XHS image publish failed: upload image button not found");
```

Do this for:

```text
file input not found
no images added to DataTransfer
upload image button not found
title input not found
content editor not found
publish button not found
```

- [ ] **Step 4: Add title filling with paste fallback**

Add helpers:

```ts
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

async function fillInputText(input: HTMLInputElement, value: string) {
  setNativeValue(input, value);
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (input.value === value) return;

  input.focus();
  const pasteEvent = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    clipboardData: new DataTransfer(),
  });
  pasteEvent.clipboardData?.setData("text/plain", value);
  input.dispatchEvent(pasteEvent);
  await new Promise((resolve) => setTimeout(resolve, 200));
  input.blur();
}
```

Use:

```ts
await fillInputText(titleInput, titleText);
```

- [ ] **Step 5: Wait for upload readiness without relying on `xhscdn`**

Replace the fixed `5000ms` sleep with a helper that checks either preview count or publish-button readiness:

```ts
async function waitForImageUploadReady(expectedCount: number, timeout = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const previewItems = document.querySelectorAll(
      ".upload-image-list img, .image-list img, .upload-image-list .image-item, .image-list .image-item, img[src^='blob:']",
    );
    const publishButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("发布"),
    ) as HTMLButtonElement | undefined;

    if (previewItems.length >= expectedCount) return;
    if (publishButton && publishButton.getAttribute("aria-disabled") !== "true" && !publishButton.disabled) return;

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`XHS image publish failed: image upload did not become ready, expected ${expectedCount}`);
}
```

Call:

```ts
await waitForImageUploadReady(images.length);
```

- [ ] **Step 6: Add publish button timeout**

When waiting for the publish button, use:

```ts
async function waitUntilButtonEnabled(button: HTMLButtonElement, timeout = 30000) {
  const startedAt = Date.now();
  while (button.getAttribute("aria-disabled") === "true" || button.disabled) {
    if (Date.now() - startedAt > timeout) {
      throw new Error("XHS image publish failed: publish button stayed disabled");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
```

- [ ] **Step 7: Report confirmed success or pending confirmation after publish click**

Remove the current forced redirect from the image publish path:

```ts
window.location.href = "https://creator.xiaohongshu.com/new/note-manager";
```

Do not use a redirect triggered by this script as the success signal. After clicking the publish button, wait for visible XHS feedback:

```ts
async function waitForPostClickSignal(kind: "image" | "video", timeout = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const href = window.location.href;
    const bodyText = document.body?.textContent || "";

    if (bodyText.includes("发布成功") || bodyText.includes("提交成功") || bodyText.includes("作品已发布")) {
      return {
        success: true,
        workLink: href,
      };
    }

    if (href.includes("/note-manager")) {
      return {
        success: true,
        workLink: href,
      };
    }

    const explicitError = ["发布失败", "上传失败", "请先上传", "内容不能为空", "标题不能为空"].find((text) =>
      bodyText.includes(text),
    );
    if (explicitError) {
      throw new Error(`XHS ${kind} publish failed: ${explicitError}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return {
    success: true,
    pendingConfirmation: true,
  };
}
```

Call `waitForPostClickSignal("image")` after `publishButton.click()` and report its returned object. A timeout without an explicit error means "publish was submitted but not confirmed", not "published". AitoBee must keep the publish record in `PUBLISHING` with `linkStatus: "pending"` for that case.

- [ ] **Step 8: Build extension**

Run:

```bash
cd project/aitoearn-extension/multipost-extension
pnpm build
```

Expected: build passes.

---

### Task 4: Fix Rednote Video Immediate Publish And Result Reporting

**Files:**
- Modify: `project/aitoearn-extension/multipost-extension/src/sync/video/rednote.ts`

- [ ] **Step 1: Add result reporting helper**

Add the same `publishTraceId` and `reportPublishResult()` pattern from Task 3, but set `platform: "VIDEO_REDNOTE"`.

- [ ] **Step 2: Move publish button click outside scheduled-only branch**

The current `video/rednote.ts` only clicks the publish button inside `if (scheduledPublishTime)`. Immediate publishing with `isAutoPublish=true` and no scheduled time uploads/fills the form but does not publish. Keep scheduled-time setup conditional, then always attempt publish when `data.isAutoPublish` is true:

```ts
if (scheduledPublishTime) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await setScheduledPublishTime(scheduledPublishTime);
}

if (data.isAutoPublish) {
  await clickPublishButton();
}
```

- [ ] **Step 3: Extract `clickPublishButton()` with a timeout**

Add:

```ts
async function clickPublishButton() {
  const buttons = document.querySelectorAll("button");
  const publishButton = Array.from(buttons).find((button) => button.textContent?.includes("发布")) as HTMLButtonElement | undefined;

  if (!publishButton) {
    throw new Error("XHS video publish failed: publish button not found");
  }

  const startedAt = Date.now();
  let lastLogAt = 0;
  const maxWait = 300000;
  while (publishButton.getAttribute("aria-disabled") === "true" || publishButton.disabled) {
    if (Date.now() - startedAt > maxWait) {
      throw new Error("XHS video publish failed: publish button stayed disabled (upload timeout)");
    }
    if (Date.now() - lastLogAt > 30000) {
      console.debug(`waiting for video upload... ${Math.round((Date.now() - startedAt) / 1000)}s elapsed`);
      lastLogAt = Date.now();
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  publishButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}
```

- [ ] **Step 4: Throw on missing video upload input**

Replace silent video-upload errors with thrown errors:

```ts
throw new Error("XHS video publish failed: video file input not found");
```

and:

```ts
throw new Error("XHS video publish failed: no video file added to upload input");
```

- [ ] **Step 5: Wrap the video flow in try/catch and report final result**

At the outer level of `VideoRednote`, report the post-click signal after `clickPublishButton()` finishes, and report failure in `catch`:

```ts
try {
  // existing video publish flow
  if (data.isAutoPublish) {
    await clickPublishButton();
  }
  const result = data.isAutoPublish ? await waitForPostClickSignal("video") : { success: true, pendingConfirmation: true };
  await reportPublishResult(result);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await reportPublishResult({
    success: false,
    error: message,
  });
  throw error;
}
```

- [ ] **Step 6: Report confirmed success or pending confirmation after publish click**

Reuse the `waitForPostClickSignal()` helper from Task 3:

```ts
const result = await waitForPostClickSignal("video");
```

Call it after `clickPublishButton()`. Do not force-redirect to `/note-manager` and then treat that URL as success. If no success cue appears but no explicit error appears, report `{ success: true, pendingConfirmation: true }` so AitoBee keeps the record pending instead of marking it published.

- [ ] **Step 7: Build extension**

Run:

```bash
cd project/aitoearn-extension/multipost-extension
pnpm build
```

Expected: build passes.

---

### Task 5: Add Backend Publish Record Result Endpoint

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/channel/publish.dto.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/channel/publish.controller.ts`

- [ ] **Step 1: Add DTO schema**

In `publish.dto.ts`, add:

```ts
export const UpdatePluginPublishResultSchema = z.object({
  id: z.string().describe("发布记录ID"),
  success: z.boolean().describe("插件发布是否成功"),
  dataId: z.string().optional().describe("平台作品ID或插件请求ID"),
  workLink: z.string().optional().describe("作品链接"),
  pendingConfirmation: z.boolean().optional().describe("插件已点击发布但尚未拿到平台确认信号"),
  errorMsg: z.string().optional().describe("失败原因"),
});
export class UpdatePluginPublishResultDto extends createZodDto(UpdatePluginPublishResultSchema) {}
```

- [ ] **Step 2: Add controller endpoint**

In `publish.controller.ts`, import `UpdatePluginPublishResultDto`, `PublishRecordLinkStatus`, and `PublishStatus`, then add:

```ts
@ApiDoc({
  summary: "更新插件发布结果",
  body: UpdatePluginPublishResultDto.schema,
})
@Post('pluginResult')
async updatePluginPublishResult(@GetToken() token: TokenInfo, @Body() data: UpdatePluginPublishResultDto) {
  data = plainToInstance(UpdatePluginPublishResultDto, data);
  const publishRecord = await this.publishRecordService.getPublishRecordInfo(data.id);
  if (!publishRecord || publishRecord.userId !== token.id) {
    throw new AppException(ResponseCode.PublishRecordNotFound);
  }

  if (!data.success) {
    return this.publishRecordService.failById(data.id, data.errorMsg || "plugin publish failed");
  }

  if (data.pendingConfirmation || !data.workLink) {
    await this.publishRecordService.updateStatusById(data.id, PublishStatus.PUBLISHING);
    return this.publishRecordService.updateWorkLinkById(data.id, {
      dataId: data.dataId || publishRecord.dataId,
      linkStatus: PublishRecordLinkStatus.PENDING,
      linkMeta: {
        ...(publishRecord.linkMeta || {}),
        pendingConfirmation: true,
      },
    });
  }

  return this.publishRecordService.completeById(publishRecord, data.dataId || publishRecord.dataId, {
    workLink: data.workLink,
  });
}
```

This endpoint intentionally follows the existing local controller style (`@Post('pluginResult')`, `plainToInstance`, and `createZodDto(schema)`). The pending-confirmation branch prevents a successful publish click without a verifiable work link from becoming a false `PUBLISHED` record.

- [ ] **Step 3: Run focused backend type check/build**

Run:

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

Expected: build passes.

---

### Task 6: Harden AitoBee MultiPost Adapter And Record Updates

**Files:**
- Modify: `project/aitoearn-web/src/api/plat/publish.ts`
- Modify: `project/aitoearn-web/src/store/plugin/multipost.adapter.ts`
- Modify: `project/aitoearn-web/src/store/plugin/store.ts`
- Modify: `project/aitoearn-web/scripts/test-multipost-adapter.cjs`

- [ ] **Step 1: Add frontend API helper**

In `api/plat/publish.ts`, add:

```ts
export function updatePluginPublishResultApi(data: {
  id: string;
  success: boolean;
  dataId?: string;
  workLink?: string;
  pendingConfirmation?: boolean;
  errorMsg?: string;
}) {
  return request<{ id: string }>({
    url: "plat/publish/pluginResult",
    method: "POST",
    data,
  });
}
```

- [ ] **Step 2: Extend MultiPost accepted response type**

In `multipost.adapter.ts`, use:

```ts
interface MultiPostPublishAcceptedResult {
  accepted?: boolean;
  traceId?: string;
  tabs?: unknown[];
  error?: string;
}
```

and:

```ts
const response = await sendMultiPostRequest<MultiPostSyncData, MultiPostPublishAcceptedResult>(
  "MULTIPOST_EXTENSION_PUBLISH_NOW",
  syncData,
  10000,
);
```

- [ ] **Step 3: Treat initial extension rejection as failure**

After receiving the accepted response:

```ts
if (response.code !== 0 || response.data?.accepted === false) {
  throw new Error(response.data?.error || response.message || "MultiPost 发布任务创建失败");
}
```

- [ ] **Step 4: Return accepted status honestly**

Change the final success message in `publishWithMultiPost()` to:

```ts
message: "MultiPost 已接收发布任务，正在等待小红书页面返回最终结果",
```

Return:

```ts
return {
  success: true,
  workId: params.requestId || response.data?.traceId || `multipost-${Date.now()}`,
  publishTime: Date.now(),
  platformData: {
    provider: "multipost",
    accepted: true,
    traceId: response.data?.traceId,
    tabs: response.data?.tabs,
  },
};
```

- [ ] **Step 5: Create plugin publish records as `PUBLISHING` before waiting for final result**

In `store.ts`, import the existing frontend enum:

```ts
import { PublishStatus } from "@/api/plat/types/publish.types";
```

When creating the publish record for MultiPost/XHS, use `PublishStatus.PUB_LOADING` instead of a numeric literal, set `dataId` to `requestId`, and set `linkStatus` to `"pending"`:

```ts
status: platform === PlatType.Xhs ? PublishStatus.PUB_LOADING : PublishStatus.RELEASED,
dataId: platform === PlatType.Xhs ? requestId : `${result.workId}`,
workLink: platform === PlatType.Xhs ? "" : result.shareLink,
linkStatus: platform === PlatType.Xhs ? "pending" : (wxSphAnchor && !result.shareLink ? "pending" : undefined),
```

Store the returned `recordRes.data.id` in a map keyed by `requestId`.

- [ ] **Step 6: Listen for final MultiPost result events**

In `store.ts`, register one browser listener while the store is initialized:

```ts
window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  if (event.data?.action !== "MULTIPOST_EXTENSION_PUBLISH_RESULT") return;

  const result = event.data.data as {
    traceId: string;
    success: boolean;
    workLink?: string;
    workId?: string;
    pendingConfirmation?: boolean;
    error?: string;
  };
  const recordId = get().multiPostRecordMap?.get(result.traceId);
  if (!recordId) return;

  await updatePluginPublishResultApi({
    id: recordId,
    success: result.success,
    dataId: result.workId || result.traceId,
    workLink: result.workLink,
    pendingConfirmation: result.pendingConfirmation,
    errorMsg: result.error,
  });
});
```

Add `multiPostRecordMap: Map<string, string>` to the store state if it does not exist.

- [ ] **Step 7: Add adapter smoke assertion**

In `test-multipost-adapter.cjs`, keep the existing payload assertions and add:

```js
assert.deepEqual(imageSyncData.data.videos, [])
```

- [ ] **Step 8: Run AitoBee adapter smoke test**

Run:

```bash
cd project/aitoearn-web
node scripts/test-multipost-adapter.cjs
```

Expected:

```text
multipost adapter tests passed
```

---

### Task 7: Manual End-To-End Verification

**Files:**
- Read: `project/aitoearn-web/src/store/plugin/constants.ts`
- Read: `project/aitoearn-web/src/store/plugin/store.ts`
- Read: `project/aitoearn-extension/multipost-extension/.plasmo/build/`

- [ ] **Step 1: Start AitoBee local web**

Run the existing local web service or start it:

```bash
cd project/aitoearn-web
pnpm dev -- --port 6061
```

Expected: `http://127.0.0.1:6061/zh-CN` opens.

- [ ] **Step 2: Load local MultiPost build**

Open `chrome://extensions`, disable the Chrome Web Store MultiPost copy if it is active, and load the local build from `project/aitoearn-extension/multipost-extension/.plasmo/build/...`.

Expected: only one MultiPost instance handles `MULTIPOST_EXTENSION_PUBLISH_NOW`.

- [ ] **Step 3: Trust the AitoBee domain**

Trigger XHS publishing once from AitoBee. If MultiPost asks for trust-domain permission, approve the current host.

Expected: `127.0.0.1` or the deployed AitoBee domain is trusted.

- [ ] **Step 4: Verify image publish**

Create an XHS image publish task with public CDN images that the extension can fetch from the XHS creator tab. Use OBS/OSS/CDN URLs that return `200` and allow browser fetches; do not use `127.0.0.1` API URLs for this test.

```text
title: 图文发布测试
desc: 这是一条图文自动化发布测试 #AitoBee
images: 2 PNG/JPEG images with public CDN URLs
```

Expected:

```text
MultiPost opens XHS creator page
images upload
title and content are filled
publish button is clicked when auto-publish is enabled
no silent success appears when upload fails
publish_record starts as publishing and is updated to published, pending confirmation, or failed after the result event
```

- [ ] **Step 5: Verify video publish**

Create an XHS video publish task with a public MP4 URL that the extension can fetch from the XHS creator tab. Use an OBS/OSS/CDN URL that returns `200` and allows browser fetches; do not use a local API URL.

```text
title: 视频发布测试
desc: 这是一条视频自动化发布测试 #AitoBee
video: public MP4 URL
cover: optional JPG/PNG
```

Expected:

```text
video uploads
title and content are filled
publish button is clicked even without scheduledPublishTime
failure is reported when upload input or publish button cannot be found
publish_record starts as publishing and is updated to published, pending confirmation, or failed after the result event
```

---

### Task 8: Decide How To Track The Fork

**Files:**
- Inspect: `project/aitoearn-extension/multipost-extension/.git`
- Optional modify: `.gitmodules`

- [ ] **Option A: Keep as nested working clone for local patching**

Use this if the extension will be developed locally and not committed into the AiToEarn repository yet.

Run:

```bash
git status --short project/aitoearn-extension/multipost-extension
```

Expected in AiToEarn root:

```text
?? project/aitoearn-extension/multipost-extension/
```

- [ ] **Option B: Convert to git submodule before committing**

Use this if the extension fork will stay in its own GitHub repository.

Run:

```bash
rm -rf project/aitoearn-extension/multipost-extension
git submodule add https://github.com/<your-org-or-user>/MultiPost-Extension.git project/aitoearn-extension/multipost-extension
```

Expected: `.gitmodules` is created or updated.

- [ ] **Option C: Vendor source into AiToEarn**

Use this only if you want all extension source tracked directly in AiToEarn.

Run:

```bash
rm -rf project/aitoearn-extension/multipost-extension/.git
git add project/aitoearn-extension/multipost-extension
```

Expected: AiToEarn root git sees ordinary files instead of a nested repository.

Recommendation: use Option C while the extension is changing quickly in this single repo, because it keeps local edits and deployment together. Switch to Option B after creating a dedicated fork and deciding to publish extension releases independently.

---

## Verification Commands

Run before claiming the remediation is complete:

```bash
cd project/aitoearn-extension/multipost-extension
pnpm build
```

```bash
cd project/aitoearn-backend
pnpm nx run aitoearn-server:build
```

```bash
cd project/aitoearn-web
node scripts/test-multipost-adapter.cjs
pnpm run type-check
```

Manual Chrome verification is required because the XHS publish flow depends on the live creator center DOM and the logged-in browser session.
