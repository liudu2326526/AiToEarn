import { Injectable } from '@nestjs/common'
import { AccountType } from '@yikart/aitoearn-server-client'
import { AcquisitionContentRepository, AcquisitionContentStatus } from '@yikart/channel-db'
import { AppException, ResponseCode } from '@yikart/common'
import { PublishRecordSource, PublishType } from '@yikart/mongodb'
import { PublishingService } from '../../channel/publishing/publishing.service'
import { ScheduleAcquisitionContentDto } from './acquisition-content.dto'

@Injectable()
export class ContentScheduleService {
  constructor(
    private readonly acquisitionContentRepository: AcquisitionContentRepository,
    private readonly publishingService: PublishingService,
  ) {}

  async schedule(userId: string, id: string, dto: ScheduleAcquisitionContentDto) {
    const content = await this.acquisitionContentRepository.getByIdAndUserId(id, userId)
    if (!content) throw new AppException(ResponseCode.AcquisitionContentNotFound)
    if (content.status !== AcquisitionContentStatus.Approved) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'status', expected: AcquisitionContentStatus.Approved, actual: content.status })
    }

    const nextPlatformContents = []
    const accountMap = dto.accountMap || {}
    for (const item of content.platformContents) {
      const accountId = (accountMap as any)[item.platform]
      if (!accountId) {
        throw new AppException(ResponseCode.ValidationFailed, { field: 'accountMap', platform: item.platform, reason: 'missing_platform_account' })
      }
      const publishRecord = await this.publishingService.createPublishingTask({
        flowId: `acquisition:${id}:${item.platform}`,
        accountId,
        accountType: this.toAccountType(item.platform),
        type: PublishType.ARTICLE,
        title: item.title,
        desc: item.body,
        topics: item.topics,
        publishTime: dto.publishAt,
        source: PublishRecordSource.PUBLISH,
      })
      // 兼容抖音返回结构，抖音 immediatePublish 返回值中可能不包含 id，但发布系统中 flowId 是唯一的
      let publishRecordId = (publishRecord as any).id
      if (!publishRecordId && item.platform === 'douyin') {
        const records = await this.publishingService.getPublishTaskListByFlowId(`acquisition:${id}:${item.platform}`)
        publishRecordId = records[0]?.id
      }

      nextPlatformContents.push({ ...item, accountId, publishRecordId: publishRecordId || '' })
    }

    await this.acquisitionContentRepository.updatePlatformContentsById(id, userId, nextPlatformContents)
    return await this.acquisitionContentRepository.updateStatusById(id, userId, AcquisitionContentStatus.Scheduled, {
      scheduledAt: dto.publishAt,
    })
  }

  private toAccountType(platform: 'xhs' | 'douyin' | 'kwai') {
    if (platform === 'xhs') return AccountType.Xhs
    if (platform === 'douyin') return AccountType.Douyin
    return AccountType.KWAI
  }
}
