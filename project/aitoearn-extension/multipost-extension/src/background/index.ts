import { Storage } from "@plasmohq/storage";
import { getAllAccountInfo } from "~sync/account";
import {
  // injectScriptsToTabs,
  type SyncData,
  type SyncDataPlatform,
  createTabsForPlatforms,
  getPlatformInfos,
} from "~sync/common";
import type { ExtensionPublishResultEvent } from "~types/external";
import QuantumEntanglementKeepAlive from "../utils/keep-alive";
import type { ClickPoint } from "../utils/xhs-click-point";
import { selectBestXhsNoteManagerTab, type XhsNoteManagerTabLike } from "../utils/xhs-note-manager-tab";
import { buildXhsExploreUrl, parseXhsNoteLink, type XhsNoteLinkResult } from "../utils/xhs-token-link";
import { linkExtensionMessageHandler, starter } from "./services/api";
import {
  addTabsManagerMessages,
  tabsManagerHandleTabRemoved,
  tabsManagerHandleTabUpdated,
  tabsManagerMessageHandler,
} from "./services/tabs";
import { trustDomainMessageHandler } from "./services/trust-domain";

const storage = new Storage({
  area: "local",
});

async function initDefaultTrustedDomains() {
  const trustedDomains = await storage.get<Array<{ id: string; domain: string }>>("trustedDomains");
  if (!trustedDomains) {
    await storage.set("trustedDomains", []);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  initDefaultTrustedDomains();
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

// Listen Message || 监听消息 || START
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  defaultMessageHandler(request, sender, sendResponse);
  tabsManagerMessageHandler(request, sender, sendResponse);
  trustDomainMessageHandler(request, sender, sendResponse);
  linkExtensionMessageHandler(request, sender, sendResponse);
  return true;
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  tabsManagerHandleTabUpdated(tabId, changeInfo, tab);
});
chrome.tabs.onRemoved.addListener((tabId) => {
  tabsManagerHandleTabRemoved(tabId);
});
// Listen Message || 监听消息 || END

// Message Handler || 消息处理器 || START
let currentSyncData: SyncData | null = null;
let currentPublishPopup: chrome.windows.Window | null = null;
const publishTraceSourceTabs = new Map<string, number>();

const defaultMessageHandler = (request, sender, sendResponse) => {
  if (request.action === "MULTIPOST_EXTENSION_CHECK_SERVICE_STATUS") {
    sendResponse({ extensionId: chrome.runtime.id });
  }
  if (request.action === "MULTIPOST_EXTENSION_PUBLISH") {
    const data = request.data as SyncData;
    currentSyncData = data;
    (async () => {
      currentPublishPopup = await chrome.windows.create({
        url: chrome.runtime.getURL("tabs/publish.html"),
        type: "popup",
        width: 800,
        height: 600,
      });
    })();
  }
  if (request.action === "MULTIPOST_EXTENSION_PLATFORMS") {
    getPlatformInfos().then((platforms) => {
      sendResponse({ platforms });
    });
  }
  if (request.action === "MULTIPOST_EXTENSION_GET_ACCOUNT_INFOS") {
    getAllAccountInfo().then((accountInfo) => {
      sendResponse({ accountInfo });
    });
  }
  if (request.action === "MULTIPOST_EXTENSION_OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ extensionId: chrome.runtime.id });
  }
  if (request.action === "MULTIPOST_EXTENSION_REFRESH_ACCOUNT_INFOS") {
    chrome.windows.create({
      url: chrome.runtime.getURL("tabs/refresh-accounts.html"),
      type: "popup",
      width: 800,
      height: 600,
      focused: request.data.isFocused || false,
    });
  }
  if (request.action === "MULTIPOST_EXTENSION_PUBLISH_REQUEST_SYNC_DATA") {
    sendResponse({ syncData: currentSyncData });
  }
  if (request.action === "MULTIPOST_EXTENSION_PUBLISH_NOW") {
    const data = request.data as SyncData;
    if (Array.isArray(data.platforms) && data.platforms.length > 0) {
      (async () => {
        try {
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
          const tracedData = {
            ...data,
            publishTraceId: request.traceId,
          };
          const tabs = await createTabsForPlatforms(tracedData);
          // await injectScriptsToTabs(tabs, data);

          addTabsManagerMessages({
            syncData: tracedData,
            tabs: tabs.map((t: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }) => ({
              tab: t.tab,
              platformInfo: t.platformInfo,
            })),
          });

          // for (const t of tabs) {
          //   if (t.tab.id) {
          //     await chrome.tabs.update(t.tab.id, { active: true });
          //     await new Promise((resolve) => setTimeout(resolve, 2000));
          //   }
          // }
          if (currentPublishPopup) {
            await chrome.windows.update(currentPublishPopup.id, { focused: true });
          }

          sendResponse({
            accepted: true,
            traceId: request.traceId,
            tabs: tabs.map((t: { tab: chrome.tabs.Tab; platformInfo: SyncDataPlatform }) => ({
              id: t.tab.id,
              url: t.tab.url,
              platform: t.platformInfo.name,
            })),
          });
        } catch (error) {
          console.error("创建标签页或分组时出错:", error);
          const message = error instanceof Error ? error.message : String(error);
          sendResponse({
            accepted: false,
            traceId: request.traceId,
            tabs: [],
            error: message,
          });
        }
      })();
    } else {
      sendResponse({
        accepted: false,
        traceId: request.traceId,
        tabs: [],
        error: "MultiPost publish failed: no platforms provided",
      });
    }
  }
  if (request.action === "MULTIPOST_EXTENSION_PUBLISH_RESULT") {
    const result = request.data as ExtensionPublishResultEvent;
    const sourceTabId = publishTraceSourceTabs.get(result.traceId);
    if (sourceTabId) {
      chrome.tabs.sendMessage(sourceTabId, {
        type: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
        data: result,
      });
      // 仅在拿到最终结果(带 workLink 的成功 或 失败)时清理；
      // pendingConfirmation 表示已提交但等待回扫 workLink，需保留映射
      const isFinal = result.error || (result.success && !result.pendingConfirmation);
      if (isFinal) {
        publishTraceSourceTabs.delete(result.traceId);
      }
    }
    sendResponse({ received: true });
  }
  if (request.action === "MULTIPOST_EXTENSION_REFRESH_XHS_TOKEN") {
    handleRefreshTokenRequest(request.data)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
  }
  if (request.action === "XHS_TOKEN_FOUND") {
    handleTokenFound(request.data)
      .then(sendResponse)
      .catch((error) => {
        console.error("[Background] Failed to handle token found:", error);
        sendResponse({ success: false, error: error.message });
      });
  }
};

