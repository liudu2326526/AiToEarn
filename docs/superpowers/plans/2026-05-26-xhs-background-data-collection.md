# XHS Background Data Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the XHS Bridge Chrome extension to autonomously collect work metrics, comments, and account data in the background on a schedule pushed by the backend, replacing the current frontend-triggered-only flow.

**Architecture:** The backend generates periodic sync tasks via BullMQ scheduler and pushes them to the Chrome extension through the existing WebSocket bridge. The extension executes tasks in hidden tabs, extracts data from `__INITIAL_STATE__`, and reports results back. The backend persists metrics to MongoDB for the data-cube API.

**Tech Stack:** NestJS (BullMQ, Mongoose, EventEmitter), Chrome Extension Manifest V3 (alarms, offscreen, scripting), MongoDB, WebSocket (ws library)

---

## File Structure

### Extension (`project/aitoearn-extension/xhs-bridge/`)

| File | Responsibility |
|------|---------------|
| `background.js` (modify) | Add alarm keepalive, hidden-tab task consumer, task queue management |
| `offscreen.js` (modify) | Forward `push_task` messages from backend to background, report results back |
| `manifest.json` (modify) | No changes needed — already has `alarms`, `offscreen`, `scripting`, `tabs` |

### Backend (`project/aitoearn-backend/`)

| File | Responsibility |
|------|---------------|
| `apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge-hub.ts` (modify) | Add `pushTaskToExtension()` method, track extension userId |
| `apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge.service.ts` (modify) | Expose hub for task pushing, handle `task_result` messages |
| `libs/channel-db/src/schemas/xhs-metric-snapshot.schema.ts` (create) | Schema for account-level metric snapshots |
| `libs/channel-db/src/schemas/xhs-work-metric.schema.ts` (create) | Schema for per-work metric time series |
| `libs/channel-db/src/schemas/xhs-sync-state.schema.ts` (create) | Schema for sync state per account (last sync, cookie validity) |
| `libs/channel-db/src/schemas/index.ts` (modify) | Register new schemas |
| `libs/channel-db/src/repositories/xhs-metric-snapshot.repository.ts` (create) | Repository for account snapshots |
| `libs/channel-db/src/repositories/xhs-work-metric.repository.ts` (create) | Repository for work metrics |
| `libs/channel-db/src/repositories/xhs-sync-state.repository.ts` (create) | Repository for sync state |
| `apps/aitoearn-server/src/core/xhs-data-sync/xhs-data-sync.module.ts` (create) | Module registration |
| `apps/aitoearn-server/src/core/xhs-data-sync/xhs-data-sync.scheduler.ts` (create) | Cron scheduler that generates sync tasks |
| `apps/aitoearn-server/src/core/xhs-data-sync/xhs-data-sync.consumer.ts` (create) | Processes task results from extension |
| `apps/aitoearn-server/src/core/channel/data-cube/xhs-data.service.ts` (modify) | Read real data from repositories instead of returning zeros |

---

## Phase 1: Extension Background Task Consumer

### Task 1: Add Alarm Keepalive to Extension

**Files:**
- Modify: `project/aitoearn-extension/xhs-bridge/background.js`

- [ ] **Step 1: Add alarm creation on install/startup**

```javascript
// Add after line 12 (after chrome.runtime.onStartup listener)
chrome.alarms.create('xhs-bridge-keepalive', { periodInMinutes: 1 })

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'xhs-bridge-keepalive') {
    ensureOffscreenDocument()
  }
})
```

- [ ] **Step 2: Verify alarm fires**

Load extension in Chrome → open `chrome://extensions` → inspect service worker → check console for offscreen document creation logs every ~1 minute.

- [ ] **Step 3: Commit**

```bash
git add project/aitoearn-extension/xhs-bridge/background.js
git commit -m "feat(xhs-bridge): add alarm keepalive to prevent service worker hibernation"
```

---

### Task 2: Add Hidden Tab Task Execution to Extension

**Files:**
- Modify: `project/aitoearn-extension/xhs-bridge/background.js`

