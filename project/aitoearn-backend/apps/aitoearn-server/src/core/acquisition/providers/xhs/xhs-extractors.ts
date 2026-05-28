export const XHS_EXPAND_COMMENTS_SCRIPT = `
(async () => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const expandTexts = ['查看更多回复', '展开更多回复', '更多回复', '展开'];
  let clicked = 0;

  for (let round = 0; round < 3; round += 1) {
    const controls = Array.from(document.querySelectorAll('button, span, div'));
    for (const el of controls) {
      const text = (el.textContent || '').trim();
      if (text && expandTexts.some(item => text.includes(item))) {
        el.click();
        clicked += 1;
      }
    }

    const scroller = document.querySelector('.note-scroller') || document.scrollingElement || document.documentElement;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'instant' });
    await sleep(800);
  }

  return { clicked };
})()
`

export const XHS_CAPTURE_NOTE_STATE_EXPRESSION = `
(() => {
  const clean = value => String(value || '').replace(/\\s+/g, ' ').trim();
  const provincePattern = '北京|上海|广东|浙江|江苏|江西|山东|河南|四川|福建|湖北|湖南|重庆|天津|河北|山西|陕西|辽宁|吉林|黑龙江|安徽|云南|贵州|广西|海南|甘肃|青海|宁夏|新疆|西藏|内蒙古';

  const getXsecToken = () => {
    try {
      return new URL(window.location.href).searchParams.get('xsec_token') || '';
    }
    catch {
      return '';
    }
  };

  const parseCount = value => {
    const text = String(value || '').trim();
    const match = text.match(/^(\\d+(?:\\.\\d+)?)(?:\\s*)(w|万)?$/i);
    if (!match) return 0;

    const numeric = Number(match[1]);
    if (!Number.isFinite(numeric)) return 0;
    return match[2] ? Math.round(numeric * 10000) : Math.round(numeric);
  };

  const findMetaIndex = lines => lines.findIndex(item => {
    return new RegExp('(?:\\\\d{2}-\\\\d{2}|\\\\d+天前|昨天|今天|' + provincePattern + ')').test(item);
  });

  const parseCommentText = el => {
    const lines = String(el.innerText || el.textContent || '')
      .split('\\n')
      .map(item => item.trim())
      .filter(Boolean)
      .filter(item => !['回复', '查看更多回复', '展开更多回复'].includes(item));

    const userName = lines[0] || '';
    const metaIndex = findMetaIndex(lines);
    const contentLines = lines.slice(1, metaIndex > 1 ? metaIndex : lines.length);
    const metaText = metaIndex >= 0 ? lines[metaIndex] : '';
    const likeCount = metaIndex >= 0
      ? parseCount(lines.slice(metaIndex + 1).find(item => parseCount(item) > 0) || '')
      : 0;

    return {
      userName,
      content: clean(contentLines.join(' ')),
      metaText,
      likeCount,
    };
  };

  const parseMeta = metaText => {
    const dateMatch = String(metaText || '').match(/\\d{2}-\\d{2}|\\d+天前|昨天|今天/);
    const ipLocation = clean(String(metaText || '').replace(dateMatch?.[0] || '', ''));
    return {
      commentedAtText: dateMatch?.[0] || '',
      ipLocation,
    };
  };

  const noteId = window.location.pathname.match(/(?:explore|discovery\\/item)\\/([^/?#]+)/)?.[1] || '';
  const xsecToken = getXsecToken();
  const title = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
    || document.querySelector('title')?.textContent
    || '';
  const cover = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
  const commentCountText = document.querySelector('.comments-el, .comments-container')?.textContent || '';
  const commentCountMatch = commentCountText.match(/共\\s*(\\d+)\\s*条评论/);
  const commentCount = commentCountMatch ? Number(commentCountMatch[1]) : 0;

  const commentNodes = Array.from(document.querySelectorAll('.comment-item'));
  const comments = commentNodes.map((el, index) => {
    const parsed = parseCommentText(el);
    const meta = parseMeta(parsed.metaText);
    const isSub = String(el.className || '').includes('comment-item-sub');
    const parent = isSub ? el.closest('.parent-comment')?.querySelector('.comment-item:not(.comment-item-sub)') : null;
    const parentIndex = parent ? commentNodes.indexOf(parent) : -1;

    return {
      id: el.getAttribute('data-comment-id') || 'dom:' + noteId + ':' + index,
      parentCommentId: parentIndex >= 0 ? 'dom:' + noteId + ':' + parentIndex : '',
      userName: parsed.userName,
      userAvatar: el.querySelector('img')?.getAttribute('src') || '',
      content: parsed.content,
      likeCount: parsed.likeCount,
      ipLocation: meta.ipLocation,
      commentedAtText: meta.commentedAtText,
      xsecToken,
    };
  }).filter(item => item.userName && item.content);

  return JSON.stringify({
    location: window.location.href,
    note: {
      title: clean(title),
      cover,
      commentCount,
    },
    comments,
    hasMore: Boolean(document.body.innerText.includes('查看更多评论') || document.body.innerText.includes('正在加载')),
  });
})()
`