// 处理刷新 Token 请求
async function handleRefreshTokenRequest(data: {
  noteId: string;
  publishRecordId: string;
  scanLatest?: boolean;
  publishTime?: number;
  apiBaseUrl?: string;
  authToken?: string;
}) {
  console.log(`[Background] Refresh token request for note: ${data.noteId || "(scan latest)"}`);

  // 查找或创建小红书笔记管理页面，避免把正在编辑/发布的标签页导航走
  let targetTab = await findBestXhsNoteManagerTab();

  if (!targetTab) {
    // 创建新标签页
    targetTab = await chrome.tabs.create({
      url: "https://creator.xiaohongshu.com/creator/note-manager",
      active: false, // 后台打开
    });

    await waitForTabComplete(targetTab.id!, 10000);
  }

  const response = await sendRefreshTokenMessage(targetTab.id!, data);
  if (response?.success || !data.noteId || !response?.canOpenDetail) {
    return response;
  }

  console.log(`[Background] Trying detail page fallback for note: ${data.noteId}`);
  const noteLink = await waitForXhsTokenUrl(data.noteId, async () => {
    const openResponse = await chrome.tabs.sendMessage(targetTab!.id!, {
      action: "OPEN_XHS_NOTE_CARD",
      data,
    }).catch((error) => ({ success: false, error: error.message }));

    if (openResponse?.success && openResponse.clickPoint) {
      await dispatchDebuggerClick(targetTab!.id!, openResponse.clickPoint);
      return;
    }

    if (!openResponse?.success) {
      console.warn("[Background] Could not click note card, opening fallback detail URL:", openResponse);
      await chrome.tabs.create({
        url: buildXhsExploreUrl(data.noteId),
        active: false,
      });
    }
  }, 15000);

  if (!noteLink?.xsecToken) {
    return {
      success: false,
      error: "XHS detail page opened but token was not found",
      detailFallback: true,
      originalResponse: response,
    };
  }

  await handleTokenFound({
    ...data,
    noteId: noteLink.noteId,
    workLink: noteLink.workLink,
    xsecToken: noteLink.xsecToken,
    xsecSource: noteLink.xsecSource,
    authorUserId: noteLink.authorUserId,
  });

  return { success: true, noteLink, detailFallback: true };
}

async function findBestXhsNoteManagerTab() {
  const [creatorTabs, newTabs] = await Promise.all([
    chrome.tabs.query({ url: "*://creator.xiaohongshu.com/creator/note-manager*" }),
    chrome.tabs.query({ url: "*://creator.xiaohongshu.com/new/note-manager*" }),
  ]);
  const tabsById = new Map<number, chrome.tabs.Tab & XhsNoteManagerTabLike>();

  for (const tab of [...newTabs, ...creatorTabs] as Array<chrome.tabs.Tab & XhsNoteManagerTabLike>) {
    if (tab.id) {
      tabsById.set(tab.id, tab);
    }
  }

  const targetTab = selectBestXhsNoteManagerTab([...tabsById.values()]);
  if (targetTab) {
    console.log(`[Background] Selected XHS note manager tab: ${targetTab.id}`);
  }
  return targetTab;
}

