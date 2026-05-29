/**
 * 小红书个人主页作品列表采集
 * 用于回主页刷新每条作品的 xsec_token 及最新互动指标
 */

import { getXhsCaptureSetupMessage, isLegacyXhsPluginAvailable, requestLegacyXhsApi } from './xhsBridge'

export interface UserPostedNote {
  /** 作品 ID(noteId) */
  noteId: string
  /** 该作品当前的 xsec_token(访问详情/评论用) */
  xsecToken: string
  /** 标题 */
  title: string
  /** 封面 */
  cover: string
  /** 是否视频 */
  isVideo: boolean
  /** 点赞数 */
  likeCount: number
  /** 收藏数 */
  collectCount: number
  /** 评论数 */
  commentCount: number
  /** 分享数 */
  shareCount: number
}

export interface UserPostedResult {
  success: boolean
  message?: string
  notes: UserPostedNote[]
}

interface XhsUserPostedResponse {
  success: boolean
  msg?: string
  data?: {
    cursor?: string
    has_more?: boolean
    notes?: Array<{
      note_id: string
      type?: string
      display_title?: string
      xsec_token?: string
      cover?: { url_default?: string, url_pre?: string }
      interact_info?: {
        liked_count?: string
        collected_count?: string
        comment_count?: string
        shared_count?: string
      }
    }>
  }
}

function toCount(value?: string): number {
  if (!value) return 0
  // 小红书可能返回 "1.2万" 之类，这里只取纯数字，含单位的转换在后端统一处理
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * 获取指定用户主页的作品列表(含每条作品的新鲜 xsec_token 与指标)
 * @param userId 作者主页 userId(= 账号 uid)
 * @param maxCount 最多拉取条数(默认 60，约两页)
 */
export async function getUserPostedNotes(userId: string, maxCount = 60): Promise<UserPostedResult> {
  if (!isLegacyXhsPluginAvailable()) {
    return {
      success: false,
      message: getXhsCaptureSetupMessage('采集个人主页作品列表需要 AiToEarn 插件的小红书请求能力'),
      notes: [],
    }
  }

  if (!userId) {
    return { success: false, message: '缺少作者 userId', notes: [] }
  }

  const notes: UserPostedNote[] = []
  let cursor = ''
  let hasMore = true

  try {
    while (hasMore && notes.length < maxCount) {
      const query = new URLSearchParams({
        num: '30',
        cursor,
        user_id: userId,
        image_formats: 'jpg,webp,avif',
        xsec_source: 'pc_user',
      })

      const response = await requestLegacyXhsApi<XhsUserPostedResponse>({
        path: `/api/sns/web/v1/user_posted?${query.toString()}`,
        method: 'GET',
      })

      if (!response?.success || !response.data) {
        return {
          success: false,
          message: response?.msg || '获取个人主页作品列表失败',
          notes,
        }
      }

      const pageNotes = response.data.notes || []
      for (const n of pageNotes) {
        if (!n.note_id) continue
        notes.push({
          noteId: n.note_id,
          xsecToken: n.xsec_token || '',
          title: n.display_title || '',
          cover: n.cover?.url_default || n.cover?.url_pre || '',
          isVideo: n.type === 'video',
          likeCount: toCount(n.interact_info?.liked_count),
          collectCount: toCount(n.interact_info?.collected_count),
          commentCount: toCount(n.interact_info?.comment_count),
          shareCount: toCount(n.interact_info?.shared_count),
        })
      }

      hasMore = !!response.data.has_more && pageNotes.length > 0
      cursor = response.data.cursor || ''
      if (!cursor) hasMore = false
    }

    return { success: true, notes }
  }
  catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '请求失败',
      notes,
    }
  }
}
