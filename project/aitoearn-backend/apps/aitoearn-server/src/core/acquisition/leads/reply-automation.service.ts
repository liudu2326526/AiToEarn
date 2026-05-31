import { Injectable } from '@nestjs/common'
import { QueueService } from '@yikart/aitoearn-queue'
import {
  LeadActivityLogRepository,
  LeadReplyExecutorKind,
  LeadReplyTaskRepository,
  LeadReplyTaskStatus,
  LeadRepository,
} from '@yikart/channel-db'
import { AppException, ResponseCode } from '@yikart/common'
import {
  AutoReplyLeadDto,
  BatchAutoReplyLeadsDto,
  LeadReplyTaskListQueryDto,
} from './acquisition-leads.dto'
import { ReplySuggestionService } from './reply-suggestion.service'

interface LeadLike {
  id: string
  userId?: string
  platform: string
  accountId: string
  postId: string
  postUrl: string
  commentId: string
  parentCommentId?: string
  replyStyle?: string
  suggestedReply?: {
    content?: string
    status?: string
    riskHits?: string[]
  }
}

interface ReplyTaskLike {
  id: string
  leadId: string
  platform: string
  postId?: string
  postUrl?: string
  commentId?: string
  replyContent?: string
  status: LeadReplyTaskStatus
}

