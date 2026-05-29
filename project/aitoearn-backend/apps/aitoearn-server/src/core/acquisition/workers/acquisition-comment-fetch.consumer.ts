import { WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { AcquisitionCommentFetchData, QueueName, QueueProcessor } from '@yikart/aitoearn-queue'
import { RedlockService } from '@yikart/redlock'
import { Job } from 'bullmq'
import { randomUUID } from 'crypto'
import { AcquisitionPlatform } from '../acquisition.constants'
import { AcquisitionService } from '../acquisition.service'
import { WorkDataService } from '../work-data/work-data.service'

@QueueProcessor(QueueName.AcquisitionCommentFetch, {
  concurrency: 3,
  stalledInterval: 30000,
  maxStalledCount: 1,
})
export class AcquisitionCommentFetchConsumer extends WorkerHost {
  private readonly logger = new Logger(AcquisitionCommentFetchConsumer.name)

  constructor(
    private readonly acquisitionService: AcquisitionService,
    private readonly redlockService: RedlockService,
    private readonly workDataService: WorkDataService,
  ) {
    super()
  }

  async process(job: Job<AcquisitionCommentFetchData>) {
    const { userId, accountId, platform, postUrl, postId, cursor, fetchBatch } = job.data
    const lockKey = `acquisition:comment-fetch:${platform}:${accountId}`
    const lockValue = randomUUID()
    const locked = await this.redlockService.acquireLock(lockKey, lockValue, 120)
    if (!locked) {
      this.logger.warn(`Skip duplicate acquisition comment fetch for ${platform}:${accountId}`)
      return
    }

    try {
      return await this.workDataService.processWorkerFetch(userId, {
        accountId,
        platform,
        postUrl,
        postId,
        cursor,
        fetchBatch,
      })
    }
    finally {
      await this.redlockService.releaseLock(lockKey, lockValue)
    }
  }
}
