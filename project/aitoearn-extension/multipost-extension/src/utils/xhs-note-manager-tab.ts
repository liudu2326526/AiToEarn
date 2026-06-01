export interface XhsNoteManagerTabLike {
  id?: number;
  url?: string;
  active?: boolean;
  highlighted?: boolean;
  groupId?: number;
  lastAccessed?: number;
}

function isXhsNoteManagerTab(tab: XhsNoteManagerTabLike) {
  return Boolean(tab.id && tab.url?.includes("creator.xiaohongshu.com") && tab.url.includes("/note-manager"));
}

function getTabScore(tab: XhsNoteManagerTabLike) {
  let score = 0;
  if (tab.url?.includes("/new/note-manager")) score += 1000;
  if (tab.active) score += 500;
  if (tab.highlighted) score += 250;
  if (typeof tab.groupId === "number" && tab.groupId >= 0) score += 100;
  if (typeof tab.lastAccessed === "number") score += Math.floor(tab.lastAccessed / 1000);
  return score;
}

export function selectBestXhsNoteManagerTab<T extends XhsNoteManagerTabLike>(tabs: T[]): T | undefined {
  return tabs
    .filter(isXhsNoteManagerTab)
    .sort((a, b) => {
      const scoreDiff = getTabScore(b) - getTabScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.id || 0) - (a.id || 0);
    })[0];
}
