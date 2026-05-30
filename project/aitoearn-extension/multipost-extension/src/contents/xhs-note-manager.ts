import type { PlasmoCSConfig } from "plasmo";

export const config: PlasmoCSConfig = {
  matches: ["*://creator.xiaohongshu.com/*"],
  run_at: "document_idle",
};

const PENDING_KEY = "xhs_pending_backfill";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PENDING_REPORT_INTERVAL_MS = 60 * 1000;

interface PendingBackfill {
  traceId: string;
  platform: string;
  ts: number;
  lastPendingReportAt?: number;
}

interface NoteLinkResult {
  workLink: string;
  authorUserId?: string;
  xsecToken?: string;
  xsecSource?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildExploreLink(noteId: string, xsecToken?: string, xsecSource?: string) {
  const url = new URL(`https://www.xiaohongshu.com/explore/${noteId}`);
  if (xsecToken) {
    url.searchParams.set("xsec_token", xsecToken);
    url.searchParams.set("xsec_source", xsecSource || "pc_user");
  }
  return url.toString();
}

function parseNoteLink(href: string): NoteLinkResult | undefined {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return undefined;
  }

  if (!/(^|\.)xiaohongshu\.com$/.test(url.hostname)) return undefined;

  const exploreMatch = url.pathname.match(/\/(?:explore|discovery\/item)\/([A-Za-z0-9]+)/);
  const profileMatch = url.pathname.match(/\/user\/profile\/([^/?#]+)\/([A-Za-z0-9]+)/);
  const noteId = exploreMatch?.[1] || profileMatch?.[2];
  if (!noteId) return undefined;

  const xsecToken = url.searchParams.get("xsec_token") || undefined;
  const xsecSource = url.searchParams.get("xsec_source") || (xsecToken ? "pc_user" : undefined);

  return {
    workLink: buildExploreLink(noteId, xsecToken, xsecSource),
    authorUserId: profileMatch?.[1],
    xsecToken,
    xsecSource,
  };
}

// 从笔记管理页抓取最新一条笔记的作品链接
async function findLatestNoteLink(timeout = 20000): Promise<NoteLinkResult | undefined> {
  const startedAt = Date.now();
  let fallbackNoteLink: NoteLinkResult | undefined;
  while (Date.now() - startedAt < timeout) {
    // 策略 1: 优先取页面真实 a[href]，其中可能包含 xsec_token 和作者 userId
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
    for (const a of anchors) {
      const noteLink = parseNoteLink(a.href || "");
      if (!noteLink) continue;
      if (noteLink.xsecToken) return noteLink;
      fallbackNoteLink ||= noteLink;
    }

    // 策略 2: 笔记卡片 .note-card 的 data-impression 里含 noteId(审核中也有)
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".note-card[data-impression]"));
    for (const card of cards) {
      const raw = card.getAttribute("data-impression") || "";
      const noteId = raw.match(/"noteId"\s*:\s*"([A-Za-z0-9]+)"/)?.[1];
      if (noteId) {
        fallbackNoteLink ||= { workLink: buildExploreLink(noteId) };
      }
    }

    // 策略 3: 任意元素属性里的 noteId
    const idHolders = Array.from(document.querySelectorAll<HTMLElement>("[data-note-id], [data-id]"));
    for (const el of idHolders) {
      const noteId = el.getAttribute("data-note-id") || el.getAttribute("data-id");
      if (noteId && /^[a-f0-9]{20,}$/i.test(noteId)) {
        fallbackNoteLink ||= { workLink: buildExploreLink(noteId) };
      }
    }

    await sleep(1000);
  }
  return fallbackNoteLink;
}

async function run() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;

  const stored = await chrome.storage.local.get(PENDING_KEY);
  const pending = stored[PENDING_KEY] as PendingBackfill | undefined;
  if (!pending?.traceId) return;

  // 过期标记直接清理
  if (Date.now() - pending.ts > MAX_AGE_MS) {
    await chrome.storage.local.remove(PENDING_KEY);
    return;
  }

  // 仅在笔记管理页执行回扫
  if (!location.href.includes("/note-manager")) return;

  console.log("[xhs-note-manager] 检测到待回扫任务", pending);

  const noteLink = await findLatestNoteLink(60000);
  console.log("[xhs-note-manager] 抓取到的作品链接:", noteLink?.workLink || "(未抓到)");

  // 抓到带 token 的链接才回传 workLink 并消费标记，触发后端 backfill 入监控。
  // 审核中通常只能拿到裸 noteId，继续保留标记，待审核通过后下次进入笔记管理页再补链路。
  if (noteLink?.xsecToken) {
    await chrome.storage.local.remove(PENDING_KEY);
  } else {
    const now = Date.now();
    await chrome.storage.local.set({
      [PENDING_KEY]: {
        ...pending,
        lastPendingReportAt: now,
      },
    });

    if (pending.lastPendingReportAt && now - pending.lastPendingReportAt < PENDING_REPORT_INTERVAL_MS) {
      return;
    }
  }

  chrome.runtime.sendMessage({
    action: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
    data: {
      type: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
      traceId: pending.traceId,
      platform: pending.platform,
      success: true,
      ...(noteLink?.xsecToken ? noteLink : { pendingConfirmation: true }),
    },
  });
}

void run();
