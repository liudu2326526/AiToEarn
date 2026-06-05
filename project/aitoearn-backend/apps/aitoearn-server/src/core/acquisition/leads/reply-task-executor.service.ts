import { Injectable } from '@nestjs/common'
import {
  LeadActivityLogRepository,
  LeadReplyTaskRepository,
  LeadReplyTaskStatus,
} from '@yikart/channel-db'
import { AppException, ResponseCode } from '@yikart/common'
import { PlatformReplyAdapterRegistry } from './platform-reply-adapters/registry'
import { ReplyExecutionService } from './reply-execution.service'
import { ReplyTaskScreenshotService } from './reply-task-screenshot.service'

interface ReplyTask {
  id: string
  userId: string
  leadId: string
  platform: string
  postId: string
  postUrl: string
  commentId: string
  targetType?: 'public_comment' | 'private_message'
  targetIdentity?: Record<string, unknown>
  replyContent: string
  dryRun?: boolean
  status: LeadReplyTaskStatus
}

@Injectable()
export class ReplyTaskExecutorService {
  constructor(
    private readonly leadReplyTaskRepository: LeadReplyTaskRepository,
    private readonly leadActivityLogRepository: LeadActivityLogRepository,
    private readonly replyExecutionService: ReplyExecutionService,
    private readonly platformReplyAdapterRegistry: PlatformReplyAdapterRegistry,
    private readonly replyTaskScreenshotService: ReplyTaskScreenshotService,
  ) {}

  async execute(taskId: string, operatorId = 'system') {
    const task = await this.leadReplyTaskRepository.getById(taskId) as ReplyTask | null
    if (!task)
      return null
    if (task.status === LeadReplyTaskStatus.Cancelled)
      return task

    const runningTask = await this.leadReplyTaskRepository.markRunning(task.id) as ReplyTask | null
    const executableTask = runningTask || task

    try {
      const adapter = this.platformReplyAdapterRegistry.get(executableTask.platform)
      const adapterResult = await adapter.execute({
        taskId: executableTask.id,
        targetType: executableTask.targetType || 'public_comment',
        targetIdentity: executableTask.targetIdentity || {},
        postId: executableTask.postId,
        postUrl: executableTask.postUrl,
        commentId: executableTask.commentId,
        replyContent: executableTask.replyContent,
        dryRun: executableTask.dryRun,
      })

      const screenshotPatch: { screenshotUrl?: string } = {}
      let screenshotUploadError = ''
      if (adapterResult.screenshotDataUrl) {
        try {
          const screenshotUrl = await this.replyTaskScreenshotService.uploadScreenshot(
            executableTask.userId,
            executableTask.id,
            adapterResult.screenshotDataUrl,
          )
          if (screenshotUrl)
            screenshotPatch.screenshotUrl = screenshotUrl
        }
        catch (error) {
          screenshotUploadError = error instanceof Error ? error.message : String(error)
        }
      }

      if (adapterResult.success) {
        const failureReason = screenshotUploadError ? `screenshot_upload_failed: ${screenshotUploadError}` : ''
        const updated = await this.leadReplyTaskRepository.markTerminal(
          executableTask.id,
          LeadReplyTaskStatus.Success,
          {
            ...screenshotPatch,
            platformReplyId: adapterResult.platformReplyId || '',
            lastError: failureReason,
          },
        )
        await this.replyExecutionService.recordResult(executableTask.userId, executableTask.leadId, {
          replyContent: executableTask.replyContent,
          status: 'success',
          executionMode: 'platform_adapter',
          failureReason: '',
        }, operatorId)
        return updated
      }

      const terminalStatus = adapterResult.needHumanAssist
        ? LeadReplyTaskStatus.HumanRequired
        : LeadReplyTaskStatus.Failed
      const lastError = [
        adapterResult.failureReason || 'platform_reply_failed',
        screenshotUploadError ? `screenshot_upload_failed: ${screenshotUploadError}` : '',
      ].filter(Boolean).join('; ')
      const updated = await this.leadReplyTaskRepository.markTerminal(executableTask.id, terminalStatus, {
        ...screenshotPatch,
        platformReplyId: adapterResult.platformReplyId || '',
        lastError,
      })

      if (terminalStatus === LeadReplyTaskStatus.HumanRequired) {
        await this.leadActivityLogRepository.append({
          userId: executableTask.userId,
          leadId: executableTask.leadId,
          action: 'reply_task_human_required',
          operatorId,
          note: lastError,
        })
      }
      else {
        await this.replyExecutionService.recordResult(executableTask.userId, executableTask.leadId, {
          replyContent: executableTask.replyContent,
          status: 'failed',
          executionMode: 'platform_adapter',
          failureReason: lastError,
        }, operatorId)
      }

      return updated
    }
    catch (error) {
      if (error instanceof AppException && error.code === ResponseCode.PlatformNotSupported) {
        const updated = await this.leadReplyTaskRepository.markTerminal(executableTask.id, LeadReplyTaskStatus.HumanRequired, {
          lastError: 'platform_not_supported',
        })
        await this.leadActivityLogRepository.append({
          userId: executableTask.userId,
          leadId: executableTask.leadId,
          action: 'reply_task_human_required',
          operatorId,
          note: 'platform_not_supported',
        })
        return updated
      }

      const lastError = error instanceof Error ? error.message : String(error)
      const updated = await this.leadReplyTaskRepository.markTerminal(executableTask.id, LeadReplyTaskStatus.Failed, {
        lastError,
      })
      await this.leadActivityLogRepository.append({
        userId: executableTask.userId,
        leadId: executableTask.leadId,
        action: 'reply_failed',
        operatorId,
        note: lastError,
      })
      return updated
    }
  }
}