- [ ] **Step 1: Add task queue and hidden tab management**

Add at the top of `background.js`, after existing constants:

```javascript
const TASK_INTERVAL_MS = 8000
let taskQueue = []
let isProcessingTask = false
let backgroundTabId = undefined
```

- [ ] **Step 2: Add task processing functions**

Add before the `handleCommand` function:

```javascript
async function processNextTask() {
  if (isProcessingTask || taskQueue.length === 0) return
  isProcessingTask = true

  const task = taskQueue.shift()
  try {
    const result = await executeBackgroundTask(task)
    sendTaskResult(task.id, result)
  } catch (error) {
    sendTaskResult(task.id, null, error instanceof Error ? error.message : String(error))
  } finally {
    isProcessingTask = false
    if (taskQueue.length > 0) {
      setTimeout(processNextTask, TASK_INTERVAL_MS)
    }
  }
}

async function executeBackgroundTask(task) {
  const url = task.params?.url
  if (!url || !url.startsWith(XHS_ORIGIN)) {
    throw new Error('无效的任务 URL')
  }

  const tab = await getOrCreateBackgroundTab(url)
  await waitForTabLoad(tab.id, 60000)
  await waitForTabDomStable(tab.id, 10000, 500)

  const result = await extractPageData(tab.id, task.params?.extractScript || '')
  return result
}

async function getOrCreateBackgroundTab(url) {
  if (backgroundTabId) {
    try {
      const tab = await chrome.tabs.get(backgroundTabId)
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { url })
        return tab
      }
    } catch {
      backgroundTabId = undefined
    }
  }

  const tab = await chrome.tabs.create({ url, active: false })
  backgroundTabId = tab.id
  return tab
}

async function waitForTabLoad(tabId, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId)
    if (tab.status === 'complete') return
    await sleep(250)
  }
  throw new Error('后台页面加载超时')
}

async function waitForTabDomStable(tabId, timeoutMs, intervalMs) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: async (timeout, interval) => {
      const getSignature = () => `${document.body?.innerText?.length || 0}:${document.images.length}:${document.querySelectorAll('*').length}`
      const deadline = Date.now() + timeout
      let lastSignature = ''
      let stableCount = 0
      while (Date.now() < deadline) {
        const signature = getSignature()
        if (signature === lastSignature) {
          stableCount += 1
          if (stableCount >= 2) return true
        } else {
          stableCount = 0
          lastSignature = signature
        }
        await new Promise(resolve => setTimeout(resolve, interval))
      }
      return true
    },
    args: [timeoutMs, intervalMs],
  })
}

async function extractPageData(tabId, extractScript) {
  const defaultScript = `
    (() => {
      if (window.__INITIAL_STATE__?.note?.noteDetailMap) {
        return JSON.stringify(window.__INITIAL_STATE__.note.noteDetailMap);
      }
      return "";
    })()
  `
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: (code) => globalThis.eval(code),
    args: [extractScript || defaultScript],
  })
  return results[0]?.result
}

function sendTaskResult(taskId, result, error) {
  sendToOffscreen({
    type: 'AITOBEE_XHS_TASK_RESULT',
    taskId,
    result,
    error,
  })
}
```

- [ ] **Step 3: Add message handler for incoming tasks**

Add a new case in the `chrome.runtime.onMessage.addListener` block:

```javascript
if (message.type === 'AITOBEE_XHS_PUSH_TASK') {
  taskQueue.push(message.task)
  processNextTask()
  sendResponse({ ok: true, queueLength: taskQueue.length })
  return true
}
```

- [ ] **Step 4: Manual test**

Send a test message from the offscreen document or popup to verify hidden tab creation and data extraction.

- [ ] **Step 5: Commit**

```bash
git add project/aitoearn-extension/xhs-bridge/background.js
git commit -m "feat(xhs-bridge): add hidden-tab background task consumer"
```

---

### Task 3: Add Task Push/Result Relay to Offscreen

**Files:**
- Modify: `project/aitoearn-extension/xhs-bridge/offscreen.js`

