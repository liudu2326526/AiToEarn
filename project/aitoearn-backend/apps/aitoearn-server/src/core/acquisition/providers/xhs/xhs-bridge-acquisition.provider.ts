import { Injectable } from '@nestjs/common'
import { XhsBridgeService } from '../../../xhs-bridge/xhs-bridge.service'
import {
  AcquisitionCapabilityStatus,
  AcquisitionDataSource,
  AcquisitionPlatform,
  METRIC_KEY_COLLECT_COUNT,
  METRIC_KEY_COMMENT_COUNT,
  METRIC_KEY_LIKE_COUNT,
  METRIC_KEY_SHARE_COUNT,
} from '../../acquisition.constants'
import { AcquisitionFetchRequest, AcquisitionFetchResult, NormalizedCommentSnapshot } from '../../acquisition.types'
import { AcquisitionProvider } from '../acquisition-provider.interface'
import { XHS_CAPTURE_NOTE_STATE_EXPRESSION, XHS_CAPTURE_PROFILE_NOTE_LINKS_EXPRESSION, XHS_EXPAND_COMMENTS_SCRIPT } from './xhs-extractors'

interface CapturedXhsState {
  location?: string
  note?: unknown
  comments?: unknown[]
  hasMore?: boolean
}

interface XhsCommentLike {
  id?: string
  comment_id?: string
  parentCommentId?: string
  content?: string
  text?: string
  userName?: string
  userAvatar?: string
  user?: {
    nickname?: string
    avatar?: string
  }
  user_info?: {
    nickname?: string
    image?: string
  }
  likeCount?: number
  like_count?: number
  liked_count?: number
  ipLocation?: string
  ip_location?: string
  create_time?: number | string
  commentedAtText?: string
  xsecToken?: string
  xsec_token?: string
}

@Injectable()
export class XhsBridgeAcquisitionProvider implements AcquisitionProvider {
  constructor(private readonly xhsBridgeService: XhsBridgeService) {}

  async getCapabilityStatus(_accountId: string) {
    const status = this.xhsBridgeService.getStatus()
    return status.extensionConnected
      ? { status: AcquisitionCapabilityStatus.Ready, reason: '' }
      : { status: AcquisitionCapabilityStatus.NotConfigured, reason: 'XHS Bridge extension is not connected' }
  }

  async refreshTokens(authorUserId: string): Promise<Array<{ postId: string, xsecToken: string }>> {
    if (!authorUserId) return []
    const status = this.xhsBridgeService.getStatus()
    if (!status.extensionConnected) return []

    const profileUrl = `https://www.xiaohongshu.com/user/profile/${authorUserId}`
    await this.xhsBridgeService.callExtension('navigate', { url: profileUrl }, 30000)
    await this.xhsBridgeService.callExtension('wait_for_load', {}, 30000)
    await this.xhsBridgeService.callExtension('wait_dom_stable', {}, 30000)
    const raw = await this.xhsBridgeService.callExtension<unknown>('evaluate', {
      expression: XHS_CAPTURE_PROFILE_NOTE_LINKS_EXPRESSION,
    }, 30000)

    try {
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
      const parsed = JSON.parse(text) as { notes?: Array<{ noteId?: string, xsecToken?: string }> }
      return (parsed.notes || [])
        .filter(n => n.noteId && n.xsecToken)
        .map(n => ({ postId: n.noteId as string, xsecToken: n.xsecToken as string }))
    }
    catch {
      return []
    }
  }

  async fetchWorkAndComments(request: AcquisitionFetchRequest): Promise<AcquisitionFetchResult> {
    const capability = await this.getCapabilityStatus(request.accountId)
    if (capability.status !== AcquisitionCapabilityStatus.Ready) {
      return {
        comments: [],
        cursor: request.cursor || '',
        hasMore: false,
        capabilityStatus: capability.status,
        capabilityReason: capability.reason,
        fetchBatch: request.fetchBatch || '',
      }
    }

    await this.xhsBridgeService.callExtension('navigate', { url: request.postUrl }, 30000)
    await this.xhsBridgeService.callExtension('wait_for_load', {}, 30000)
    await this.xhsBridgeService.callExtension('wait_dom_stable', {}, 30000)
    await this.xhsBridgeService.callExtension('evaluate', {
      expression: XHS_EXPAND_COMMENTS_SCRIPT,
    }, 30000)
    const raw = await this.xhsBridgeService.callExtension<unknown>('evaluate', {
      expression: XHS_CAPTURE_NOTE_STATE_EXPRESSION,
    }, 30000)

    return this.normalizeCapturedState(request, raw)
  }

