import type { PlasmoCSConfig } from "plasmo";

export const config: PlasmoCSConfig = {
  matches: ["*://creator.xiaohongshu.com/*"],
  run_at: "document_idle",
};

const PENDING_KEY = "xhs_pending_backfill";
const MAX_AGE_MS = 5 * 60 * 1000;

interface PendingBackfill {
  traceId: string;
  platform: string;
  ts: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 从笔记管理页抓取最新一条笔记的作品链接
async function findLatestNoteLink(timeout = 20000): Promise<string | undefined> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    // 策略 1: 笔记卡片 .note-card 的 data-impression 里含 noteId(审核中也有)
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".note-card[data-impression]"));
    for (const card of cards) {
      const raw = card.getAttribute("data-impression") || "";
      const noteId = raw.match(/"noteId"\s*:\s*"([A-Za-z0-9]+)"/)?.[1];
      if (noteId) {
        return `https://www.xiaohongshu.com/explore/${noteId}`;
      }
    }

    // 策略 2: 直接 a[href] 指向作品详情
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
    for (const a of anchors) {
      const href = a.href || "";
      if (/xiaohongshu\.com\/(?:explore|discovery\/item)\/[A-Za-z0-9]+/.test(href)) {
        return href;
      }
    }

    // 策略 3: 任意元素属性里的 noteId
    const idHolders = Array.from(document.querySelectorAll<HTMLElement>("[data-note-id], [data-id]"));
    for (const el of idHolders) {
      const noteId = el.getAttribute("data-note-id") || el.getAttribute("data-id");
      if (noteId && /^[a-f0-9]{20,}$/i.test(noteId)) {
        return `https://www.xiaohongshu.com/explore/${noteId}`;
      }
    }

    await sleep(1000);
  }
  return undefined;
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

  // 立刻消费标记，避免重复回扫
  await chrome.storage.local.remove(PENDING_KEY);

  const workLink = await findLatestNoteLink();
  console.log("[xhs-note-manager] 抓取到的作品链接:", workLink || "(未抓到)");

  // 抓到链接则回传 workLink，触发后端 backfill 入监控；
  // 抓不到(如审核中无链接)则保持 pendingConfirmation，由后端定时回扫兜底
  chrome.runtime.sendMessage({
    action: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
    data: {
      type: "MULTIPOST_EXTENSION_PUBLISH_RESULT",
      traceId: pending.traceId,
      platform: pending.platform,
      success: true,
      ...(workLink ? { workLink } : { pendingConfirmation: true }),
    },
  });
}

void run();