- [ ] **Step 1: Handle push_task messages from backend WebSocket**

In the `socket.addEventListener('message', ...)` handler, add handling for `push_task` method before the existing command forwarding:

```javascript
socket.addEventListener('message', async (event) => {
  const message = parseJson(event.data)
  if (!message?.id) return

  if (message.method === 'push_task') {
    chrome.runtime.sendMessage({
      target: 'background',
      type: 'AITOBEE_XHS_PUSH_TASK',
      task: { id: message.id, params: message.params || {} },
    }).then(response => {
      sendToBridge({ id: message.id, result: response })
    }).catch(error => {
      sendToBridge({ id: message.id, error: error.message || 'Failed to queue task' })
    })
    return
  }

  if (!message.method) return

  // ... existing command forwarding logic
})
```

- [ ] **Step 2: Handle task results from background**

Add a new message type handler in `chrome.runtime.onMessage.addListener`:

```javascript
if (message.type === 'AITOBEE_XHS_TASK_RESULT') {
  sendToBridge({
    id: message.taskId,
    method: 'task_result',
    result: message.result,
    error: message.error,
  })
  sendResponse({ ok: true })
  return true
}
```

- [ ] **Step 3: Commit**

```bash
git add project/aitoearn-extension/xhs-bridge/offscreen.js
git commit -m "feat(xhs-bridge): relay push_task and task_result between backend and background"
```

---

## Phase 2: Backend Hub Extension & Task Push Protocol

### Task 4: Extend XhsBridgeHub to Support Task Pushing

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge-hub.ts`

- [ ] **Step 1: Write the failing test**

Create test in `xhs-bridge-hub.spec.ts`:

```typescript
describe('pushTaskToExtension', () => {
  it('should send task to connected extension and resolve with result', async () => {
    const hub = new XhsBridgeHub()
    const extensionSocket = createMockSocket()
    hub.connectExtension(extensionSocket)

    const taskPromise = hub.pushTaskToExtension({
      method: 'push_task',
      params: { url: 'https://www.xiaohongshu.com/explore/abc123' },
    })

    const sentMessage = JSON.parse(extensionSocket.send.mock.calls[0][0])
    expect(sentMessage.method).toBe('push_task')

    hub.handleExtensionMessage(extensionSocket, JSON.stringify({
      id: sentMessage.id,
      result: { data: 'test' },
    }))

    const result = await taskPromise
    expect(result).toEqual({ data: 'test' })
  })

  it('should reject when extension is not connected', async () => {
    const hub = new XhsBridgeHub()
    await expect(hub.pushTaskToExtension({ method: 'push_task', params: {} }))
      .rejects.toThrow('AitoBee XHS Chrome 扩展未连接')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd project/aitoearn-backend && pnpm exec vitest run apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge-hub.spec.ts`
Expected: FAIL — `pushTaskToExtension` not defined

- [ ] **Step 3: Implement pushTaskToExtension**

Add to `XhsBridgeHub` class:

```typescript
pushTaskToExtension(task: { method: string, params?: Record<string, unknown> }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!this.extensionSocket || !this.isOpen(this.extensionSocket)) {
      reject(new Error('AitoBee XHS Chrome 扩展未连接'))
      return
    }

    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const timer = setTimeout(() => {
      this.pendingRequests.delete(id)
      reject(new Error(`XHS Bridge 任务超时：${task.method}`))
    }, this.requestTimeoutMs)

    const pseudoClient: BridgeSocket = {
      readyState: SOCKET_OPEN,
      send: (payload: string) => {
        const msg = JSON.parse(payload) as BridgeMessage
        clearTimeout(timer)
        this.pendingRequests.delete(id)
        if (msg.error) {
          reject(new Error(msg.error))
        } else {
          resolve(msg.result)
        }
      },
    }

    this.pendingRequests.set(id, { client: pseudoClient, timer })
    this.send(this.extensionSocket, { id, method: task.method, params: task.params })
  })
}

isExtensionOnline(): boolean {
  return this.isExtensionConnected()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd project/aitoearn-backend && pnpm exec vitest run apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge-hub.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add project/aitoearn-backend/apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge-hub.ts
git add project/aitoearn-backend/apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge-hub.spec.ts
git commit -m "feat(xhs-bridge): add pushTaskToExtension for backend-initiated data collection"
```

---

### Task 5: Expose Hub from XhsBridgeService

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge.service.ts`

- [ ] **Step 1: Expose hub and add task_result handling**

```typescript
@Injectable()
export class XhsBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(XhsBridgeService.name)
  private readonly hub = new XhsBridgeHub()
  private server?: WebSocketServer

  getHub(): XhsBridgeHub {
    return this.hub
  }

  isExtensionOnline(): boolean {
    return this.hub.isExtensionOnline()
  }

  async pushTask(params: Record<string, unknown>): Promise<unknown> {
    return this.hub.pushTaskToExtension({ method: 'push_task', params })
  }

  // ... rest unchanged
}
```

- [ ] **Step 2: Export service from module**

Verify `xhs-bridge.module.ts` exports `XhsBridgeService` (it should already).

- [ ] **Step 3: Commit**

```bash
git add project/aitoearn-backend/apps/aitoearn-server/src/core/xhs-bridge/xhs-bridge.service.ts
git commit -m "feat(xhs-bridge): expose pushTask method for scheduled data collection"
```

---

## Phase 3: MongoDB Schemas & Repositories

### Task 6: Create XHS Metric Snapshot Schema

**Files:**
- Create: `project/aitoearn-backend/libs/channel-db/src/schemas/xhs-metric-snapshot.schema.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/index.ts`

- [ ] **Step 1: Create schema file**

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'xhs_metric_snapshots' })
export class XhsMetricSnapshot extends BaseTemp {
  @Prop({ required: true, index: true })
  accountId: string

