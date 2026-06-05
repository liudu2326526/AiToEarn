import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DouyinCreatorReplyAdapter } from './douyin-creator-reply.adapter'

describe('douyinCreatorReplyAdapter', () => {
  const douyinCreatorAutomationService = {
    executeCommentReply: vi.fn(),
    executeDmReply: vi.fn(),
  }

  let adapter: DouyinCreatorReplyAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new DouyinCreatorReplyAdapter(douyinCreatorAutomationService as any)
  })

  it('executes public comment replies through Douyin Creator CLI', async () => {
    douyinCreatorAutomationService.executeCommentReply.mockResolvedValue({
      success: false,
      needHumanAssist: true,
      failureReason: 'dry_run_completed',
      platformReplyId: 'douyin-comment-dry-run:1',
    })

    const result = await adapter.execute({
      taskId: 'task-1',
      targetType: 'public_comment',
      targetIdentity: {
        postTitle: '作品标题',
        postPublishText: '发布于2026年04月30日 20:00',
        commentUserName: '用户A',
        commentText: '想了解',
      },
      postId: 'creator-work:1',
      postUrl: '',
      commentId: 'creator-comment:1',
      replyContent: '可以看主页同款入口哦',
      dryRun: true,
    })

    expect(douyinCreatorAutomationService.executeCommentReply).toHaveBeenCalledWith({
      postTitle: '作品标题',
      postPublishText: '发布于2026年04月30日 20:00',
      commentUserName: '用户A',
      commentText: '想了解',
      replyContent: '可以看主页同款入口哦',
      dryRun: true,
    })
    expect(result).toEqual(expect.objectContaining({
      success: false,
      needHumanAssist: true,
      failureReason: 'dry_run_completed',
      platformReplyId: 'douyin-comment-dry-run:1',
    }))
  })

  it('executes private message replies through Douyin Creator CLI', async () => {
    douyinCreatorAutomationService.executeDmReply.mockResolvedValue({
      success: true,
      platformReplyId: 'douyin-dm-sent:1',
    })

    const result = await adapter.execute({
      taskId: 'task-1',
      targetType: 'private_message',
      targetIdentity: {
        conversationUsername: '睡不醒镁人',
        lastMessage: '滴滴滴',
        lastMessageTime: '刚刚',
      },
      postId: 'private_message',
      postUrl: '',
      commentId: 'dm:abc',
      replyContent: '你好，可以继续说下你的需求',
      dryRun: false,
    })

    expect(douyinCreatorAutomationService.executeDmReply).toHaveBeenCalledWith({
      conversationUserName: '睡不醒镁人',
      lastMessage: '滴滴滴',
      lastMessageTime: '刚刚',
      replyContent: '你好，可以继续说下你的需求',
      dryRun: false,
    })
    expect(result).toEqual(expect.objectContaining({
      success: true,
      platformReplyId: 'douyin-dm-sent:1',
    }))
  })

  it('requires target identity fields before executing', async () => {
    const result = await adapter.execute({
      taskId: 'task-1',
      targetType: 'private_message',
      targetIdentity: {},
      postId: 'private_message',
      postUrl: '',
      commentId: 'dm:abc',
      replyContent: '你好',
      dryRun: true,
    })

    expect(result).toEqual(expect.objectContaining({
      success: false,
      needHumanAssist: true,
      failureReason: 'missing_dm_target_identity',
    }))
    expect(douyinCreatorAutomationService.executeDmReply).not.toHaveBeenCalled()
  })
})
