export interface PlatformReplyRequest {
  taskId: string
  targetType?: 'public_comment' | 'private_message'
  targetIdentity?: Record<string, unknown>
  postId?: string
  postUrl?: string
  commentId?: string
  replyContent: string
  dryRun?: boolean
}

export interface PlatformReplyResult {
  success: boolean
  platformReplyId?: string
  screenshotDataUrl?: string
  needHumanAssist?: boolean
  failureReason?: string
}

export interface PlatformReplyAdapter {
  execute: (request: PlatformReplyRequest) => Promise<PlatformReplyResult>
}
