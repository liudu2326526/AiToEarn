export interface PlatformReplyRequest {
  taskId: string
  postId: string
  postUrl: string
  commentId: string
  replyContent: string
}

export interface PlatformReplyResult {
  success: boolean
  platformReplyId?: string
  screenshotDataUrl?: string
  needHumanAssist?: boolean
  failureReason?: string
}

export interface PlatformReplyAdapter {
  execute(request: PlatformReplyRequest): Promise<PlatformReplyResult>
}
