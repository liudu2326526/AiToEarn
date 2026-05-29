import { Injectable, Logger } from '@nestjs/common'
import {
  CommentSnapshotRepository,
  MonitoredPost,
  MonitoredPostFetchLogRepository,
  MonitoredPostRepository,
  PostSnapshotRepository,
  AccountOpsConfigRepository,
  MonitoredPostStatus,
  MonitoredPostFetchStatus,
} from '@yikart/channel-db'
import { AcquisitionService } from '../acquisition.service'
import { AcquisitionPlatform, METRIC_KEY_COMMENT_COUNT } from '../acquisition.constants'
import { CreateMonitoredPostDto, ListMonitoredPostQueryDto, WorkCommentQueryDto } from './work-data.dto'
import { PersistedAcquisitionFetchResult } from '../acquisition.types'
import { AppException, ResponseCode } from '@yikart/common'
import { AccountRepository } from '@yikart/mongodb'
import { FilterQuery } from 'mongoose'

// 小红书 xsec_token 缓存有效期(经验值)，超过则回主页刷新
const XHS_TOKEN_TTL_MS = 12 * 60 * 60 * 1000

@Injectable()
export class WorkDataService {
  private readonly logger = new Logger(WorkDataService.name)

  constructor(
    private readonly monitoredPostRepository: MonitoredPostRepository,
    private readonly monitoredPostFetchLogRepository: MonitoredPostFetchLogRepository,
    private readonly postSnapshotRepository: PostSnapshotRepository,
    private readonly commentSnapshotRepository: CommentSnapshotRepository,
    private readonly accountOpsConfigRepository: AccountOpsConfigRepository,
    private readonly accountRepository: AccountRepository,
    private readonly acquisitionService: AcquisitionService,
  ) {}

