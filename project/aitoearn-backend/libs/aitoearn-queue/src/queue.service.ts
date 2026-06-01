import type { Job, JobsOptions, Queue } from 'bullmq'
import type {
  AcquisitionCommentFetchData,
  AcquisitionLeadReplyTaskData,
  AcquisitionLeadNotifyData,
  AcquisitionPostBackfillData,
  AcquisitionSensitiveCheckData,
  AiImageData,
  AiTaskRefundData,
  DraftGenerationData,
  EngagementReplyToCommentData,
  EngagementTaskDistributionData,
  NotificationData,
  PostMediaTaskData,
  PostPublishData,
  UserEventBatchData,
} from './interfaces'
import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { QueueName } from './enums'
import { QueueConfig } from './queue.config'

/**
 * 统一的队列服务
 * 提供所有队列的操作方法
 */
@Injectable()
export class QueueService {
  private readonly defaultOptions: JobsOptions
  private readonly xhsTokenRefreshMaxDispatchCount = 3

  private getXhsTokenRefreshJobId(publishRecordId: string) {
    return `xhs-token-${publishRecordId}`
  }

  constructor(
    config: QueueConfig,
    @InjectQueue(QueueName.PostPublish)
    private postPublishQueue: Queue,
    @InjectQueue(QueueName.PostMediaTask)
    private postMediaTaskQueue: Queue,
    @InjectQueue(QueueName.AiImageAsync)
    private aiImageAsyncQueue: Queue,
    @InjectQueue(QueueName.EngagementTaskDistribution)
    private engagementTaskDistributionQueue: Queue,
    @InjectQueue(QueueName.EngagementReplyToComment)
    private engagementReplyToCommentQueue: Queue,
    @InjectQueue(QueueName.DumpSocialMediaAvatar)
    private dumpSocialMediaAvatarQueue: Queue,
    @InjectQueue(QueueName.UpdatePublishedPost)
    private updatePublishedPostQueue: Queue,
    @InjectQueue(QueueName.Notification)
    private notificationQueue: Queue,
    @InjectQueue(QueueName.AiTaskRefund)
    private aiTaskRefundQueue: Queue,
    @InjectQueue(QueueName.DraftGeneration)
    private draftGenerationQueue: Queue,
    @InjectQueue(QueueName.DraftGenerationLowPriority)
    private draftGenerationLowPriorityQueue: Queue,
    @InjectQueue(QueueName.UserEventBatch)
    private userEventBatchQueue: Queue,
    @InjectQueue(QueueName.AcquisitionCommentFetch)
    private acquisitionCommentFetchQueue: Queue,
    @InjectQueue(QueueName.AcquisitionPostBackfill)
    private acquisitionPostBackfillQueue: Queue,
    @InjectQueue(QueueName.AcquisitionLeadNotify)
    private acquisitionLeadNotifyQueue: Queue,
    @InjectQueue(QueueName.AcquisitionSensitiveCheck)
    private acquisitionSensitiveCheckQueue: Queue,
    @InjectQueue(QueueName.AcquisitionLeadReplyTask)
    private acquisitionLeadReplyTaskQueue: Queue,
    @InjectQueue(QueueName.XhsTokenRefresh)
    private xhsTokenRefreshQueue: Queue,
  ) {
    // 从配置中读取默认的 job options
    this.defaultOptions = config.jobOptions || {
      removeOnComplete: { age: 30, count: 1000 },
      removeOnFail: { age: 60, count: 1000 },
    }
  }

  /**
   * 添加发布任务
   */
  async addPostPublishJob(data: PostPublishData, options?: JobsOptions) {
    return await this.postPublishQueue.add('publish', data, {
      ...this.defaultOptions,
      jobId: data.jobId,
      ...options,
    })
  }

  /**
   * 获取发布任务
   */
  async getPostPublishJob(jobId: string): Promise<Job<PostPublishData> | undefined> {
    return await this.postPublishQueue.getJob(jobId)
  }

