import type {
  CommentItem,
  CommentListResult,
  CommentUser,
  GetWorkDetailParams,
  GetWorkDetailResult,
  TopicInfo,
  WorkDetail,
} from '../types'
import { callAutoclawBridge, getXhsBridgeStatus, getXhsCaptureSetupMessage } from './xhsBridge'

export interface XhsWorkMonitorResult extends GetWorkDetailResult {
  comments: CommentItem[]
  cursor: string
  hasMore: boolean
}

interface AutoclawUser {
  userId?: string
  user_id?: string
  nickname?: string
  nickName?: string
  nick_name?: string
  avatar?: string
  image?: string
  xsecToken?: string
  xsec_token?: string
}

interface AutoclawComment {
  id?: string
  content?: string
  createTime?: number
  create_time?: number
  likeCount?: string | number
  like_count?: string | number
  ipLocation?: string
  ip_location?: string
  liked?: boolean
  showTags?: string[]
  show_tags?: string[]
  subCommentCount?: string | number
  sub_comment_count?: string | number
  subComments?: AutoclawComment[]
  sub_comments?: AutoclawComment[]
  user?: AutoclawUser
  userInfo?: AutoclawUser
  user_info?: AutoclawUser
}

interface AutoclawDetailNote {
  noteId?: string
  note_id?: string
  xsecToken?: string
  xsec_token?: string
  title?: string
  desc?: string
  body?: string
  tags?: string[]
  type?: string
  time?: number
  ipLocation?: string
  ip_location?: string
  user?: AutoclawUser
  interactInfo?: {
    liked?: boolean
    likedCount?: string | number
    collected?: boolean
    collectedCount?: string | number
    commentCount?: string | number
    sharedCount?: string | number
    followed?: boolean
  }
  interact_info?: AutoclawDetailNote['interactInfo']
  imageList?: Array<{
    url?: string
    urlDefault?: string
    url_default?: string
    urlPre?: string
    url_pre?: string
    width?: number
    height?: number
  }>
  image_list?: AutoclawDetailNote['imageList']
  video?: {
    url?: string
    duration?: number
    width?: number
    height?: number
  }
}

interface AutoclawFeedDetail {
  note?: AutoclawDetailNote
  comments?: AutoclawComment[] | {
    list?: AutoclawComment[]
    cursor?: string
    hasMore?: boolean
    has_more?: boolean
  }
}

const EXTRACT_STATE_JS = `
(() => {
  if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.note && window.__INITIAL_STATE__.note.noteDetailMap) {
    return JSON.stringify(window.__INITIAL_STATE__.note.noteDetailMap);
  }
  return "";
})()
`

const EXTRACT_DOM_BODY_JS = `
(() => {
  const bodyEl = document.querySelector('#detail-desc');
  if (!bodyEl) return null;
  const tags = Array.from(bodyEl.querySelectorAll('a.tag'))
    .map(a => (a.textContent || '').trim())
    .filter(Boolean);
  const clone = bodyEl.cloneNode(true);
  clone.querySelectorAll('a.tag').forEach(el => el.remove());
  const body = (clone.textContent || '').replace(/\\n{3,}/g, '\\n\\n').trim();
  if (!body && !tags.length) return null;
  return { body, tags };
})()
`

function getXsecToken(params: GetWorkDetailParams): string {
  const origin = params.origin || {}
  return params.xsecToken
    || origin.xsec_token
    || origin.xsecToken
    || origin.note_card?.xsec_token
    || origin.noteCard?.xsecToken
    || ''
}

function buildNoteUrl(workId: string, xsecToken: string, xsecSource?: string): string {
  const query = new URLSearchParams({
    xsec_token: xsecToken,
    xsec_source: xsecSource || 'pc_feed',
  })
  return `https://www.xiaohongshu.com/explore/${workId}?${query.toString()}`
}

function normalizeCount(value: unknown): string {
  if (value === undefined || value === null || value === '')
    return '0'
  return String(value)
}

function normalizeTime(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0)
    return undefined
  return value > 10000000000 ? value : value * 1000
}

function transformUser(user?: AutoclawUser): CommentUser {
  return {
    id: user?.userId || user?.user_id || '',
    nickname: user?.nickname || user?.nickName || user?.nick_name || '',
    avatar: user?.avatar || user?.image || '',
    xsecToken: user?.xsecToken || user?.xsec_token,
  }
}

function transformComment(comment: AutoclawComment): CommentItem {
  const showTags = comment.showTags || comment.show_tags || []
  const replies = comment.subComments || comment.sub_comments || []
  const replyCount = Number(comment.subCommentCount ?? comment.sub_comment_count ?? replies.length) || 0

  return {
    id: comment.id || '',
    content: comment.content || '',
    createTime: normalizeTime(comment.createTime ?? comment.create_time) || 0,
    likeCount: Number.parseInt(String(comment.likeCount ?? comment.like_count ?? 0), 10) || 0,
    user: transformUser(comment.user || comment.userInfo || comment.user_info),
    ipLocation: comment.ipLocation || comment.ip_location,
    isAuthor: showTags.includes('is_author'),
    isLiked: !!comment.liked,
    replyCount,
    replies: replies.map(transformComment),
    hasMoreReplies: replyCount > replies.length,
    origin: comment,
  }
}

function getCommentPayload(detail: AutoclawFeedDetail): {
  comments: AutoclawComment[]
  cursor: string
  hasMore: boolean
} {
  if (Array.isArray(detail.comments)) {
    return { comments: detail.comments, cursor: '', hasMore: false }
  }

  return {
    comments: detail.comments?.list || [],
    cursor: detail.comments?.cursor || '',
    hasMore: detail.comments?.hasMore ?? detail.comments?.has_more ?? false,
  }
}