  private tryExtractPostId(platform: string, postUrl: string, explicitPostId?: string): string | null {
    if (explicitPostId) return explicitPostId

    try {
      const url = new URL(postUrl)
      if (platform === 'xhs') {
        const match = url.pathname.match(/\/(?:explore|discovery\/item)\/([^/?#]+)/)
        if (match?.[1]) return match[1]
      }

      if (platform === 'douyin') {
        const modalId = url.searchParams.get('modal_id')
        if (modalId) return modalId
        const match = url.pathname.match(/\/video\/([^/?#]+)/)
        if (match?.[1]) return match[1]
      }

      if (platform === 'kwai') {
        const photoId = url.searchParams.get('photoId') || url.searchParams.get('photo_id')
        if (photoId) return photoId
        const match = url.pathname.match(/\/short-video\/([^/?#]+)/)
        if (match?.[1]) return match[1]
      }
    } catch (e) {
      this.logger.warn(`Failed to parse postId from postUrl: ${postUrl}`)
    }

    return null
  }

  async createManual(userId: string, dto: CreateMonitoredPostDto) {
    const postId = this.tryExtractPostId(dto.platform, dto.postUrl, dto.postId)
    if (!postId) {
      throw new AppException(ResponseCode.MonitoredPostUrlUnparseable)
    }

    return await this.monitoredPostRepository.upsertByIdentity({
      userId,
      platform: dto.platform,
      accountId: dto.accountId,
      postId,
      postUrl: dto.postUrl,
      source: 'manual',
      monitorStatus: 'active',
      fetchStatus: 'idle',
    })
  }

  async listMonitoredPosts(userId: string, query: ListMonitoredPostQueryDto): Promise<[MonitoredPost[], number]> {
    const filter: FilterQuery<MonitoredPost> = {}
    if (query.platform) filter.platform = query.platform
    if (query.accountId) filter.accountId = query.accountId
    if (query.source) filter.source = query.source
    if (query.monitorStatus) filter.monitorStatus = query.monitorStatus
    if (query.fetchStatus) filter.fetchStatus = query.fetchStatus
    if (query.keyword) {
      filter.$or = [
        { title: { $regex: query.keyword, $options: 'i' } },
        { postUrl: { $regex: query.keyword, $options: 'i' } },
      ]
    }
    return await this.monitoredPostRepository.listWithPagination(userId, filter, query.page, query.pageSize)
  }

  async getDetail(userId: string, id: string) {
    const post = await this.monitoredPostRepository.getByIdAndUser(id, userId)
    if (!post) throw new AppException(ResponseCode.MonitoredPostNotFound)
    return post
  }

  private buildXhsPostUrl(postId: string, xsecToken: string): string {
    const params = new URLSearchParams({ xsec_token: xsecToken, xsec_source: 'pc_user' })
    return `https://www.xiaohongshu.com/explore/${postId}?${params.toString()}`
  }

  /**
   * 采集前确保拿到带有效 xsec_token 的作品链接。
   * token 缓存未过期则直接拼链接；过期/缺失则回作者主页刷新该账号全部作品 token 再拼。
   */
  private async resolveFreshPostUrl(userId: string, post: {
    platform: string
    accountId: string
    postId: string
    postUrl: string
    authorUserId?: string
    xsecToken?: string
    xsecTokenUpdatedAt?: Date | null
  }): Promise<string> {
    // 仅小红书需要 token；其他平台直接用原链接
    if (post.platform !== AcquisitionPlatform.Xhs || !post.authorUserId) {
      return post.postUrl
    }

    const tokenFresh = !!post.xsecToken
      && !!post.xsecTokenUpdatedAt
      && Date.now() - new Date(post.xsecTokenUpdatedAt).getTime() < XHS_TOKEN_TTL_MS
    if (tokenFresh) {
      return this.buildXhsPostUrl(post.postId, post.xsecToken!)
    }

    // token 过期/缺失：回主页刷新该账号全部作品 token，一次访问全账号受益
    const tokens = await this.acquisitionService.refreshTokens(post.platform, post.authorUserId)
    if (tokens.length > 0) {
      await this.monitoredPostRepository.updateTokensByAccount(userId, post.platform, post.accountId, tokens)
    }
    const current = tokens.find(t => t.postId === post.postId)
    if (current) {
      return this.buildXhsPostUrl(post.postId, current.xsecToken)
    }

    // 刷新仍拿不到(如审核中未在主页展示)：退回已有 token 或原链接
    return post.xsecToken ? this.buildXhsPostUrl(post.postId, post.xsecToken) : post.postUrl
  }

  async guardFetch(userId: string, accountId: string, monitoredPostId: string): Promise<{ allowed: boolean; reason?: string }> {
    const config = await this.accountOpsConfigRepository.getByAccountId(accountId)
    if (config && config.enableCommentFetch === false) {
      return { allowed: false, reason: 'Comment fetch is disabled by account operation config' }
    }

    if (config?.dailyCommentFetchLimit !== undefined && config.dailyCommentFetchLimit >= 0) {
      const startOfDay = this.getStartOfShanghaiDay()
      const usedToday = await this.monitoredPostFetchLogRepository.countByAccountSince(userId, accountId, startOfDay)

      if (usedToday >= config.dailyCommentFetchLimit) {
        return { allowed: false, reason: 'daily comment fetch limit reached' }
      }
    }

    return { allowed: true }
  }

  async fetchNow(userId: string, id: string) {
    const post = await this.getDetail(userId, id)

    const guard = await this.guardFetch(userId, post.accountId, post.id)
    if (!guard.allowed) {
      const updated = await this.monitoredPostRepository.updateById(post.id, {
        fetchStatus: 'not_configured',
        capabilityReason: guard.reason,
      })
      await this.monitoredPostFetchLogRepository.create({
        userId,
        monitoredPostId: post.id,
        accountId: post.accountId,
        platform: post.platform,
        fetchStatus: 'not_configured',
        reason: guard.reason || '',
        fetchedAt: new Date(),
      })
      return updated
    }

    await this.monitoredPostRepository.updateById(post.id, {
      fetchStatus: 'fetching',
      capabilityReason: '',
    })

    const fetchUrl = await this.resolveFreshPostUrl(userId, post)
    const result = await this.acquisitionService.fetchNow(userId, {
      platform: post.platform as AcquisitionPlatform,
      accountId: post.accountId,
      postUrl: fetchUrl,
      postId: post.postId,
    })

    return await this.updateMonitoredPostFromFetchResult(userId, {
      accountId: post.accountId,
      platform: post.platform,
      postId: post.postId,
      postUrl: post.postUrl,
    }, result)
  }

  async processWorkerFetch(userId: string, data: {
    accountId: string
    platform: string
    postUrl: string
    postId?: string
    cursor?: string
    fetchBatch?: string
  }) {
    const postId = this.tryExtractPostId(data.platform, data.postUrl, data.postId)
    if (!postId) {
      this.logger.warn(`Failed to extract postId in processWorkerFetch for ${data.postUrl}`)
      return
    }

    const post = await this.monitoredPostRepository.getByIdentity(userId, data.platform, data.accountId, postId)
    if (!post) {
      this.logger.warn(`Monitored post not found for worker fetch: ${data.postUrl}`)
      return
    }

    const guard = await this.guardFetch(userId, post.accountId, post.id)
    if (!guard.allowed) {
      this.logger.log(`Worker fetch skipped by guard for ${post.id}: ${guard.reason}`)
      await this.monitoredPostRepository.updateById(post.id, {
        fetchStatus: 'not_configured',
        capabilityReason: guard.reason,
      })
      await this.monitoredPostFetchLogRepository.create({
        userId,
        monitoredPostId: post.id,
        accountId: post.accountId,
        platform: post.platform,
        fetchStatus: 'not_configured',
        reason: guard.reason || '',
        fetchedAt: new Date(),
      })
      return
    }

    const fetchUrl = await this.resolveFreshPostUrl(userId, post)
    const result = await this.acquisitionService.fetchNow(userId, {
      ...data,
      platform: data.platform as AcquisitionPlatform,
      postUrl: fetchUrl,
      postId,
    })

    return await this.updateMonitoredPostFromFetchResult(userId, {
      accountId: data.accountId,
      platform: data.platform,
      postId,
      postUrl: data.postUrl,
    }, result)
  }

  async processPostBackfill(userId: string, data: {
    accountId: string
    platform: string
    postUrl: string
    postId?: string
  }) {
    // 1. Ensure it enters monitored posts
    const post = await this.upsertFromPublishedBackfill({
      userId,
      ...data,
    })
    if (!post) return

    // 2. Process fetch with guard
    return await this.processWorkerFetch(userId, data)
  }

  async updateMonitoredPostFromFetchResult(
    userId: string,
    identity: {
      accountId: string
      platform: string
      postId?: string
      postUrl: string
    },
    result: PersistedAcquisitionFetchResult,
  ) {
    const postId = this.tryExtractPostId(identity.platform, identity.postUrl, identity.postId)
    if (!postId) {
      this.logger.warn(`Failed to extract postId in updateMonitoredPostFromFetchResult for ${identity.postUrl}`)
      return
    }

    const post = await this.monitoredPostRepository.getByIdentity(userId, identity.platform, identity.accountId, postId)
    if (!post) return

    const fetchStatus = (result.capabilityStatus === 'ready' ? 'ready' : (result.capabilityStatus || 'failed')) as MonitoredPostFetchStatus

    const updateData: Partial<MonitoredPost> = {
      fetchStatus,
      capabilityReason: result.capabilityReason || '',
      lastFetchedAt: new Date(),
      lastFetchBatch: result.fetchBatch || '',
    }

    if (result.postSaved) {
      const latestSnapshot = await this.postSnapshotRepository.findLatest(post.accountId, post.platform, post.postId)
      if (latestSnapshot) {
        updateData.title = latestSnapshot.title || post.title
        updateData.cover = latestSnapshot.cover || post.cover
        updateData.latestMetrics = latestSnapshot.metrics?.normalized || post.latestMetrics
        updateData.latestCommentCount = latestSnapshot.metrics?.normalized?.[METRIC_KEY_COMMENT_COUNT] || latestSnapshot.metrics?.normalized?.['comment'] || post.latestCommentCount
        updateData.latestPostSnapshotId = latestSnapshot.id || post.latestPostSnapshotId
      }
    }

    const updated = await this.monitoredPostRepository.updateById(post.id, updateData)

    await this.monitoredPostFetchLogRepository.create({
      userId,
      monitoredPostId: post.id,
      accountId: post.accountId,
      platform: post.platform,
      fetchStatus,
      fetchBatch: result.fetchBatch || '',
      reason: result.capabilityReason || '',
      fetchedAt: new Date(),
    })

    return updated
  }

  async listSnapshots(userId: string, id: string, limit: number) {
    const post = await this.getDetail(userId, id)
    return await this.postSnapshotRepository.listByPost(post.accountId, post.platform, post.postId, limit)
  }

  async listComments(userId: string, id: string, query: WorkCommentQueryDto) {
    const post = await this.getDetail(userId, id)
    return await this.commentSnapshotRepository.listWithPagination({
      accountId: post.accountId,
      platform: post.platform,
      postId: post.postId,
      keyword: query.keyword,
      parentCommentId: query.parentCommentId,
      dataSource: query.dataSource,
      fetchBatch: query.fetchBatch,
      sortBy: query.sortBy,
      page: query.page,
      pageSize: query.pageSize,
    })
  }

  async upsertFromPublishedBackfill(data: {
    userId: string
    platform: string
    accountId: string
    postUrl: string
    postId?: string
  }) {
    const postId = this.tryExtractPostId(data.platform, data.postUrl, data.postId)
    if (!postId) {
      this.logger.warn(`Failed to extract postId in upsertFromPublishedBackfill for ${data.postUrl}`)
      return
    }

    // 记录作者主页 userId(= account.uid),用于后续回主页刷新 xsec_token
    const account = await this.accountRepository.getAccountById(data.accountId)
    const authorUserId = account?.uid || ''

    return await this.monitoredPostRepository.upsertByIdentity({
      userId: data.userId,
      platform: data.platform,
      accountId: data.accountId,
      postId,
      postUrl: data.postUrl,
      authorUserId,
      source: 'published_backfill',
      monitorStatus: 'active',
      fetchStatus: 'idle',
    })
  }

  async updateStatus(userId: string, id: string, status: string) {
    const post = await this.getDetail(userId, id)
    return await this.monitoredPostRepository.updateById(post.id, { monitorStatus: status as MonitoredPostStatus })
  }

  private getStartOfShanghaiDay(now = new Date()) {
    const shanghaiOffsetMs = 8 * 60 * 60 * 1000
    const shanghaiNow = new Date(now.getTime() + shanghaiOffsetMs)
    // Shift to UTC+8, truncate with UTC methods, then shift back to UTC storage time.
    shanghaiNow.setUTCHours(0, 0, 0, 0)
    return new Date(shanghaiNow.getTime() - shanghaiOffsetMs)
  }
}