  @Prop({ required: true })
  fansCount: number

  @Prop({ required: true })
  workCount: number

  @Prop({ required: true })
  totalReadCount: number

  @Prop()
  totalLikeCount?: number

  @Prop()
  totalCollectCount?: number

  @Prop({ required: true })
  snapshotAt: Date
}

export const XhsMetricSnapshotSchema = SchemaFactory.createForClass(XhsMetricSnapshot)
XhsMetricSnapshotSchema.index({ accountId: 1, snapshotAt: -1 })
```

- [ ] **Step 2: Register in schemas/index.ts**

Add import and entry to the `schemas` array:

```typescript
import { XhsMetricSnapshot, XhsMetricSnapshotSchema } from './xhs-metric-snapshot.schema'

// Add to schemas array:
{ name: XhsMetricSnapshot.name, schema: XhsMetricSnapshotSchema },
```

- [ ] **Step 3: Commit**

```bash
git add project/aitoearn-backend/libs/channel-db/src/schemas/xhs-metric-snapshot.schema.ts
git add project/aitoearn-backend/libs/channel-db/src/schemas/index.ts
git commit -m "feat(channel-db): add XhsMetricSnapshot schema for account-level metrics"
```

---

### Task 7: Create XHS Work Metric Schema

**Files:**
- Create: `project/aitoearn-backend/libs/channel-db/src/schemas/xhs-work-metric.schema.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/index.ts`

- [ ] **Step 1: Create schema file**

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'xhs_work_metrics' })
export class XhsWorkMetric extends BaseTemp {
  @Prop({ required: true, index: true })
  accountId: string

  @Prop({ required: true, index: true })
  workId: string

  @Prop()
  title?: string

  @Prop({ required: true })
  likeCount: number

  @Prop({ required: true })
  collectCount: number

  @Prop({ required: true })
  commentCount: number

  @Prop({ required: true })
  shareCount: number

  @Prop({ required: true })
  snapshotAt: Date
}

export const XhsWorkMetricSchema = SchemaFactory.createForClass(XhsWorkMetric)
XhsWorkMetricSchema.index({ accountId: 1, workId: 1, snapshotAt: -1 })
```

- [ ] **Step 2: Register in schemas/index.ts**

