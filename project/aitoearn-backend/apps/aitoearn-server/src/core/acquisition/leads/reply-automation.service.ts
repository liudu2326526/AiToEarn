import { Injectable } from '@nestjs/common'
import { QueueService } from '@yikart/aitoearn-queue'
import {
  LeadActivityLogRepository,
  LeadReplyExecutorKind,
  LeadReplyTargetType,
  LeadReplyTaskRepository,
  LeadReplyTaskStatus,
  LeadRepository,
  LeadSourceType,
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
  postTitle?: string
  userName?: string
  sourceContent?: string
  sourceType?: string
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
  targetType?: string
  targetIdentity?: Record<string, unknown>
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
    if (!lead)
      throw new AppException(ResponseCode.LeadNotFound)
    if (!this.isSupportedReplyPlatform(lead.platform))
      throw new AppException(ResponseCode.PlatformNotSupported)

    const prepared = await this.prepareLead(userId, lead, body.regenerate, operatorId)
    if (body.dryRun) {
      return { task: null, lead: prepared.lead, dryRun: true }
    }

    if (prepared.lead.suggestedReply?.status !== 'blocked') {
      this.assertExecutableLead(prepared.lead)
    }

    const forcedStatus = body.requireSuggestionReview
      ? LeadReplyTaskStatus.HumanRequired
      : this.resolveBatchStatus(prepared.lead)
    const task = await this.createTaskFromLead(
      userId,
      prepared.lead,
      prepared.replyContent,
      operatorId,
      forcedStatus,
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
      if (status === LeadReplyTaskStatus.Queued)
        summary.queued += 1
      else if (status === LeadReplyTaskStatus.Blocked)
        summary.blocked += 1
      else if (status === LeadReplyTaskStatus.HumanRequired)
        summary.skipped += 1
      else summary.failed += 1

      if (body.dryRun)
        continue

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

  async createTasksForLeadIds(
    userId: string,
    leadIds: string[],
    options: {
      dryRun: boolean
      targetType: 'public_comment' | 'private_message'
      limit: number
    },
    operatorId: string,
  ) {
    const summary = {
      dryRun: options.dryRun,
      matched: 0,
      queued: 0,
      blocked: 0,
      skipped: 0,
      failed: 0,
      taskIds: [] as string[],
    }

    for (const leadId of leadIds.slice(0, options.limit)) {
      const lead = await this.leadRepository.getByIdAndUser(leadId, userId) as LeadLike | null
      if (!lead) {
        summary.skipped += 1
        continue
      }
      summary.matched += 1

      const prepared = await this.prepareLead(userId, lead, false, operatorId)
      const actualTargetType = this.resolveTargetType(prepared.lead)
      const status = actualTargetType === options.targetType
        ? this.resolveBatchStatus(prepared.lead, { allowPrivateMessage: true })
        : LeadReplyTaskStatus.HumanRequired

      if (status === LeadReplyTaskStatus.Queued)
        summary.queued += 1
      else if (status === LeadReplyTaskStatus.Blocked)
        summary.blocked += 1
      else if (status === LeadReplyTaskStatus.HumanRequired)
        summary.skipped += 1
      else summary.failed += 1

      const task = await this.createTaskFromLead(
        userId,
        prepared.lead,
        prepared.replyContent,
        operatorId,
        status,
        options.dryRun,
      )
      summary.taskIds.push(task.id)
      if (task.status === LeadReplyTaskStatus.Queued) {
        await this.queueService.addAcquisitionLeadReplyTaskJob({ taskId: task.id })
      }
    }

    return summary
  }

  async cancelTask(userId: string, taskId: string, operatorId: string) {
    const task = await this.leadReplyTaskRepository.getByIdAndUser(taskId, userId) as ReplyTaskLike | null
    if (!task)
      throw new AppException(ResponseCode.ValidationFailed, 'Reply task not found')
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
    if (!task)
      throw new AppException(ResponseCode.ValidationFailed, 'Reply task not found')
    if (!this.isSupportedReplyPlatform(task.platform)) {
      throw new AppException(ResponseCode.ValidationFailed, 'Unsupported reply task platform')
    }
    if (![LeadReplyTaskStatus.Failed, LeadReplyTaskStatus.HumanRequired].includes(task.status)) {
      throw new AppException(ResponseCode.ValidationFailed, 'Only failed or human-required tasks can be retried')
    }
    this.assertExecutableTask(task)

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

  private resolveBatchStatus(lead: LeadLike, options: { allowPrivateMessage?: boolean } = {}) {
    if (!this.isSupportedReplyPlatform(lead.platform))
      return LeadReplyTaskStatus.HumanRequired
    if (lead.suggestedReply?.status === 'blocked')
      return LeadReplyTaskStatus.Blocked
    if (
      lead.platform === 'douyin'
      && this.resolveTargetType(lead) === LeadReplyTargetType.PrivateMessage
      && !options.allowPrivateMessage
    ) {
      return LeadReplyTaskStatus.HumanRequired
    }
    if (!this.hasExecutableFields(lead))
      return LeadReplyTaskStatus.HumanRequired
    return LeadReplyTaskStatus.Queued
  }

  private async createTaskFromLead(
    userId: string,
    lead: LeadLike,
    replyContent: string,
    operatorId: string,
    forcedStatus?: LeadReplyTaskStatus,
    dryRun?: boolean,
  ) {
    const status = forcedStatus
      || (lead.suggestedReply?.status === 'blocked' ? LeadReplyTaskStatus.Blocked : LeadReplyTaskStatus.Queued)
    const lastError = this.resolveTaskError(lead, status)
    const taskDryRun = dryRun ?? lead.platform === 'douyin'
    const task = await this.leadReplyTaskRepository.create({
      userId,
      leadId: lead.id,
      platform: lead.platform,
      accountId: lead.accountId,
      postId: lead.postId,
      postUrl: lead.postUrl,
      commentId: lead.commentId,
      parentCommentId: lead.parentCommentId || '',
      targetType: this.resolveTargetType(lead),
      targetIdentity: this.buildTargetIdentity(lead),
      replyContent,
      replyStyle: lead.replyStyle || 'auto',
      status,
      executorKind: this.resolveExecutorKind(lead.platform),
      dryRun: taskDryRun,
      attemptCount: 0,
      rateKey: `${userId}:${lead.platform}:${lead.accountId}:${this.resolveTargetType(lead)}`,
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
      if (!this.isSupportedReplyPlatform(lead.platform))
        return 'platform_not_supported'
      if (lead.platform === 'xhs') {
        if (!lead.commentId)
          return 'missing_comment_id'
        if (!lead.postId)
          return 'missing_post_id'
        if (!lead.postUrl)
          return 'missing_post_url'
        if (!String(lead.postUrl).includes('xsec_token='))
          return 'missing_xsec_token'
      }
      if (lead.platform === 'douyin') {
        if (this.resolveTargetType(lead) === LeadReplyTargetType.PrivateMessage)
          return 'private_message_requires_explicit_confirmation'
        if (!lead.userName)
          return 'missing_target_user_name'
        if (!lead.sourceContent)
          return 'missing_source_content'
        if (this.resolveTargetType(lead) === LeadReplyTargetType.PublicComment && !lead.postTitle)
          return 'missing_post_title'
      }
    }
    return ''
  }

  private assertExecutableLead(lead: LeadLike) {
    if (!this.hasExecutableFields(lead)) {
      throw new AppException(ResponseCode.ValidationFailed, this.resolveTaskError(lead, LeadReplyTaskStatus.HumanRequired))
    }
  }

  private assertExecutableTask(task: ReplyTaskLike) {
    if (task.platform === 'xhs') {
      if (!task.postId)
        throw new AppException(ResponseCode.ValidationFailed, 'missing_post_id')
      if (!task.postUrl)
        throw new AppException(ResponseCode.ValidationFailed, 'missing_post_url')
      if (!String(task.postUrl).includes('xsec_token='))
        throw new AppException(ResponseCode.ValidationFailed, 'missing_xsec_token')
      if (!task.commentId)
        throw new AppException(ResponseCode.ValidationFailed, 'missing_comment_id')
    }
    if (task.platform === 'douyin' && !task.targetIdentity) {
      throw new AppException(ResponseCode.ValidationFailed, 'missing_target_identity')
    }
    if (!String(task.replyContent || '').trim())
      throw new AppException(ResponseCode.ValidationFailed, 'missing_reply_content')
  }

  private hasExecutableFields(lead: LeadLike) {
    if (lead.platform === 'douyin') {
      const hasCommonFields = Boolean(lead.userName && lead.sourceContent)
      if (this.resolveTargetType(lead) === LeadReplyTargetType.PrivateMessage)
        return hasCommonFields
      return Boolean(hasCommonFields && lead.postTitle)
    }

    return Boolean(
      lead.commentId
      && lead.postId
      && lead.postUrl
      && String(lead.postUrl).includes('xsec_token='),
    )
  }

  private isSupportedReplyPlatform(platform: string) {
    return platform === 'xhs' || platform === 'douyin'
  }

  private resolveExecutorKind(platform: string) {
    return platform === 'douyin' ? LeadReplyExecutorKind.DouyinCreatorCli : LeadReplyExecutorKind.BrowserPlugin
  }

  private resolveTargetType(lead: LeadLike) {
    return lead.sourceType === LeadSourceType.PrivateMessage
      ? LeadReplyTargetType.PrivateMessage
      : LeadReplyTargetType.PublicComment
  }

  private buildTargetIdentity(lead: LeadLike) {
    if (lead.platform !== 'douyin')
      return {}
    if (this.resolveTargetType(lead) === LeadReplyTargetType.PrivateMessage) {
      return {
        conversationUsername: lead.userName || '',
        lastMessage: lead.sourceContent || '',
        lastMessageTime: lead.postTitle || '',
      }
    }

    return {
      postTitle: lead.postTitle || '',
      postPublishText: '',
      commentUserName: lead.userName || '',
      commentText: lead.sourceContent || '',
    }
  }
}
