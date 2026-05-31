import { WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { AcquisitionLeadReplyTaskData, QueueName, QueueProcessor } from '@yikart/aitoearn-queue'
import { LeadReplyTaskRepository } from '@yikart/channel-db'
import { Job } from 'bullmq'
import { ReplyTaskExecutorService } from '../leads/reply-task-executor.service'

const MIN_REPLY_INTERVAL_MS = 15000
const lastExecutionByRateKey = new Map<string, number>()

async function waitForRateKey(rateKey: string) {
  const now = Date.now()
  const last = lastExecutionByRateKey.get(rateKey) || 0
  const waitMs = Math.max(0, last + MIN_REPLY_INTERVAL_MS - now)
  if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs))
  lastExecutionByRateKey.set(rateKey, Date.now())
}

@QueueProcessor(QueueName.AcquisitionLeadReplyTask, {
  concurrency: 1,
  stalledInterval: 30000,
  maxStalledCount: 1,
})
export class LeadReplyTaskConsumer extends WorkerHost {
  private readonly logger = new Logger(LeadReplyTaskConsumer.name)

  constructor(
    private readonly leadReplyTaskRepository: LeadReplyTaskRepository,
    private readonly replyTaskExecutorService: ReplyTaskExecutorService,
  ) {
    super()
  }

  async process(job: Job<AcquisitionLeadReplyTaskData>) {
    const task = await this.leadReplyTaskRepository.getById(job.data.taskId)
    if (!task) {
      this.logger.warn(`Skip missing lead reply task ${job.data.taskId}`)
      return
    }

    if (task.rateKey) {
      await waitForRateKey(task.rateKey)
    }

    return await this.replyTaskExecutorService.execute(job.data.taskId, 'system')
  }
}