  private normalizeCapturedState(request: AcquisitionFetchRequest, raw: unknown): AcquisitionFetchResult {
    let state: CapturedXhsState
    try {
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
      state = JSON.parse(text) as CapturedXhsState
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        comments: [],
        cursor: request.cursor || '',
        hasMore: false,
        capabilityStatus: AcquisitionCapabilityStatus.Failed,
        capabilityReason: `XHS page data parse failed: ${message}`,
        fetchBatch: request.fetchBatch || '',
      }
    }

    const postId = request.postId || this.extractPostId(request.postUrl) || request.postUrl
    const fetchedAt = new Date()
    const comments = this.normalizeComments(request, state.comments || [], postId)
    const normalizedMetrics = this.extractMetrics(state.note, comments.length)

    return {
      post: {
        platform: AcquisitionPlatform.Xhs,
        accountId: request.accountId,
        postId,
        postUrl: request.postUrl,
        title: this.extractTitle(state.note),
        cover: this.extractCover(state.note),
        metrics: {
          raw: {},
          normalized: normalizedMetrics,
        },
        fetchedAt,
        fetchDate: fetchedAt.toISOString().slice(0, 10),
        dataSource: AcquisitionDataSource.XhsBridgeCapture,
      },
      comments,
      cursor: '',
      hasMore: Boolean(state.hasMore),
      capabilityStatus: AcquisitionCapabilityStatus.Ready,
      capabilityReason: '',
      fetchBatch: request.fetchBatch || '',
    }
  }

  private normalizeComments(request: AcquisitionFetchRequest, comments: unknown[], postId: string): NormalizedCommentSnapshot[] {
    const fallbackXsecToken = this.extractXsecToken(request.postUrl)
    return comments.map((item, index) => {
      const comment = item as XhsCommentLike
      return {
        platform: AcquisitionPlatform.Xhs,
        accountId: request.accountId,
        postId,
        commentId: comment.id || comment.comment_id || `dom:${postId}:${index}`,
        parentCommentId: comment.parentCommentId || '',
        userName: comment.userName || comment.user?.nickname || comment.user_info?.nickname || '',
        userAvatar: comment.userAvatar || comment.user?.avatar || comment.user_info?.image || '',
        content: comment.content || comment.text || '',
        likeCount: Number(comment.likeCount ?? comment.like_count ?? comment.liked_count ?? 0),
        ipLocation: comment.ipLocation || comment.ip_location || '',
        xsecToken: comment.xsecToken || comment.xsec_token || fallbackXsecToken,
        commentedAt: this.toDate(comment.create_time) || this.toXhsRelativeDate(comment.commentedAtText),
        fetchBatch: request.fetchBatch || '',
        dataSource: AcquisitionDataSource.XhsBridgeCapture,
      }
    }).filter(comment => comment.userName && comment.content)
  }

  private extractPostId(postUrl: string) {
    const match = postUrl.match(/(?:explore|discovery\/item)\/([^/?#]+)/)
    return match?.[1] || ''
  }

  private extractTitle(note: unknown) {
    if (typeof note === 'string') {
      try {
        const parsed = JSON.parse(note) as { title?: string }
        return parsed.title || ''
      }
      catch {
        return ''
      }
    }
    if (note && typeof note === 'object' && 'title' in note) {
      return String((note as { title?: unknown }).title || '')
    }
    return ''
  }

  private extractCover(note: unknown) {
    const parsed = this.parseNoteObject(note)
    return this.extractImageUrl(this.pickValue(parsed, ['cover', 'image', 'thumbnail']))
      || this.extractImageUrl(this.pickValue(parsed, ['imageList', 'image_list', 'images', 'image_list_v2']))
  }

  private extractMetrics(note: unknown, fallbackCommentCount: number): Record<string, number> {
    const parsed = this.parseNoteObject(note)
    const interactInfo = this.pickObject(parsed, ['interactInfo', 'interact_info'])
    const sources = [interactInfo, parsed].filter(Boolean) as Record<string, unknown>[]

    const metrics: Record<string, number> = {}
    const likeCount = this.extractMetricValue(sources, ['likedCount', 'liked_count', 'likeCount', 'like_count'])
    const collectCount = this.extractMetricValue(sources, ['collectedCount', 'collected_count', 'collectCount', 'collect_count'])
    const commentCount = this.extractMetricValue(sources, ['commentCount', 'comment_count'])
    const shareCount = this.extractMetricValue(sources, ['sharedCount', 'shared_count', 'shareCount', 'share_count'])

    if (likeCount !== undefined) metrics[METRIC_KEY_LIKE_COUNT] = likeCount
    if (collectCount !== undefined) metrics[METRIC_KEY_COLLECT_COUNT] = collectCount
    metrics[METRIC_KEY_COMMENT_COUNT] = commentCount ?? fallbackCommentCount
    if (shareCount !== undefined) metrics[METRIC_KEY_SHARE_COUNT] = shareCount

    return metrics
  }

  private pickObject(source: Record<string, unknown> | undefined, keys: string[]) {
    if (!source) return undefined
    for (const key of keys) {
      const value = source[key]
      if (value && typeof value === 'object') {
        return value as Record<string, unknown>
      }
    }
    return undefined
  }

  private pickValue(source: Record<string, unknown> | undefined, keys: string[]) {
    if (!source) return undefined
    for (const key of keys) {
      const value = source[key]
      if (value !== undefined && value !== null && value !== '') return value
    }
    return undefined
  }

  private extractImageUrl(value: unknown): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (Array.isArray(value)) {
      for (const item of value) {
        const url = this.extractImageUrl(item)
        if (url) return url
      }
      return ''
    }
    if (typeof value === 'object') {
      const objectValue = value as Record<string, unknown>
      const url = this.pickValue(objectValue, ['url', 'urlDefault', 'url_default', 'urlPre', 'url_pre', 'src', 'href'])
      return typeof url === 'string' ? url : ''
    }
    return ''
  }

  private extractMetricValue(sources: Record<string, unknown>[], keys: string[]) {
    for (const source of sources) {
      for (const key of keys) {
        if (!(key in source)) continue
        const count = this.normalizeCount(source[key])
        if (count !== undefined) return count
      }
    }
    return undefined
  }

  private normalizeCount(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Math.max(0, Math.round(value)) : undefined
    }

    if (typeof value !== 'string') return undefined

    const text = value.trim()
    if (!text || text === '-') return undefined

    const compact = text.replace(/,/g, '').replace(/\s/g, '').replace(/\+/g, '')
    const multiplier = compact.includes('亿')
      ? 100_000_000
      : compact.includes('万') || /w/i.test(compact)
        ? 10_000
        : /k/i.test(compact)
          ? 1_000
          : 1
    const numeric = Number.parseFloat(compact.replace(/[^\d.]/g, ''))
    if (!Number.isFinite(numeric)) return undefined

    return Math.max(0, Math.round(numeric * multiplier))
  }

  private parseNoteObject(note: unknown): Record<string, unknown> | undefined {
    if (typeof note === 'string') {
      try {
        const parsed = JSON.parse(note) as unknown
        return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : undefined
      }
      catch {
        return undefined
      }
    }
    return note && typeof note === 'object' ? note as Record<string, unknown> : undefined
  }

  private extractXsecToken(postUrl: string): string {
    try {
      return new URL(postUrl).searchParams.get('xsec_token') || ''
    }
    catch {
      return ''
    }
  }

  private toDate(value: number | string | undefined) {
    if (!value) return undefined
    const numeric = Number(value)
    if (Number.isFinite(numeric)) {
      return new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000)
    }
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }

  private toXhsRelativeDate(value?: string) {
    if (!value) return undefined
    const now = new Date()
    if (value === '今天') return now
    if (value === '昨天') return new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const daysAgo = value.match(/^(\d+)天前$/)
    if (daysAgo) {
      return new Date(now.getTime() - Number(daysAgo[1]) * 24 * 60 * 60 * 1000)
    }

    const monthDay = value.match(/^(\d{2})-(\d{2})$/)
    if (monthDay) {
      return new Date(now.getFullYear(), Number(monthDay[1]) - 1, Number(monthDay[2]))
    }

    return undefined
  }
}
