import { Injectable } from '@nestjs/common'
import { XhsBridgeService } from '../../../xhs-bridge/xhs-bridge.service'
import type { PlatformReplyAdapter, PlatformReplyRequest, PlatformReplyResult } from './index'

@Injectable()
export class XhsBrowserPluginReplyAdapter implements PlatformReplyAdapter {
  constructor(private readonly xhsBridgeService: XhsBridgeService) {}

  async execute(request: PlatformReplyRequest): Promise<PlatformReplyResult> {
    const result = await this.xhsBridgeService.callExtension<{
      success?: boolean
      replyId?: string
      screenshotDataUrl?: string
      needHumanAssist?: boolean
      verificationReason?: string
      message?: string
    }>('post_comment_reply', {
      noteId: request.postId,
      postUrl: request.postUrl,
      commentId: request.commentId,
      content: request.replyContent,
      visibleTab: true,
      screenshotPolicy: 'failure',
    }, 90000)

    return {
      success: Boolean(result.success),
      platformReplyId: result.replyId || '',
      screenshotDataUrl: result.screenshotDataUrl || '',
      needHumanAssist: Boolean(result.needHumanAssist),
      failureReason: result.verificationReason || result.message || '',
    }
  }
}