  /**
   * 添加发布媒体任务
   */
  async addPostMediaTaskJob(data: PostMediaTaskData, options?: JobsOptions) {
    return await this.postMediaTaskQueue.add('media', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  /**
   * 添加AI图片异步生成任务
   */
  async addAiImageAsyncJob(data: AiImageData, options?: JobsOptions) {
    return await this.aiImageAsyncQueue.add('generate', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  /**
   * 添加互动任务分发任务
   */
  async addEngagementTaskDistributionJob(
    data: EngagementTaskDistributionData,
    options?: JobsOptions,
  ) {
    return await this.engagementTaskDistributionQueue.add('distribute', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addUpdatePublishedPostJob(data: { taskId: string, updatedContentType: string }, options?: JobsOptions) {
    return await this.updatePublishedPostQueue.add('update-published-post', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  /**
   * 添加评论回复任务
   */
  async addEngagementReplyToCommentJob(data: EngagementReplyToCommentData, options?: JobsOptions) {
    return await this.engagementReplyToCommentQueue.add('reply', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addDumpSocialMediaAvatarJob(data: { accountId: string }, options?: JobsOptions) {
    return await this.dumpSocialMediaAvatarQueue.add('dump-social-avatar', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addNotificationJob(data: NotificationData, options?: JobsOptions) {
    return await this.notificationQueue.add('send-notification', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  /**
   * 添加 AI任务失败退款处理任务
   */
  async addAiTaskRefundJob(data: AiTaskRefundData, options?: JobsOptions) {
    return await this.aiTaskRefundQueue.add('refund', data, {
      ...this.defaultOptions,
      jobId: data.taskId,
      removeOnComplete: {
        age: 60 * 60,
      },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      ...options,
    })
  }

  /**
   * 添加 DraftGeneration 生成任务
   */
  async addDraftGenerationJob(data: DraftGenerationData, options?: JobsOptions) {
    return await this.draftGenerationQueue.add('generate', data, {
      ...this.defaultOptions,
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      ...options,
    })
  }

  /**
   * 添加低优先级 DraftGeneration 生成任务
   */
  async addLowPriorityDraftGenerationJob(data: DraftGenerationData, options?: JobsOptions) {
    return await this.draftGenerationLowPriorityQueue.add('generate', data, {
      ...this.defaultOptions,
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      ...options,
    })
  }

  /**
   * 添加用户事件批量写入任务
   */
  async addUserEventBatchJob(data: UserEventBatchData, options?: JobsOptions) {
    return await this.userEventBatchQueue.add('batch-insert', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addAcquisitionCommentFetchJob(data: AcquisitionCommentFetchData, options?: JobsOptions) {
    return await this.acquisitionCommentFetchQueue.add('fetch-comments', data, {
      ...this.defaultOptions,
      jobId: `${data.platform}:${data.accountId}:${data.postId}:${data.fetchBatch}`,
      ...options,
    })
  }

  async addAcquisitionPostBackfillJob(data: AcquisitionPostBackfillData, options?: JobsOptions) {
    return await this.acquisitionPostBackfillQueue.add('backfill-post', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addAcquisitionLeadNotifyJob(data: AcquisitionLeadNotifyData, options?: JobsOptions) {
    return await this.acquisitionLeadNotifyQueue.add('notify-lead', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addAcquisitionSensitiveCheckJob(data: AcquisitionSensitiveCheckData, options?: JobsOptions) {
    return await this.acquisitionSensitiveCheckQueue.add('check-sensitive', data, {
      ...this.defaultOptions,
      ...options,
    })
  }

  async addAcquisitionLeadReplyTaskJob(data: AcquisitionLeadReplyTaskData, options?: JobsOptions) {
    return await this.acquisitionLeadReplyTaskQueue.add(QueueName.AcquisitionLeadReplyTask, data, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 30000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
      ...options,
    })
  }

  /**
   * 添加小红书 Token 刷新任务
   */
  async addXhsTokenRefreshJob(data: { publishRecordId: string; monitoredPostId?: string; userId: string; noteId: string; scanLatest?: boolean; publishTime?: number }, options?: JobsOptions) {
    return await this.xhsTokenRefreshQueue.add('refresh-token', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 60000 },
      jobId: this.getXhsTokenRefreshJobId(data.publishRecordId),
      removeOnComplete: 100,
      removeOnFail: 100,
      ...options,
    })
  }

  /**
   * 获取待处理的小红书 Token 刷新任务
   * 注意：不会立即移除任务，需要在成功处理后调用 removeXhsTokenRefreshJob
   */
  async getXhsTokenRefreshJobs(userId?: string, limit = 50): Promise<Array<{ publishRecordId: string; monitoredPostId?: string; userId: string; noteId: string; scanLatest?: boolean; publishTime?: number }>> {
    const jobs = await this.xhsTokenRefreshQueue.getWaiting(0, limit - 1)
    const matchedJobs = userId
      ? jobs.filter(job => (job.data as { userId?: string }).userId === userId)
      : jobs
    const dispatchableJobs = matchedJobs.filter((job) => {
      const data = job.data as { processingCount?: number }
      return (data.processingCount || 0) < this.xhsTokenRefreshMaxDispatchCount
    })

    // 标记为处理中，但不删除任务
    const now = Date.now()
    await Promise.allSettled(dispatchableJobs.map(job =>
      job.updateData({
        ...job.data,
        processingAt: now,
        processingCount: ((job.data as any).processingCount || 0) + 1,
      })
    ))

    return dispatchableJobs.map(job => job.data as { publishRecordId: string; monitoredPostId?: string; userId: string; noteId: string; scanLatest?: boolean; publishTime?: number })
  }

  /**
   * 移除已完成的小红书 Token 刷新任务
   */
  async removeXhsTokenRefreshJob(publishRecordId: string): Promise<void> {
    const jobId = this.getXhsTokenRefreshJobId(publishRecordId)
    const job = await this.xhsTokenRefreshQueue.getJob(jobId)
    if (job) {
      await job.remove()
    }
  }

  /**
   * 清理超时的刷新任务（超过 10 分钟未完成的任务重新加入队列）
   */
  async cleanupStaleXhsTokenRefreshJobs(): Promise<number> {
    const jobs = await this.xhsTokenRefreshQueue.getWaiting()
    const now = Date.now()
    const timeout = 10 * 60 * 1000 // 10 分钟
    let cleanedCount = 0

    for (const job of jobs) {
      const data = job.data as any
      if (data.processingAt && now - data.processingAt > timeout) {
        // 超时任务重置处理状态
        await job.updateData({
          ...data,
          processingAt: undefined,
          processingCount: 0,
        })
        cleanedCount++
      }
    }

    return cleanedCount
  }
}
