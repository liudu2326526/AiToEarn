import { Inject, Injectable } from '@nestjs/common'
import { QueueService } from '@yikart/aitoearn-queue'
import { CommentSnapshotRepository } from '@yikart/channel-db'
import { v4 as uuidv4 } from 'uuid'
import { ACQUISITION_PROVIDERS, AcquisitionCapabilityStatus, AcquisitionPlatform } from './acquisition.constants'
import { AcquisitionFetchWorkDto } from './acquisition.dto'
import { AcquisitionFetchRequest, PersistedAcquisitionFetchResult } from './acquisition.types'
import { CommentCapabilityService } from './comment-capability.service'
import { AcquisitionProvider } from './providers/acquisition-provider.interface'
import { SnapshotPersistenceService } from './snapshot-persistence.service'

@Injectable()
export class AcquisitionService {
  constructor(
    @Inject(ACQUISITION_PROVIDERS)
    private readonly providers: Partial<Record<AcquisitionPlatform, AcquisitionProvider>>,
    private readonly snapshotPersistenceService: SnapshotPersistenceService,
    private readonly commentCapabilityService: CommentCapabilityService,
    private readonly queueService: QueueService,
    private readonly commentSnapshotRepository: CommentSnapshotRepository,
  ) {}

  async fetchNow(userId: string, dto: AcquisitionFetchWorkDto | AcquisitionFetchRequest): Promise<PersistedAcquisitionFetchResult> {
    const platform = this.toPlatform(dto.platform)
    const provider = this.providers[platform]
    if (!provider) {
      const defaultStatus = this.commentCapabilityService.getDefaultStatus(platform)
      await this.commentCapabilityService.save(dto.accountId, defaultStatus.status, defaultStatus.reason)
      return {
        comments: [],
        cursor: dto.cursor || '',
        hasMore: false,
        capabilityStatus: defaultStatus.status,
        capabilityReason: defaultStatus.reason,
        fetchBatch: '',
        postSaved: false,
        commentsSaved: 0,
      }
    }

    const fetchBatch = 'fetchBatch' in dto && dto.fetchBatch ? dto.fetchBatch : uuidv4()
    const result = await provider.fetchWorkAndComments({ ...dto, platform, userId, fetchBatch })
    const enriched = { ...result, fetchBatch }
    await this.commentCapabilityService.save(dto.accountId, enriched.capabilityStatus, enriched.capabilityReason, {
      platform,
      fetchedAt: new Date().toISOString(),
    })

    if (enriched.capabilityStatus !== AcquisitionCapabilityStatus.Ready) {
      return { ...enriched, postSaved: false, commentsSaved: 0 }
    }

    return await this.snapshotPersistenceService.persistFetchResult(enriched)
  }

  async enqueueCommentFetch(userId: string, dto: AcquisitionFetchWorkDto) {
    const fetchBatch = uuidv4()
    return await this.queueService.addAcquisitionCommentFetchJob({ userId, fetchBatch, ...dto })
  }

  /** 回作者主页刷新各作品访问令牌(平台 provider 支持时) */
  async refreshTokens(platform: AcquisitionPlatform | AcquisitionFetchWorkDto['platform'], authorUserId: string) {
    const provider = this.providers[this.toPlatform(platform)]
    if (!provider?.refreshTokens)
      return []
    return await provider.refreshTokens(authorUserId)
  }

  async getCapability(accountId: string, platformValue: AcquisitionPlatform | AcquisitionFetchWorkDto['platform']) {
    const platform = this.toPlatform(platformValue)
    const provider = this.providers[platform]
    if (!provider) {
      return this.commentCapabilityService.getDefaultStatus(platform)
    }
    const capability = await provider.getCapabilityStatus(accountId)
    await this.commentCapabilityService.save(accountId, capability.status, capability.reason, capability.meta || {})
    return capability
  }

  async listComments(query: { accountId: string, platform: AcquisitionPlatform | AcquisitionFetchWorkDto['platform'], postId: string, limit: number }) {
    return await this.commentSnapshotRepository.listByPost(query.accountId, this.toPlatform(query.platform), query.postId, query.limit)
  }

  private toPlatform(platform: AcquisitionPlatform | AcquisitionFetchWorkDto['platform']): AcquisitionPlatform {
    switch (String(platform)) {
      case AcquisitionPlatform.Xhs:
        return AcquisitionPlatform.Xhs
      case AcquisitionPlatform.Douyin:
        return AcquisitionPlatform.Douyin
      case AcquisitionPlatform.Kwai:
        return AcquisitionPlatform.Kwai
      default:
        return AcquisitionPlatform.Kwai
    }
  }
}
