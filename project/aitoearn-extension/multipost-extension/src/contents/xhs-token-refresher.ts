import type { PlasmoCSConfig } from "plasmo";
import { getElementCenterPoint } from "../utils/xhs-click-point";
import { parseXhsNoteLink, type XhsNoteLinkResult } from "../utils/xhs-token-link";

export const config: PlasmoCSConfig = {
  matches: ["*://creator.xiaohongshu.com/*"],
  run_at: "document_idle",
};

interface RefreshTokenRequest {
  noteId: string;
  publishRecordId: string;
  scanLatest?: boolean;
  publishTime?: number;
  apiBaseUrl?: string;
  authToken?: string;
}

interface NoteLinkSearchResult {
  status: "found" | "card-without-token" | "not-found";
  noteLink?: XhsNoteLinkResult;
}

function findNoteCard(noteId: string): HTMLElement | undefined {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".note-card[data-impression]"));
  return cards.find((card) => {
    const raw = card.getAttribute("data-impression") || "";
    const cardNoteId = raw.match(/"noteId"\s*:\s*"([A-Za-z0-9]+)"/)?.[1];
    return cardNoteId === noteId;
  });
}

// 在笔记管理页面查找指定 noteId 的笔记链接
async function findNoteLinkByNoteId(noteId: string, timeout = 60000): Promise<NoteLinkSearchResult> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    try {
      // 策略 1: 从页面 <a> 标签中查找（优先，因为审核通过后链接会包含 token）
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
      for (const a of anchors) {
        const noteLink = parseXhsNoteLink(a.href || "");
        if (!noteLink) continue;

        if (noteLink.noteId === noteId && noteLink.xsecToken) {
          console.log(`[XHS Token Refresher] Found note link with token: ${noteId}`);
          return { status: "found", noteLink };
        }
      }

      // 策略 2: 从笔记卡片的 data-impression 中查找 noteId
      const card = findNoteCard(noteId);
      if (card) {
        const link = card.querySelector<HTMLAnchorElement>("a[href]");
        if (link) {
          const noteLink = parseXhsNoteLink(link.href);
          if (noteLink?.xsecToken) {
            console.log(`[XHS Token Refresher] Found note link from card: ${noteId}`);
            return { status: "found", noteLink };
          }
        }
        console.log(`[XHS Token Refresher] Found note card without token link: ${noteId}`);
        return { status: "card-without-token" };
      }

      // 等待 1 秒后重试
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[XHS Token Refresher] Error during search:`, error);
      // 继续重试
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[XHS Token Refresher] Note link not found or no token: ${noteId}`);
  return { status: "not-found" };
}

// 扫描笔记管理页面最新的笔记链接（当 noteId 缺失时使用）
async function findLatestNoteLinkWithToken(timeout = 60000): Promise<XhsNoteLinkResult | undefined> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    try {
      // 从页面 <a> 标签中查找第一个带 token 的小红书链接
      const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
      for (const a of anchors) {
        const noteLink = parseXhsNoteLink(a.href || "");
        if (noteLink?.xsecToken) {
          console.log(`[XHS Token Refresher] Found latest note link with token`);
          return noteLink;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[XHS Token Refresher] Error during latest scan:`, error);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[XHS Token Refresher] No note link with token found in latest scan`);
  return undefined;
}

function openNoteCard(noteId: string) {
  const card = findNoteCard(noteId);
  if (!card) {
    return { success: false, message: "Note card not found" };
  }

  const target = card.querySelector<HTMLElement>(".note-card__cover") || card;
  const rect = target.getBoundingClientRect();
  const point = getElementCenterPoint(rect);
  if (!point) {
    return { success: false, message: "Note card cover is not clickable" };
  }

  console.log(`[XHS Token Refresher] Resolved note card click point: ${noteId}`, point);
  return { success: true, clickPoint: point };
}

// 监听来自 background 的刷新请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "REFRESH_XHS_TOKEN") {
    const request = message.data as RefreshTokenRequest;

    console.log(`[XHS Token Refresher] Received refresh request for note: ${request.noteId || "(scan latest)"}`);

    // 确保在笔记管理页面
    if (!location.href.includes("/note-manager")) {
      console.log(`[XHS Token Refresher] Not on note-manager page, navigating...`);
      location.href = "https://creator.xiaohongshu.com/creator/note-manager";
      sendResponse({ success: false, message: "Navigating to note-manager page" });
      return true;
    }

    // 根据是否有 noteId 选择扫描策略
    const scanPromise = (request.scanLatest || !request.noteId)
      ? findLatestNoteLinkWithToken(60000).then(noteLink => ({ status: noteLink ? "found" : "not-found", noteLink }) as NoteLinkSearchResult)
      : findNoteLinkByNoteId(request.noteId, 60000);

    scanPromise
      .then((result) => {
        const noteLink = result.noteLink;
        if (noteLink?.xsecToken) {
          // 从 workLink 中提取 noteId
          const extractedNoteId = noteLink.workLink.match(/\/(?:explore|discovery\/item)\/([A-Za-z0-9]+)/)?.[1]
            || request.noteId;

          // 找到带 token 的链接，回传给 background
          chrome.runtime.sendMessage({
            action: "XHS_TOKEN_FOUND",
            data: {
              publishRecordId: request.publishRecordId,
              noteId: extractedNoteId,
              workLink: noteLink.workLink,
              xsecToken: noteLink.xsecToken,
              xsecSource: noteLink.xsecSource,
              authorUserId: noteLink.authorUserId,
              apiBaseUrl: request.apiBaseUrl,
              authToken: request.authToken,
            },
          });
          sendResponse({ success: true, noteLink });
        } else if (result.status === "card-without-token") {
          sendResponse({
            success: false,
            reason: "CARD_FOUND_WITHOUT_TOKEN",
            canOpenDetail: true,
            message: "Note card found but no token link",
          });
        } else {
          sendResponse({ success: false, message: "Note link not found or no token" });
        }
      })
      .catch((error) => {
        console.error(`[XHS Token Refresher] Error:`, error);
        sendResponse({ success: false, message: error.message });
      });

    return true; // 保持消息通道开启
  }

  if (message.action === "OPEN_XHS_NOTE_CARD") {
    const request = message.data as RefreshTokenRequest;
    sendResponse(openNoteCard(request.noteId));
    return true;
  }
});

console.log("[XHS Token Refresher] Content script loaded");
