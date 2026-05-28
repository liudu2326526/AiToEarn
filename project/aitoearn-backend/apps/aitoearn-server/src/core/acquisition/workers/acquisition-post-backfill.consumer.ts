import { WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { AcquisitionPostBackfillData, QueueName, QueueProcessor } from '@yikart/aitoearn-queue'
import { Job } from 'bullmq'
import { AcquisitionPlatform } from '../acquisition.constants'
import { AcquisitionService } from '../acquisition.service'

@QueueProcessor(QueueName.AcquisitionPostBackfill, {
  concurrency: 3,
  stalledInterval: 30000,
  maxStalledCount: 1,
})
export class AcquisitionPostBackfillConsumer extends WorkerHost {
  private readonly logger = new Logger(AcquisitionPostBackfillConsumer.name)

  constructor(private readonly acquisitionService: AcquisitionService) {
    super()
  }

  async process(job: Job<AcquisitionPostBackfillData>) {
    const { userId, accountId, platform, postUrl, postId } = job.data
    if (!userId) {
      this.logger.warn(`Skip acquisition post backfill without userId: ${JSON.stringify(job.data)}`)
      return
    }

    return await this.acquisitionService.fetchNow(userId, {
      accountId,
      platform: platform as AcquisitionPlatform,
      postUrl,
      postId,
    })
  }
}
