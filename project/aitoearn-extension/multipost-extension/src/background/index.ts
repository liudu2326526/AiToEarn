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
    await storage.set("trustedDomains", [
      {
        id: crypto.randomUUID(),
        domain: "multipost.app",
      },
    ]);
  }
}

chrome.runtime.onInstalled.addListener((object) => {
  if (object.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: "https://multipost.app/on-install" });
  }
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
};
starter(1000 * 30);
// Message Handler || 消息处理器 || END

// Keep Alive || 保活机制 || START
const quantumKeepAlive = new QuantumEntanglementKeepAlive();
quantumKeepAlive.startEntanglementProcess();
// Keep Alive || 保活机制 || END
