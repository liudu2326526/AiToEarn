import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PublishRecordRepository } from '@yikart/mongodb'
import { QueueService } from '@yikart/aitoearn-queue'
import { AppException, ResponseCode } from '@yikart/common'

@Injectable()
export class XhsTokenRefreshService {
  private readonly logger = new Logger(XhsTokenRefreshService.name)

  constructor(
    private readonly publishRecordRepository: PublishRecordRepository,
    private readonly queueService: QueueService,
  ) {}

  // 每 5 分钟扫描一次待审核的发布记录
  @Cron('*/5 * * * *')
  async scanPendingRecords() {
    this.logger.log('[XhsTokenRefresh] Starting scan for pending XHS records')

    // 查询所有小红书平台、状态为 PENDING 的发布记录
    const pendingRecords = await this.publishRecordRepository.listPendingXhsRecords()

    this.logger.log(`[XhsTokenRefresh] Found ${pendingRecords.length} pending records`)

    for (const record of pendingRecords) {
      try {
        await this.requestTokenRefresh(record)
      } catch (error) {
        this.logger.error(error, `[XhsTokenRefresh] Failed to request token refresh for record ${record.id}`)
      }
    }
  }

  // 每 10 分钟清理一次超时任务
  @Cron('*/10 * * * *')
  async cleanupStaleJobs() {
    try {
      const cleanedCount = await this.queueService.cleanupStaleXhsTokenRefreshJobs()
      if (cleanedCount > 0) {
        this.logger.log(`[XhsTokenRefresh] Cleaned up ${cleanedCount} stale jobs`)
      }
    } catch (error) {
      this.logger.error(error, '[XhsTokenRefresh] Failed to cleanup stale jobs')
    }
  }

  // 请求 MultiPost 扩展刷新 Token
  async requestTokenRefresh(record: {
    id: string
    userId: string
    dataId?: string
    workLink?: string
    linkMeta?: Record<string, unknown>
  }) {
    const noteId = this.resolveXhsNoteId(record)
    if (!noteId) {
      this.logger.warn(`[XhsTokenRefresh] Skip record ${record.id}: XHS note id is missing`)
      return
    }

    this.logger.log(`[XhsTokenRefresh] Requesting token refresh for note ${noteId}`)

    // 将刷新请求加入队列，由前端轮询或 WebSocket 推送
    await this.queueService.addXhsTokenRefreshJob({
      publishRecordId: record.id,
      userId: record.userId,
      noteId,
    })
  }

  // 手动触发刷新（供 API 调用）
  async manualRefresh(userId: string, publishRecordId: string) {
    const record = await this.publishRecordRepository.getById(publishRecordId)
    if (!record || record.userId !== userId) {
      throw new AppException(ResponseCode.PublishRecordNotFound)
    }

    if (record.accountType !== 'xhs') {
      throw new AppException(ResponseCode.PublishTaskInvalid, 'Only XHS records can be refreshed')
    }

    await this.requestTokenRefresh({
      id: record._id.toString(),
      userId: record.userId,
      dataId: record.dataId,
      workLink: record.workLink,
      linkMeta: record.linkMeta as Record<string, unknown> | undefined,
    })
  }

  private resolveXhsNoteId(record: { dataId?: string; workLink?: string; linkMeta?: Record<string, unknown> | null }) {
    if (this.isLikelyXhsNoteId(record.dataId)) return record.dataId

    const workLinkNoteId = record.workLink ? this.extractXhsNoteId(record.workLink) : undefined
    if (this.isLikelyXhsNoteId(workLinkNoteId)) return workLinkNoteId

    const unverifiedWorkLink = typeof record.linkMeta?.['unverifiedWorkLink'] === 'string'
      ? record.linkMeta['unverifiedWorkLink']
      : undefined
    const unverifiedNoteId = unverifiedWorkLink ? this.extractXhsNoteId(unverifiedWorkLink) : undefined
    if (this.isLikelyXhsNoteId(unverifiedNoteId)) return unverifiedNoteId

    return undefined
  }

  private extractXhsNoteId(workLink: string) {
    try {
      const url = new URL(workLink)
      if (!/(^|\.)xiaohongshu\.com$/.test(url.hostname)) return undefined

      return url.pathname.match(/\/(?:explore|discovery\/item)\/([A-Za-z0-9]+)/)?.[1]
        || url.pathname.match(/\/user\/profile\/[^/?#]+\/([A-Za-z0-9]+)/)?.[1]
    }
    catch {
      return undefined
    }
  }

  private isLikelyXhsNoteId(value?: string) {
    return !!value && /^[A-Za-z0-9]{20,40}$/.test(value) && !value.startsWith('req-')
  }
}