function transformDetail(detail: AutoclawFeedDetail, fallbackWorkId: string, fallbackXsecToken: string, xsecSource?: string): WorkDetail {
  const note = detail.note || {}
  const interactInfo = note.interactInfo || note.interact_info || {}
  const imageList = note.imageList || note.image_list || []
  const author = transformUser(note.user)
  const topics: TopicInfo[] = (note.tags || []).map(name => ({
    name,
    url: `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(name.replace(/^#/, ''))}`,
  }))
  const normalizedImages = imageList.map(image => ({
    url: image.url || image.urlDefault || image.url_default || image.urlPre || image.url_pre || '',
    width: image.width,
    height: image.height,
  })).filter(image => image.url)
  const coverUrl = normalizedImages[0]?.url || ''
  const workId = note.noteId || note.note_id || fallbackWorkId
  const xsecToken = note.xsecToken || note.xsec_token || fallbackXsecToken
  const video = note.video?.url
    ? {
        url: note.video.url,
        duration: note.video.duration,
        width: note.video.width,
        height: note.video.height,
      }
    : undefined

  return {
    workId,
    type: note.type === 'video' ? 'video' : 'normal',
    title: note.title || '',
    description: note.body || note.desc || '',
    coverUrl,
    imageList: normalizedImages,
    video,
    author: {
      id: author.id,
      name: author.nickname,
      avatar: author.avatar,
      url: author.id ? `https://www.xiaohongshu.com/user/profile/${author.id}?${new URLSearchParams({ xsec_token: xsecToken, xsec_source: xsecSource || 'pc_note' }).toString()}` : '',
    },
    interactInfo: {
      likeCount: normalizeCount(interactInfo.likedCount),
      collectCount: normalizeCount(interactInfo.collectedCount),
      commentCount: normalizeCount(interactInfo.commentCount),
      shareCount: normalizeCount(interactInfo.sharedCount),
      isLiked: !!interactInfo.liked,
      isCollected: !!interactInfo.collected,
      isFollowed: !!interactInfo.followed,
    },
    topics,
    publishTime: normalizeTime(note.time),
    ipLocation: note.ipLocation || note.ip_location,
    origin: detail,
  }
}

async function waitForDetailData(workId: string): Promise<AutoclawFeedDetail> {
  const deadline = Date.now() + 10000

  while (Date.now() < deadline) {
    const rawState = await callAutoclawBridge<string>('evaluate', { expression: EXTRACT_STATE_JS }, 15000)
    if (rawState) {
      const noteDetailMap = JSON.parse(rawState) as Record<string, { note?: AutoclawDetailNote, comments?: AutoclawFeedDetail['comments'] }>
      const noteData = noteDetailMap[workId]
      if (noteData?.note) {
        const domResult = await callAutoclawBridge<{ body?: string, tags?: string[] } | null>(
          'evaluate',
          { expression: EXTRACT_DOM_BODY_JS },
          15000,
        )
        if (domResult) {
          noteData.note.body = domResult.body || noteData.note.body
          noteData.note.tags = domResult.tags || noteData.note.tags
        }
        return noteData
      }
    }
    await new Promise(resolve => window.setTimeout(resolve, 300))
  }

  throw new Error('未从小红书页面捕获到作品详情数据')
}

export async function getWorkDetailViaAutoclawBridge(params: GetWorkDetailParams): Promise<GetWorkDetailResult> {
  const { workId, xsecSource } = params
  const xsecToken = getXsecToken(params)

  if (!workId) {
    return { success: false, message: '作品ID不能为空' }
  }

  if (!xsecToken) {
    return { success: false, message: getXhsCaptureSetupMessage('缺少小红书 xsec_token，请先从小红书列表或搜索结果进入作品') }
  }

  const status = await getXhsBridgeStatus()
  if (!status.ready) {
    return { success: false, message: status.message || getXhsCaptureSetupMessage() }
  }

  try {
    await callAutoclawBridge('navigate', { url: buildNoteUrl(workId, xsecToken, xsecSource) })
    await callAutoclawBridge('wait_for_load', { timeout: 60000 }, 70000)
    await callAutoclawBridge('wait_dom_stable', { timeout: 10000, interval: 500 }, 15000)

    const rawDetail = await waitForDetailData(workId)
    return {
      success: true,
      detail: transformDetail(rawDetail, workId, xsecToken, xsecSource),
      rawData: rawDetail,
    }
  }
  catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : getXhsCaptureSetupMessage('获取小红书作品详情失败'),
    }
  }
}

export async function getCommentsViaAutoclawBridge(params: GetWorkDetailParams): Promise<CommentListResult> {
  const detailResult = await getWorkDetailViaAutoclawBridge(params)

  if (!detailResult.success) {
    return {
      success: false,
      message: detailResult.message,
      comments: [],
      cursor: '',
      hasMore: false,
      rawData: detailResult.rawData,
    }
  }

  const payload = getCommentPayload(detailResult.rawData as AutoclawFeedDetail)

  return {
    success: true,
    comments: payload.comments.map(transformComment),
    cursor: payload.cursor,
    hasMore: payload.hasMore,
    total: payload.comments.length,
    rawData: detailResult.rawData,
  }
}

export async function getWorkMonitorViaAutoclawBridge(params: GetWorkDetailParams): Promise<XhsWorkMonitorResult> {
  const detailResult = await getWorkDetailViaAutoclawBridge(params)

  if (!detailResult.success) {
    return {
      ...detailResult,
      comments: [],
      cursor: '',
      hasMore: false,
    }
  }

  const payload = getCommentPayload(detailResult.rawData as AutoclawFeedDetail)

  return {
    ...detailResult,
    comments: payload.comments.map(transformComment),
    cursor: payload.cursor,
    hasMore: payload.hasMore,
  }
}