```typescript
import { XhsWorkMetric, XhsWorkMetricSchema } from './xhs-work-metric.schema'

// Add to schemas array:
{ name: XhsWorkMetric.name, schema: XhsWorkMetricSchema },
```

- [ ] **Step 3: Commit**

```bash
git add project/aitoearn-backend/libs/channel-db/src/schemas/xhs-work-metric.schema.ts
git add project/aitoearn-backend/libs/channel-db/src/schemas/index.ts
git commit -m "feat(channel-db): add XhsWorkMetric schema for per-work time series"
```

---

### Task 8: Create XHS Sync State Schema

**Files:**
- Create: `project/aitoearn-backend/libs/channel-db/src/schemas/xhs-sync-state.schema.ts`
- Modify: `project/aitoearn-backend/libs/channel-db/src/schemas/index.ts`

- [ ] **Step 1: Create schema file**

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'xhs_sync_states' })
export class XhsSyncState extends BaseTemp {
  @Prop({ required: true, unique: true })
  accountId: string

  @Prop()
  lastSyncAt?: Date

  @Prop()
  lastWorkSyncAt?: Date

  @Prop({ default: true })
  cookieValid: boolean

  @Prop()
  errorMessage?: string

  @Prop({ default: 0 })
  consecutiveFailures: number
}

export const XhsSyncStateSchema = SchemaFactory.createForClass(XhsSyncState)
```

- [ ] **Step 2: Register in schemas/index.ts**

```typescript
import { XhsSyncState, XhsSyncStateSchema } from './xhs-sync-state.schema'

// Add to schemas array:
{ name: XhsSyncState.name, schema: XhsSyncStateSchema },
```

- [ ] **Step 3: Commit**

```bash
git add project/aitoearn-backend/libs/channel-db/src/schemas/xhs-sync-state.schema.ts
git add project/aitoearn-backend/libs/channel-db/src/schemas/index.ts
git commit -m "feat(channel-db): add XhsSyncState schema for sync tracking"
```

---

### Task 9: Create Repositories

**Files:**
- Create: `project/aitoearn-backend/libs/channel-db/src/repositories/xhs-metric-snapshot.repository.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/repositories/xhs-work-metric.repository.ts`
- Create: `project/aitoearn-backend/libs/channel-db/src/repositories/xhs-sync-state.repository.ts`

- [ ] **Step 1: Create XhsMetricSnapshotRepository**

```typescript
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { BaseRepository } from '@yikart/mongodb'
import { XhsMetricSnapshot } from '../schemas/xhs-metric-snapshot.schema'

@Injectable()
export class XhsMetricSnapshotRepository extends BaseRepository<XhsMetricSnapshot> {
  constructor(
    @InjectModel(XhsMetricSnapshot.name) model: Model<XhsMetricSnapshot>,
  ) {
    super(model)
  }

  async getLatestByAccountId(accountId: string) {
    return this.findOne({ accountId }, { sort: { snapshotAt: -1 } })
  }

  async listByAccountId(accountId: string, limit = 30) {
    return this.find({ accountId }, { sort: { snapshotAt: -1 }, limit })
  }
}
```

- [ ] **Step 2: Create XhsWorkMetricRepository**

```typescript
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { BaseRepository } from '@yikart/mongodb'
import { XhsWorkMetric } from '../schemas/xhs-work-metric.schema'

@Injectable()
export class XhsWorkMetricRepository extends BaseRepository<XhsWorkMetric> {
  constructor(
    @InjectModel(XhsWorkMetric.name) model: Model<XhsWorkMetric>,
  ) {
    super(model)
  }

  async getLatestByWorkId(accountId: string, workId: string) {
    return this.findOne({ accountId, workId }, { sort: { snapshotAt: -1 } })
  }

  async listByWorkId(accountId: string, workId: string, limit = 30) {
    return this.find({ accountId, workId }, { sort: { snapshotAt: -1 }, limit })
  }
}
```

- [ ] **Step 3: Create XhsSyncStateRepository**

```typescript
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { BaseRepository } from '@yikart/mongodb'
import { XhsSyncState } from '../schemas/xhs-sync-state.schema'