@Injectable()
export class ReplyAutomationService {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly leadReplyTaskRepository: LeadReplyTaskRepository,
    private readonly leadActivityLogRepository: LeadActivityLogRepository,
    private readonly replySuggestionService: ReplySuggestionService,
    private readonly queueService: QueueService,
  ) {}

  async createSingleTask(userId: string, id: string, body: AutoReplyLeadDto, operatorId: string) {
    const lead = await this.leadRepository.getByIdAndUser(id, userId) as LeadLike | null
    if (!lead) throw new AppException(ResponseCode.LeadNotFound)
    if (lead.platform !== 'xhs') throw new AppException(ResponseCode.PlatformNotSupported)

    const prepared = await this.prepareLead(userId, lead, body.regenerate, operatorId)
    if (body.dryRun) {
      return { task: null, lead: prepared.lead, dryRun: true }
    }

    if (prepared.lead.suggestedReply?.status !== 'blocked') {
      this.assertExecutableXhsLead(prepared.lead)
    }

    const task = await this.createTaskFromLead(
      userId,
      prepared.lead,
      prepared.replyContent,
      operatorId,
      body.requireSuggestionReview ? LeadReplyTaskStatus.HumanRequired : undefined,
    )
    if (task.status === LeadReplyTaskStatus.Queued) {
      await this.queueService.addAcquisitionLeadReplyTaskJob({ taskId: task.id })
    }

    return { task, lead: prepared.lead }
  }

  async createBatchTasks(userId: string, body: BatchAutoReplyLeadsDto, operatorId: string) {
    const [leads, total] = await this.leadRepository.listByUser(userId, {
      ...body,
      ...(body.onlyPending && !body.status ? { status: 'pending' } : {}),
      page: 1,
      pageSize: body.limit,
    }) as readonly [LeadLike[], number]

    const summary = {
      matched: Math.min(total, body.limit),
      queued: 0,
      blocked: 0,
      skipped: 0,
      failed: 0,
      taskIds: [] as string[],
    }

    for (const lead of leads) {
      const prepared = await this.prepareLead(userId, lead, false, operatorId)
      const status = this.resolveBatchStatus(prepared.lead)
      if (status === LeadReplyTaskStatus.Queued) summary.queued += 1
      else if (status === LeadReplyTaskStatus.Blocked) summary.blocked += 1
      else if (status === LeadReplyTaskStatus.HumanRequired) summary.skipped += 1
      else summary.failed += 1

      if (body.dryRun) continue

      const task = await this.createTaskFromLead(
        userId,
        prepared.lead,
        prepared.replyContent,
        operatorId,
        status,
      )
      summary.taskIds.push(task.id)
      if (task.status === LeadReplyTaskStatus.Queued) {
        await this.queueService.addAcquisitionLeadReplyTaskJob({ taskId: task.id })
      }
    }

    return summary
  }

  async listTasks(userId: string, query: LeadReplyTaskListQueryDto) {
    const [list, total] = await this.leadReplyTaskRepository.listByUser(userId, query)
    return {
      list,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    }
  }

  async cancelTask(userId: string, taskId: string, operatorId: string) {
    const task = await this.leadReplyTaskRepository.getByIdAndUser(taskId, userId) as ReplyTaskLike | null
    if (!task) throw new AppException(ResponseCode.ValidationFailed, 'Reply task not found')
    if (![LeadReplyTaskStatus.Pending, LeadReplyTaskStatus.Queued].includes(task.status)) {
      throw new AppException(ResponseCode.ValidationFailed, 'Only pending or queued tasks can be cancelled')
    }

    const updated = await this.leadReplyTaskRepository.markTerminal(task.id, LeadReplyTaskStatus.Cancelled, {
      lastError: 'operator_cancelled',
    })
    await this.leadActivityLogRepository.append({
      userId,
      leadId: task.leadId,
      action: 'reply_task_cancelled',
      operatorId,
      note: task.replyContent || '',
    })
    return updated
  }

  async retryTask(userId: string, taskId: string, operatorId: string) {
    const task = await this.leadReplyTaskRepository.getByIdAndUser(taskId, userId) as ReplyTaskLike | null
    if (!task) throw new AppException(ResponseCode.ValidationFailed, 'Reply task not found')
    if (task.platform !== 'xhs') {
      throw new AppException(ResponseCode.ValidationFailed, 'Only Xiaohongshu reply tasks can be retried')
    }
    if (![LeadReplyTaskStatus.Failed, LeadReplyTaskStatus.HumanRequired].includes(task.status)) {
      throw new AppException(ResponseCode.ValidationFailed, 'Only failed or human-required tasks can be retried')
    }
    this.assertExecutableXhsTask(task)

    const updated = await this.leadReplyTaskRepository.markQueued(task.id)
    await this.queueService.addAcquisitionLeadReplyTaskJob({ taskId: task.id })
    await this.leadActivityLogRepository.append({
      userId,
      leadId: task.leadId,
      action: 'reply_task_retry_queued',
      operatorId,
      note: task.replyContent,
    })
    return updated
  }

  private async prepareLead(userId: string, lead: LeadLike, regenerate: boolean, operatorId: string) {
    const currentStatus = String(lead.suggestedReply?.status || '')
    const currentContent = String(lead.suggestedReply?.content || '').trim()
    if (regenerate || !currentContent || !['generated', 'blocked', 'edited'].includes(currentStatus)) {
      const updated = await this.replySuggestionService.generate(userId, lead.id, operatorId)
      lead = updated as LeadLike
    }

    return {
      lead,
      replyContent: String(lead.suggestedReply?.content || '').trim(),
    }
  }

  private resolveBatchStatus(lead: LeadLike) {
    if (lead.platform !== 'xhs') return LeadReplyTaskStatus.HumanRequired
    if (lead.suggestedReply?.status === 'blocked') return LeadReplyTaskStatus.Blocked
    if (!this.hasExecutableXhsFields(lead)) return LeadReplyTaskStatus.HumanRequired
    return LeadReplyTaskStatus.Queued
  }

  private async createTaskFromLead(
    userId: string,
    lead: LeadLike,
    replyContent: string,
    operatorId: string,
    forcedStatus?: LeadReplyTaskStatus,
  ) {
    const status = forcedStatus
      || (lead.suggestedReply?.status === 'blocked' ? LeadReplyTaskStatus.Blocked : LeadReplyTaskStatus.Queued)
    const lastError = this.resolveTaskError(lead, status)
    const task = await this.leadReplyTaskRepository.create({
      userId,
      leadId: lead.id,
      platform: lead.platform,
      accountId: lead.accountId,
      postId: lead.postId,
      postUrl: lead.postUrl,
      commentId: lead.commentId,
      parentCommentId: lead.parentCommentId || '',
      replyContent,
      replyStyle: lead.replyStyle || 'auto',
      status,
      executorKind: LeadReplyExecutorKind.BrowserPlugin,
      attemptCount: 0,
      rateKey: `${userId}:${lead.platform}:${lead.accountId}`,
      lastError,
    } as any)

    await this.leadActivityLogRepository.append({
      userId,
      leadId: lead.id,
      action: status === LeadReplyTaskStatus.Queued ? 'reply_task_queued' : 'reply_task_created',
      operatorId,
      note: lastError || replyContent,
    })
    return task
  }

  private resolveTaskError(lead: LeadLike, status: LeadReplyTaskStatus) {
    if (status === LeadReplyTaskStatus.Blocked) {
      return `blocked: ${(lead.suggestedReply?.riskHits || []).join(',')}`.trim()
    }
    if (status === LeadReplyTaskStatus.HumanRequired) {
      if (lead.platform !== 'xhs') return 'platform_not_supported'
      if (!lead.commentId) return 'missing_comment_id'
      if (!lead.postId) return 'missing_post_id'
      if (!lead.postUrl) return 'missing_post_url'
      if (!String(lead.postUrl).includes('xsec_token=')) return 'missing_xsec_token'
    }
    return ''
  }

  private assertExecutableXhsLead(lead: LeadLike) {
    if (!this.hasExecutableXhsFields(lead)) {
      throw new AppException(ResponseCode.ValidationFailed, this.resolveTaskError(lead, LeadReplyTaskStatus.HumanRequired))
    }
  }

  private assertExecutableXhsTask(task: ReplyTaskLike) {
    if (!task.postId) throw new AppException(ResponseCode.ValidationFailed, 'missing_post_id')
    if (!task.postUrl) throw new AppException(ResponseCode.ValidationFailed, 'missing_post_url')
    if (!String(task.postUrl).includes('xsec_token=')) throw new AppException(ResponseCode.ValidationFailed, 'missing_xsec_token')
    if (!task.commentId) throw new AppException(ResponseCode.ValidationFailed, 'missing_comment_id')
    if (!String(task.replyContent || '').trim()) throw new AppException(ResponseCode.ValidationFailed, 'missing_reply_content')
  }

  private hasExecutableXhsFields(lead: LeadLike) {
    return Boolean(
      lead.commentId
      && lead.postId
      && lead.postUrl
      && String(lead.postUrl).includes('xsec_token='),
    )
  }
}
