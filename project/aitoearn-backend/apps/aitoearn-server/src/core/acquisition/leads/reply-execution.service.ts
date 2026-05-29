import { Injectable } from '@nestjs/common'
import {
  LeadActivityLogRepository,
  LeadRepository,
  ReplyCommentRecordRepository,
} from '@yikart/channel-db'
import { AccountType, AppException, ResponseCode } from '@yikart/common'
import { ReplyResultDto } from './acquisition-leads.dto'

const ACCOUNT_TYPE_BY_PLATFORM = {
  xhs: AccountType.Xhs,
  douyin: AccountType.Douyin,
  kwai: AccountType.KWAI,
} as const

@Injectable()
export class ReplyExecutionService {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly replyCommentRecordRepository: ReplyCommentRecordRepository,
    private readonly leadActivityLogRepository: LeadActivityLogRepository,
  ) {}

  async recordResult(userId: string, id: string, body: ReplyResultDto, operatorId: string) {
    const lead = await this.leadRepository.getByIdAndUser(id, userId)
    if (!lead) throw new AppException(ResponseCode.LeadNotFound)

    const type = ACCOUNT_TYPE_BY_PLATFORM[lead.platform as keyof typeof ACCOUNT_TYPE_BY_PLATFORM]
    if (!type) throw new AppException(ResponseCode.PlatformNotSupported)

    const record = await this.replyCommentRecordRepository.addLeadReplyResult({
      userId,
      accountId: lead.accountId,
      leadId: lead.id,
      platform: lead.platform,
      type,
      worksId: lead.postId,
      commentId: lead.commentId,
      commentContent: lead.sourceContent,
      replyContent: body.replyContent,
      status: body.status,
      executionMode: body.executionMode,
      failureReason: body.failureReason || '',
    })

    const updated = await this.leadRepository.updateById(lead.id, {
      lastReplyRecordId: record.id,
      ...(body.status === 'success' && { stage: 'replied', status: 'in_progress' }),
      lastFollowUpAt: new Date(),
    } as any)

    await this.leadActivityLogRepository.append({
      userId,
      leadId: lead.id,
      action: body.status === 'failed' ? 'reply_failed' : 'reply_executed',
      operatorId,
      note: body.failureReason || body.replyContent,
    })

    return updated
  }
}