@Injectable()
export class XhsSyncStateRepository extends BaseRepository<XhsSyncState> {
  constructor(
    @InjectModel(XhsSyncState.name) model: Model<XhsSyncState>,
  ) {
    super(model)
  }

  async getByAccountId(accountId: string) {
    return this.findOne({ accountId })
  }

  async upsertByAccountId(accountId: string, update: Partial<XhsSyncState>) {
    return this.model.findOneAndUpdate(
      { accountId },
      { $set: update },
      { upsert: true, new: true, lean: true },
    )
  }
}
```

- [ ] **Step 4: Export repositories from channel-db**

Add exports to `libs/channel-db/src/repositories/index.ts` (or create if not exists).

- [ ] **Step 5: Commit**

```bash
git add project/aitoearn-backend/libs/channel-db/src/repositories/xhs-metric-snapshot.repository.ts
git add project/aitoearn-backend/libs/channel-db/src/repositories/xhs-work-metric.repository.ts
git add project/aitoearn-backend/libs/channel-db/src/repositories/xhs-sync-state.repository.ts
git commit -m "feat(channel-db): add repositories for XHS metric snapshots, work metrics, and sync state"
```

---

## Phase 4: Backend Scheduler & Task Consumer

### Task 10: Create XHS Data Sync Module

**Files:**
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/xhs-data-sync/xhs-data-sync.module.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/xhs-data-sync/xhs-data-sync.scheduler.ts`
- Create: `project/aitoearn-backend/apps/aitoearn-server/src/core/xhs-data-sync/xhs-data-sync.consumer.ts`

- [ ] **Step 1: Create the module**

```typescript
import { Module } from '@nestjs/common'
import { XhsBridgeModule } from '../xhs-bridge/xhs-bridge.module'
import { XhsDataSyncConsumer } from './xhs-data-sync.consumer'
import { XhsDataSyncScheduler } from './xhs-data-sync.scheduler'

@Module({
  imports: [XhsBridgeModule],
  providers: [XhsDataSyncScheduler, XhsDataSyncConsumer],
  exports: [XhsDataSyncConsumer],
})
export class XhsDataSyncModule {}
```

- [ ] **Step 2: Create the scheduler**

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { AccountType } from '@yikart/common'
import { AccountRepository } from '@yikart/mongodb'
import { XhsSyncStateRepository } from '@yikart/channel-db'
import { XhsBridgeService } from '../xhs-bridge/xhs-bridge.service'

@Injectable()
export class XhsDataSyncScheduler {
  private readonly logger = new Logger(XhsDataSyncScheduler.name)

