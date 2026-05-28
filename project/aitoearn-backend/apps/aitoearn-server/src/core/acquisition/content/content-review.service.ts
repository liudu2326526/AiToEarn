import { Injectable } from '@nestjs/common'
import { AcquisitionContentRepository, AcquisitionContentStatus } from '@yikart/channel-db'
import { AppException, ResponseCode } from '@yikart/common'
import { SensitiveWordService } from '../../sensitive-word/sensitive-word.service'
import { ListAcquisitionContentDto, ReviewAcquisitionContentDto, UpdatePlatformContentDto } from './acquisition-content.dto'

@Injectable()
export class ContentReviewService {
  constructor(
    private readonly acquisitionContentRepository: AcquisitionContentRepository,
    private readonly sensitiveWordService: SensitiveWordService,
  ) {}

  async list(userId: string, query: ListAcquisitionContentDto) {
    return await this.acquisitionContentRepository.listByUser({
      userId,
      ...query,
      status: query.status as AcquisitionContentStatus,
    })
  }

  async review(userId: string, id: string, dto: ReviewAcquisitionContentDto) {
    const content = await this.acquisitionContentRepository.getByIdAndUserId(id, userId)
    if (!content) throw new AppException(ResponseCode.AcquisitionContentNotFound)
    if (content.status !== AcquisitionContentStatus.PendingReview) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'status', expected: AcquisitionContentStatus.PendingReview, actual: content.status })
    }
    const status = dto.action === 'approve' ? AcquisitionContentStatus.Approved : AcquisitionContentStatus.Rejected
    return await this.acquisitionContentRepository.updateStatusById(id, userId, status, {
      reviewerId: userId,
      reviewNote: dto.note || '',
      reviewedAt: new Date(),
    })
  }

  async updatePlatformContent(userId: string, id: string, dto: UpdatePlatformContentDto) {
    const content = await this.acquisitionContentRepository.getByIdAndUserId(id, userId)
    if (!content) throw new AppException(ResponseCode.AcquisitionContentNotFound)
    if (![AcquisitionContentStatus.PendingReview, AcquisitionContentStatus.Rejected].includes(content.status)) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'status', expected: [AcquisitionContentStatus.PendingReview, AcquisitionContentStatus.Rejected], actual: content.status })
    }
    const safety = this.sensitiveWordService.check(`${dto.title}\n${dto.body}\n${dto.topics.join(' ')}`)
    if (!safety.passed) {
      throw new AppException(ResponseCode.ValidationFailed, { field: 'content', reason: 'public_content_blocked_words', hits: safety.hits })
    }
    const next = content.platformContents.map(item => item.platform === dto.platform ? { ...item, ...dto } : item)
    return await this.acquisitionContentRepository.updatePlatformContentsById(id, userId, next)
  }
}
