import type { PlatformReplyAdapter, PlatformReplyRequest, PlatformReplyResult } from './index'
import { Injectable } from '@nestjs/common'
import { DouyinCreatorAutomationService } from '../../douyin-creator-automation/douyin-creator-automation.service'

@Injectable()
export class DouyinCreatorReplyAdapter implements PlatformReplyAdapter {
  constructor(private readonly douyinCreatorAutomationService: DouyinCreatorAutomationService) {}

  async execute(request: PlatformReplyRequest): Promise<PlatformReplyResult> {
    const targetIdentity = request.targetIdentity || {}

    if (request.targetType === 'private_message') {
      const conversationUserName = String(targetIdentity['conversationUsername'] || targetIdentity['conversationUserName'] || '').trim()
      const lastMessage = String(targetIdentity['lastMessage'] || '').trim()
      if (!conversationUserName || !lastMessage) {
        return {
          success: false,
          needHumanAssist: true,
          failureReason: 'missing_dm_target_identity',
        }
      }

      return await this.douyinCreatorAutomationService.executeDmReply({
        conversationUserName,
        lastMessage,
        lastMessageTime: String(targetIdentity['lastMessageTime'] || ''),
        replyContent: request.replyContent,
        dryRun: request.dryRun !== false,
      })
    }

    const postTitle = String(targetIdentity['postTitle'] || '').trim()
    const commentUserName = String(targetIdentity['commentUserName'] || '').trim()
    const commentText = String(targetIdentity['commentText'] || '').trim()
    if (!postTitle || !commentUserName || !commentText) {
      return {
        success: false,
        needHumanAssist: true,
        failureReason: 'missing_comment_target_identity',
      }
    }

    return await this.douyinCreatorAutomationService.executeCommentReply({
      postTitle,
      postPublishText: String(targetIdentity['postPublishText'] || ''),
      commentUserName,
      commentText,
      replyContent: request.replyContent,
      dryRun: request.dryRun !== false,
    })
  }
}