  constructor(
    private readonly xhsBridgeService: XhsBridgeService,
    private readonly accountRepository: AccountRepository,
    private readonly syncStateRepository: XhsSyncStateRepository,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduleAccountSync() {
    if (!this.xhsBridgeService.isExtensionOnline()) {
      this.logger.debug('XHS Bridge extension offline, skipping sync')
      return
    }

    const accounts = await this.accountRepository.listByType(AccountType.Xhs)

    for (const account of accounts) {
      const syncState = await this.syncStateRepository.getByAccountId(account._id.toString())
      if (syncState && !syncState.cookieValid) continue
      if (syncState?.consecutiveFailures >= 5) continue

      try {
        await this.xhsBridgeService.pushTask({
          taskType: 'account_portrait',
          accountId: account._id.toString(),
          url: `https://www.xiaohongshu.com/user/profile/${account.platformAccountId}`,
        })
      } catch (error) {
        this.logger.error(error instanceof Error ? error : new Error(String(error)),
          `Failed to push sync task for account ${account._id}`)
      }

      await new Promise(resolve => setTimeout(resolve, 8000))
    }
  }
}
```

- [ ] **Step 3: Create the consumer (handles results from extension)**

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { XhsMetricSnapshotRepository } from '@yikart/channel-db'
import { XhsWorkMetricRepository } from '@yikart/channel-db'
import { XhsSyncStateRepository } from '@yikart/channel-db'

@Injectable()
export class XhsDataSyncConsumer {
  private readonly logger = new Logger(XhsDataSyncConsumer.name)

  constructor(
    private readonly snapshotRepository: XhsMetricSnapshotRepository,
    private readonly workMetricRepository: XhsWorkMetricRepository,
    private readonly syncStateRepository: XhsSyncStateRepository,
  ) {}

  async handleAccountPortraitResult(accountId: string, data: {
    fansCount: number
    workCount: number
    totalReadCount: number
  }) {
    await this.snapshotRepository.create({
      accountId,
      fansCount: data.fansCount,
      workCount: data.workCount,
      totalReadCount: data.totalReadCount,
      snapshotAt: new Date(),
    })

    await this.syncStateRepository.upsertByAccountId(accountId, {
      lastSyncAt: new Date(),
      cookieValid: true,
      consecutiveFailures: 0,
      errorMessage: undefined,
    })
  }

  async handleWorkMetricResult(accountId: string, workId: string, data: {
    title?: string
    likeCount: number
    collectCount: number
    commentCount: number
    shareCount: number
  }) {
    await this.workMetricRepository.create({
      accountId,
      workId,
      title: data.title,
      likeCount: data.likeCount,
      collectCount: data.collectCount,
      commentCount: data.commentCount,
      shareCount: data.shareCount,
      snapshotAt: new Date(),
    })
  }

  async handleSyncFailure(accountId: string, errorMessage: string) {
    const state = await this.syncStateRepository.getByAccountId(accountId)
    const failures = (state?.consecutiveFailures || 0) + 1
    const cookieValid = !errorMessage.includes('未登录') && !errorMessage.includes('login')

    await this.syncStateRepository.upsertByAccountId(accountId, {
      consecutiveFailures: failures,
      cookieValid,
      errorMessage,
    })
  }
}
```

- [ ] **Step 4: Register module in app.module.ts**

Add `XhsDataSyncModule` to the imports array of the main app module.

- [ ] **Step 5: Build verification**

Run: `cd project/aitoearn-backend && pnpm nx run aitoearn-server:build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add project/aitoearn-backend/apps/aitoearn-server/src/core/xhs-data-sync/
git commit -m "feat(xhs-data-sync): add scheduler and consumer for background XHS data collection"
```

---

## Phase 5: Wire Up Data Cube Service

### Task 11: Update XhsDataService to Read Real Data

**Files:**
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/channel/data-cube/xhs-data.service.ts`
- Modify: `project/aitoearn-backend/apps/aitoearn-server/src/core/channel/data-cube/data-cube.controller.ts`

- [ ] **Step 1: Replace stub implementation with repository reads**

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AccountType } from '@yikart/common'
import { AccountRepository } from '@yikart/mongodb'
import { XhsMetricSnapshotRepository, XhsWorkMetricRepository } from '@yikart/channel-db'
import { DataCubeBase } from './data.base'

@Injectable()
export class XhsDataService extends DataCubeBase {
  private readonly logger = new Logger(XhsDataService.name)

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly snapshotRepository: XhsMetricSnapshotRepository,
    private readonly workMetricRepository: XhsWorkMetricRepository,
  ) {
    super()
  }

  @OnEvent(`account.create.${AccountType.Xhs}`)
  async accountPortraitReport(accountId: string) {
    const res = await this.getAccountDataCube(accountId)
    await this.accountRepository.updateAccountStatistics(accountId, {
      fansCount: res.fensNum,
      workCount: res.arcNum,
      readCount: res.playNum,
    })
  }

  async getAccountDataCube(accountId: string) {
    const snapshot = await this.snapshotRepository.getLatestByAccountId(accountId)
    return {
      fensNum: snapshot?.fansCount ?? 0,
      arcNum: snapshot?.workCount ?? 0,
      playNum: snapshot?.totalReadCount ?? 0,
    }
  }

  async getAccountDataBulk(accountId: string) {
    const snapshots = await this.snapshotRepository.listByAccountId(accountId, 30)
    return {
      list: snapshots.map(s => ({
        fensNum: s.fansCount,
        arcNum: s.workCount,
        playNum: s.totalReadCount,
        date: s.snapshotAt,
      })),
    }
  }

  async getArcDataCube(accountId: string, dataId: string) {
    const metric = await this.workMetricRepository.getLatestByWorkId(accountId, dataId)
    return {
      fensNum: 0,
      likeNum: metric?.likeCount ?? 0,
      playNum: (metric?.likeCount ?? 0) + (metric?.collectCount ?? 0),
      commentNum: metric?.commentCount ?? 0,
    }
  }

  async getArcDataBulk(accountId: string, dataId: string) {
    const metrics = await this.workMetricRepository.listByWorkId(accountId, dataId, 30)
    return {
      recordId: dataId,
      dataId,
      list: metrics.map(m => ({
        likeNum: m.likeCount,
        collectNum: m.collectCount,
        commentNum: m.commentCount,
        shareNum: m.shareCount,
        date: m.snapshotAt,
      })),
    }
  }
}
```

- [ ] **Step 2: Register XHS in DataCubeController's dataCubeMap**

In `data-cube.controller.ts`, add XhsDataService to constructor and map:

```typescript
import { XhsDataService } from './xhs-data.service'

constructor(
  // ... existing services
  readonly xhsDataService: XhsDataService,
) {
  // ... existing registrations
  this.dataCubeMap.set(AccountType.Xhs, xhsDataService)
}
```

- [ ] **Step 3: Build verification**

Run: `cd project/aitoearn-backend && pnpm nx run aitoearn-server:build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add project/aitoearn-backend/apps/aitoearn-server/src/core/channel/data-cube/xhs-data.service.ts
git add project/aitoearn-backend/apps/aitoearn-server/src/core/channel/data-cube/data-cube.controller.ts
git commit -m "feat(data-cube): wire XhsDataService to real metric repositories and register in controller"
```

---

## Phase 6: Integration & End-to-End Verification

### Task 12: End-to-End Integration Test

**Files:**
- No new files — manual verification

- [ ] **Step 1: Start backend**

Run: `cd project/aitoearn-backend && pnpm nx serve aitoearn-server`
Verify: `AitoBee XHS Bridge listening on ws://127.0.0.1:9333` in logs

- [ ] **Step 2: Load extension in Chrome**

1. Open `chrome://extensions`
2. Enable Developer mode
3. Load unpacked → select `project/aitoearn-extension/xhs-bridge/`
4. Verify badge shows "ON" (WebSocket connected)

- [ ] **Step 3: Verify alarm keepalive**

Open extension service worker inspector → check that offscreen document stays alive for >5 minutes without user interaction.

- [ ] **Step 4: Test push_task manually**

From backend, call `xhsBridgeService.pushTask({ taskType: 'account_portrait', url: 'https://www.xiaohongshu.com/explore/...' })` and verify:
- Hidden tab opens in Chrome (not active)
- Data is extracted and returned
- Tab closes after extraction

- [ ] **Step 5: Verify data persistence**

Check MongoDB `xhs_metric_snapshots` collection for new documents after a successful task.

- [ ] **Step 6: Verify data-cube API**

Call `GET /channel/dataCube/accountDataCube/:accountId` for an XHS account and verify non-zero values.

---

## Summary of Constraints & Decisions

| Decision | Rationale |
|----------|-----------|
| Hidden tab (not offscreen) for page extraction | `chrome.offscreen` cannot run `chrome.scripting.executeScript` — only real tabs support `world: 'MAIN'` script injection |
| 8s interval between tasks | Avoid XHS rate limiting; single concurrent task |
| 30-min scheduler interval | Balance freshness vs. risk; configurable later |
| `consecutiveFailures >= 5` → skip | Prevent hammering accounts with expired cookies |
| Pseudo-client pattern in hub | Reuses existing pending-request infrastructure without adding a separate callback map |
| No BullMQ queue for now | Tasks are pushed directly via WebSocket; queue adds complexity without benefit when there's only one consumer (the extension). Can add later for multi-user routing |
