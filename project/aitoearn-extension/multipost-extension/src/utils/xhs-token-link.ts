export interface XhsNoteLinkResult {
  noteId: string;
  workLink: string;
  authorUserId?: string;
  xsecToken?: string;
  xsecSource?: string;
}

export function parseXhsNoteLink(href: string): XhsNoteLinkResult | undefined {
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
  const xsecSource = url.searchParams.get("xsec_source") || (xsecToken ? "pc_creatormng" : undefined);

  return {
    noteId,
    workLink: url.href,
    authorUserId: profileMatch?.[1],
    xsecToken,
    xsecSource,
  };
}

export function buildXhsExploreUrl(noteId: string) {
  const url = new URL(`https://www.xiaohongshu.com/explore/${noteId}`);
  url.searchParams.set("xsec_source", "pc_creatormng");
  return url.href;
}