async function dispatchDebuggerClick(tabId: number, point: ClickPoint) {
  const target = { tabId };
  const dispatch = (params: Record<string, unknown>) =>
    chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", params);

  console.log(`[Background] Dispatching real mouse click via debugger at (${point.x}, ${point.y})`);

  await focusTabForDebuggerClick(tabId);
  await chrome.debugger.attach(target, "1.3");
  try {
    await dispatch({
      type: "mouseMoved",
      x: point.x,
      y: point.y,
      button: "none",
    });
    await dispatch({
      type: "mousePressed",
      x: point.x,
      y: point.y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    await dispatch({
      type: "mouseReleased",
      x: point.x,
      y: point.y,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
  } finally {
    await chrome.debugger.detach(target).catch((error) => {
      console.warn("[Background] Failed to detach debugger:", error);
    });
  }
}

async function focusTabForDebuggerClick(tabId: number) {
  const tab = await chrome.tabs.get(tabId);
  if (typeof tab.windowId === "number") {
    await chrome.windows.update(tab.windowId, { focused: true }).catch((error) => {
      console.warn("[Background] Failed to focus XHS window before click:", error);
    });
  }

  await chrome.tabs.update(tabId, { active: true });
  await new Promise((resolve) => setTimeout(resolve, 300));
}

async function sendRefreshTokenMessage(tabId: number, data: {
  noteId: string;
  publishRecordId: string;
  scanLatest?: boolean;
  publishTime?: number;
  apiBaseUrl?: string;
  authToken?: string;
}) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      action: "REFRESH_XHS_TOKEN",
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[Background] Refresh content script unavailable, reloading note manager:", message);
    await chrome.tabs.reload(tabId);
    await waitForTabComplete(tabId, 10000);
    return chrome.tabs.sendMessage(tabId, {
      action: "REFRESH_XHS_TOKEN",
      data,
    });
  }
}

async function waitForTabComplete(tabId: number, timeoutMs: number) {
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      console.warn("[Background] Page load timeout, proceeding anyway");
      cleanup();
      resolve();
    }, timeoutMs);

    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timeout);
    };

    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        cleanup();
        console.log("[Background] Page loaded successfully");
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function waitForXhsTokenUrl(noteId: string, trigger: () => Promise<void>, timeoutMs: number): Promise<XhsNoteLinkResult | undefined> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      cleanup();
      resolve(undefined);
    }, timeoutMs);

    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      chrome.tabs.onCreated.removeListener(onCreated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };

    const inspectUrl = (url?: string) => {
      if (!url) return false;
      const noteLink = parseXhsNoteLink(url);
      if (noteLink?.noteId === noteId && noteLink.xsecToken) {
        console.log(`[Background] Captured XHS detail URL with token: ${noteId}`);
        cleanup();
        resolve(noteLink);
        return true;
      }
      return false;
    };

    const onCreated = (tab: chrome.tabs.Tab) => {
      inspectUrl(tab.pendingUrl) || inspectUrl(tab.url);
    };

    const onUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      inspectUrl(changeInfo.url) || inspectUrl(tab.pendingUrl) || inspectUrl(tab.url);
    };

    chrome.tabs.onCreated.addListener(onCreated);
    chrome.tabs.onUpdated.addListener(onUpdated);

    chrome.tabs.query({}).then((tabs) => {
      for (const tab of tabs) {
        if (inspectUrl(tab.pendingUrl) || inspectUrl(tab.url)) return;
      }
      return trigger();
    }).catch((error) => {
      cleanup();
      reject(error);
    });
  });
}

// 处理 Token 找到的通知
async function handleTokenFound(data: {
  publishRecordId: string;
  noteId: string;
  workLink: string;
  xsecToken: string;
  xsecSource?: string;
  authorUserId?: string;
  apiBaseUrl?: string;
  authToken?: string;
}) {
  console.log(`[Background] Token found for note: ${data.noteId}`);

  // 从 storage 获取后端 API 地址和认证信息
  const apiBaseUrl = data.apiBaseUrl || await storage.get<string>("apiBaseUrl") || "http://localhost:3002";
  const authToken = data.authToken || await storage.get<string>("authToken");

  if (!authToken) {
    console.warn("[Background] No auth token found, cannot update token");
    throw new Error("No auth token found");
  }

  // 调用后端 API 更新 Token，带重试机制
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Background] Updating token (attempt ${attempt}/${maxRetries})`);

      const response = await fetch(`${apiBaseUrl}/plat/publish/updateTokenFromPlugin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          publishRecordId: data.publishRecordId,
          noteId: data.noteId,
          workLink: data.workLink,
          xsecToken: data.xsecToken,
          xsecSource: data.xsecSource,
          authorUserId: data.authorUserId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log(`[Background] Token updated successfully:`, result);
      return { success: true };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Background] Attempt ${attempt} failed:`, lastError.message);

      // 如果不是最后一次尝试，等待后重试
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 指数退避，最多 5 秒
        console.log(`[Background] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // 所有重试都失败
  console.error(`[Background] Failed to update token after ${maxRetries} attempts:`, lastError);
  throw lastError;
}

starter(1000 * 30);
// Message Handler || 消息处理器 || END

// Keep Alive || 保活机制 || START
const quantumKeepAlive = new QuantumEntanglementKeepAlive();
quantumKeepAlive.startEntanglementProcess();
// Keep Alive || 保活机制 || END
