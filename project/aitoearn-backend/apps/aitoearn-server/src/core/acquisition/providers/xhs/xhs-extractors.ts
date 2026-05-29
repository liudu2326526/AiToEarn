// 在个人主页读取所有作品链接(href 天然带 xsec_token & xsec_source=pc_user)
export const XHS_CAPTURE_PROFILE_NOTE_LINKS_EXPRESSION = `
(() => {
  const result = [];
  const seen = new Set();
  const anchors = Array.from(document.querySelectorAll('a[href*="/explore/"]'));
  for (const a of anchors) {
    try {
      const u = new URL(a.href, location.origin);
      const m = u.pathname.match(/\\/explore\\/([A-Za-z0-9]+)/);
      const noteId = m && m[1];
      const token = u.searchParams.get('xsec_token') || '';
      if (noteId && token && !seen.has(noteId)) {
        seen.add(noteId);
        result.push({ noteId: noteId, xsecToken: token });
      }
    }
    catch (e) {}
  }
  return JSON.stringify({ notes: result });
})()
`

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
    const text = String(value || '').replace(/,/g, '').replace(/\\s+/g, '').replace(/\\+/g, '').trim();
    const match = text.match(/(\\d+(?:\\.\\d+)?)(w|万|k|千)?/i);
    if (!match) return 0;

    const numeric = Number(match[1]);
    if (!Number.isFinite(numeric)) return 0;
    if (/^(w|万)$/i.test(match[2] || '')) return Math.round(numeric * 10000);
    if (/^(k|千)$/i.test(match[2] || '')) return Math.round(numeric * 1000);
    return Math.round(numeric);
  };

  const readObjectValue = (source, keys) => {
    if (!source || typeof source !== 'object') return undefined;
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
    }
    return undefined;
  };

  const pickImageUrl = value => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      for (const item of value) {
        const url = pickImageUrl(item);
        if (url) return url;
      }
      return '';
    }
    if (typeof value === 'object') {
      return readObjectValue(value, ['url', 'urlDefault', 'url_default', 'urlPre', 'url_pre', 'src', 'href']) || '';
    }
    return '';
  };

  const extractNoteCover = note => {
    const coverValue = pickImageUrl(readObjectValue(note, ['cover', 'image', 'thumbnail']));
    if (coverValue) return coverValue;
    return pickImageUrl(readObjectValue(note, ['imageList', 'image_list', 'images', 'image_list_v2']));
  };

  const pickInteractInfo = note => note?.interactInfo || note?.interact_info || note?.interact || {};

  const findStateNote = () => {
    const stateNames = ['__INITIAL_STATE__', '__INITIAL_SSR_STATE__', '__INITIAL_DATA__', '__NEXT_DATA__'];
    const seen = new WeakSet();
    const matchesNoteId = item => {
      const id = readObjectValue(item, ['noteId', 'note_id', 'id', 'id_str', 'note_id_str']);
      return noteId && id && String(id) === noteId;
    };
    const hasMetrics = item => {
      const interact = pickInteractInfo(item);
      return Boolean(
        readObjectValue(interact, ['likedCount', 'liked_count', 'likeCount', 'like_count'])
        || readObjectValue(interact, ['collectedCount', 'collected_count', 'collectCount', 'collect_count'])
        || readObjectValue(interact, ['sharedCount', 'shared_count', 'shareCount', 'share_count'])
        || readObjectValue(interact, ['commentCount', 'comment_count'])
      );
    };
    const walk = (value, depth = 0) => {
      if (!value || typeof value !== 'object' || depth > 8 || seen.has(value)) return null;
      seen.add(value);

      if (matchesNoteId(value) && hasMetrics(value)) return value;
      if (value.note && typeof value.note === 'object' && matchesNoteId(value.note) && hasMetrics(value.note)) return value.note;
      if (!noteId && hasMetrics(value) && (value.title || value.desc || value.body)) return value;

      if (Array.isArray(value)) {
        for (const item of value) {
          const matched = walk(item, depth + 1);
          if (matched) return matched;
        }
        return null;
      }

      for (const key of Object.keys(value)) {
        const child = value[key];
        if (noteId && String(key).includes(noteId) && child && typeof child === 'object' && hasMetrics(child)) return child;
        const matched = walk(child, depth + 1);
        if (matched) return matched;
      }
      return null;
    };

    for (const name of stateNames) {
      const matched = walk(window[name]);
      if (matched) return matched;
    }
    return null;
  };

  const readDomActionCount = (keywords, selectors) => {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const count = parseCount(el?.textContent || '');
      if (count) return count;
    }

    const nodes = Array.from(document.querySelectorAll('button, [role="button"], span, div'));
    for (const el of nodes) {
      const text = clean(el.innerText || el.textContent || '');
      if (!text || text.length > 40 || !keywords.some(keyword => text.includes(keyword))) continue;

      const directCount = parseCount(text);
      if (directCount) return directCount;

      const nearby = [
        el.nextElementSibling,
        el.previousElementSibling,
        ...(el.parentElement ? Array.from(el.parentElement.children) : []),
      ];
      for (const item of nearby) {
        const count = parseCount(item?.textContent || '');
        if (count) return count;
      }
    }
    return 0;
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
  const stateNote = findStateNote();
  const cover = extractNoteCover(stateNote)
    || document.querySelector('meta[property="og:image"]')?.getAttribute('content')
    || document.querySelector('meta[name="twitter:image"]')?.getAttribute('content')
    || document.querySelector('.note-slider-img, .swiper-slide img, .note-content img, img[src*="xhscdn"]')?.getAttribute('src')
    || '';
  const stateInteractInfo = pickInteractInfo(stateNote);
  const commentCountText = document.querySelector('.comments-el, .comments-container')?.textContent || '';
  const commentCountMatch = commentCountText.match(/共\\s*(\\d+)\\s*条评论/);
  const commentCount = commentCountMatch
    ? Number(commentCountMatch[1])
    : parseCount(readObjectValue(stateInteractInfo, ['commentCount', 'comment_count']) || '');
  const likedCount = parseCount(readObjectValue(stateInteractInfo, ['likedCount', 'liked_count', 'likeCount', 'like_count']) || '')
    || readDomActionCount(['点赞', '赞'], ['.like-wrapper .count', '.like-wrapper', '[class*="like"] .count']);
  const collectedCount = parseCount(readObjectValue(stateInteractInfo, ['collectedCount', 'collected_count', 'collectCount', 'collect_count']) || '')
    || readDomActionCount(['收藏'], ['.collect-wrapper .count', '.collect-wrapper', '[class*="collect"] .count']);
  const sharedCount = parseCount(readObjectValue(stateInteractInfo, ['sharedCount', 'shared_count', 'shareCount', 'share_count']) || '')
    || readDomActionCount(['分享'], ['.share-wrapper .count', '.share-wrapper', '[class*="share"] .count']);

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
      title: clean(stateNote?.title || title),
      cover,
      commentCount,
      interactInfo: {
        likedCount,
        collectedCount,
        commentCount,
        sharedCount,
      },
    },
    comments,
    hasMore: Boolean(document.body.innerText.includes('查看更多评论') || document.body.innerText.includes('正在加载')),
  });
})()
`
