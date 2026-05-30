import { WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { AcquisitionPostBackfillData, QueueName, QueueProcessor } from '@yikart/aitoearn-queue'
import { Job } from 'bullmq'
import { AcquisitionPlatform } from '../acquisition.constants'
import { AcquisitionService } from '../acquisition.service'
import { WorkDataService } from '../work-data/work-data.service'
import { AppException, ResponseCode } from '@yikart/common'

@QueueProcessor(QueueName.AcquisitionPostBackfill, {
  concurrency: 3,
  stalledInterval: 30000,
  maxStalledCount: 1,
})
export class AcquisitionPostBackfillConsumer extends WorkerHost {
  private readonly logger = new Logger(AcquisitionPostBackfillConsumer.name)

  constructor(
    private readonly acquisitionService: AcquisitionService,
    private readonly workDataService: WorkDataService,
  ) {
    super()
  }

  async process(job: Job<AcquisitionPostBackfillData>) {
    const { userId, accountId, platform, postUrl, postId, authorUserId, xsecToken, xsecSource } = job.data
    if (!userId) {
      this.logger.warn(`Skip acquisition post backfill without userId: ${JSON.stringify(job.data)}`)
      return
    }

    if (!postUrl) {
      this.logger.warn(`Post URL is missing for backfill job ${job.id}`)
      throw new AppException(ResponseCode.PublishedBackfillMissingPostUrl)
    }

    return await this.workDataService.processPostBackfill(userId, {
      accountId,
      platform,
      postUrl,
      postId,
      authorUserId,
      xsecToken,
      xsecSource,
    })
  }
}
