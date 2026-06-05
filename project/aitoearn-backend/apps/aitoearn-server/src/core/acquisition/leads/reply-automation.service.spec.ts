import { ResponseCode } from '@yikart/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReplyAutomationService } from './reply-automation.service'

describe('replyAutomationService', () => {
  const leadRepository = {
    getByIdAndUser: vi.fn(),
    listByUser: vi.fn(),
  }
  const leadReplyTaskRepository = {
    create: vi.fn(),
    getByIdAndUser: vi.fn(),
    listByUser: vi.fn(),
    markQueued: vi.fn(),
  }
  const leadActivityLogRepository = {
    append: vi.fn(),
  }
  const replySuggestionService = {
    generate: vi.fn(),
  }
  const queueService = {
    addAcquisitionLeadReplyTaskJob: vi.fn(),
  }

  let service: ReplyAutomationService

  const safeXhsLead = {
    id: 'lead-1',
    userId: 'user-1',
    platform: 'xhs',
    accountId: 'account-1',
    postId: 'post-1',
    postUrl: 'https://www.xiaohongshu.com/explore/post-1?xsec_token=token',
    commentId: 'comment-1',
    parentCommentId: '',
    replyStyle: 'promotion',
    suggestedReply: {
      content: '可以看主页同款入口哦',
      status: 'generated',
      riskHits: [],
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ReplyAutomationService(
      leadRepository as any,
      leadReplyTaskRepository as any,
      leadActivityLogRepository as any,
      replySuggestionService as any,
      queueService as any,
    )
  })

  const safeDouyinCommentLead = {
    ...safeXhsLead,
    id: 'lead-douyin-comment',
    platform: 'douyin',
    postId: 'creator-work:1',
    postUrl: '',
    commentId: 'creator-comment:1',
    postTitle: '作品标题',
    userName: '用户A',
    sourceContent: '想了解',
    sourceType: 'public_comment',
  }

  const safeDouyinDmLead = {
    ...safeXhsLead,
    id: 'lead-douyin-dm',
    platform: 'douyin',
    postId: 'private_message',
    postUrl: '',
    commentId: 'dm:abc',
    postTitle: '刚刚',
    userName: '睡不醒镁人',
    sourceContent: '滴滴滴',
    sourceType: 'private_message',
  }

  it('creates a dry-run douyin public-comment reply task through generic auto reply', async () => {
    leadRepository.getByIdAndUser.mockResolvedValue(safeDouyinCommentLead)
    leadReplyTaskRepository.create.mockResolvedValue({ id: 'task-douyin-1', status: 'queued' })

    const result = await service.createSingleTask('user-1', 'lead-douyin-comment', {} as any, 'operator-1')

    expect(result.task).toEqual(expect.objectContaining({ id: 'task-douyin-1', status: 'queued' }))
    expect(leadReplyTaskRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      leadId: 'lead-douyin-comment',
      platform: 'douyin',
      executorKind: 'douyin_creator_cli',
      targetType: 'public_comment',
      dryRun: true,
      targetIdentity: expect.objectContaining({
        postTitle: '作品标题',
        commentUserName: '用户A',
        commentText: '想了解',
      }),
      rateKey: 'user-1:douyin:account-1:public_comment',
    }))
    expect(queueService.addAcquisitionLeadReplyTaskJob).toHaveBeenCalledWith({ taskId: 'task-douyin-1' })
  })

  it('does not enqueue blocked suggestions', async () => {
    leadRepository.getByIdAndUser.mockResolvedValue({
      ...safeXhsLead,
      suggestedReply: {
        content: '加微信详聊',
        status: 'blocked',
        riskHits: ['微信'],
      },
    })
    leadReplyTaskRepository.create.mockResolvedValue({ id: 'task-1', status: 'blocked' })

    const result = await service.createSingleTask('user-1', 'lead-1', {} as any, 'operator-1')

    expect(result.task).toEqual(expect.objectContaining({ status: 'blocked' }))
    expect(leadReplyTaskRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'blocked',
      lastError: expect.stringContaining('blocked'),
    }))
    expect(queueService.addAcquisitionLeadReplyTaskJob).not.toHaveBeenCalled()
  })

  it('creates and queues a safe xhs reply task', async () => {
    leadRepository.getByIdAndUser.mockResolvedValue(safeXhsLead)
    leadReplyTaskRepository.create.mockResolvedValue({ id: 'task-1', status: 'queued' })

    const result = await service.createSingleTask('user-1', 'lead-1', {} as any, 'operator-1')

    expect(result.task).toEqual(expect.objectContaining({ id: 'task-1', status: 'queued' }))
    expect(leadReplyTaskRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      leadId: 'lead-1',
      replyContent: '可以看主页同款入口哦',
      status: 'queued',
      executorKind: 'browser_plugin',
      rateKey: 'user-1:xhs:account-1:public_comment',
    }))
    expect(queueService.addAcquisitionLeadReplyTaskJob).toHaveBeenCalledWith({ taskId: 'task-1' })
  })

  it('supports dryRun for batch auto reply', async () => {
    leadRepository.listByUser.mockResolvedValue([[safeXhsLead], 1])

    const result = await service.createBatchTasks('user-1', {
      limit: 20,
      dryRun: true,
      onlyPending: true,
    } as any, 'operator-1')

    expect(result).toEqual(expect.objectContaining({
      matched: 1,
      queued: 1,
      taskIds: [],
    }))
    expect(leadReplyTaskRepository.create).not.toHaveBeenCalled()
    expect(queueService.addAcquisitionLeadReplyTaskJob).not.toHaveBeenCalled()
  })

  it('creates dry-run tasks for explicit douyin lead ids', async () => {
    leadRepository.getByIdAndUser.mockResolvedValue(safeDouyinDmLead)
    leadReplyTaskRepository.create.mockResolvedValue({ id: 'task-dm-1', status: 'queued' })

    const result = await service.createTasksForLeadIds('user-1', ['lead-douyin-dm'], {
      dryRun: true,
      targetType: 'private_message',
      limit: 20,
    }, 'operator-1')

    expect(result).toEqual(expect.objectContaining({
      dryRun: true,
      queued: 1,
      taskIds: ['task-dm-1'],
    }))
    expect(leadReplyTaskRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      leadId: 'lead-douyin-dm',
      targetType: 'private_message',
      dryRun: true,
      targetIdentity: expect.objectContaining({
        conversationUsername: '睡不醒镁人',
        lastMessage: '滴滴滴',
        lastMessageTime: '刚刚',
      }),
    }))
  })

  it('creates confirmed-send tasks only through explicit douyin lead id confirmation', async () => {
    leadRepository.getByIdAndUser.mockResolvedValue(safeDouyinCommentLead)
    leadReplyTaskRepository.create.mockResolvedValue({ id: 'task-comment-send', status: 'queued' })

    const result = await service.createTasksForLeadIds('user-1', ['lead-douyin-comment'], {
      dryRun: false,
      targetType: 'public_comment',
      limit: 20,
    }, 'operator-1')

    expect(result).toEqual(expect.objectContaining({
      dryRun: false,
      queued: 1,
      taskIds: ['task-comment-send'],
    }))
    expect(leadReplyTaskRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      leadId: 'lead-douyin-comment',
      targetType: 'public_comment',
      dryRun: false,
    }))
  })

  it('keeps douyin private messages human-required in generic auto reply flows', async () => {
    leadRepository.getByIdAndUser.mockResolvedValue(safeDouyinDmLead)
    leadReplyTaskRepository.create.mockResolvedValue({ id: 'task-dm-review', status: 'human_required' })

    const single = await service.createSingleTask('user-1', 'lead-douyin-dm', {} as any, 'operator-1')

    expect(single.task).toEqual(expect.objectContaining({ status: 'human_required' }))
    expect(leadReplyTaskRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      leadId: 'lead-douyin-dm',
      targetType: 'private_message',
      status: 'human_required',
      lastError: 'private_message_requires_explicit_confirmation',
    }))
    expect(queueService.addAcquisitionLeadReplyTaskJob).not.toHaveBeenCalled()
  })

  it('keeps douyin private messages human-required in batch auto reply', async () => {
    leadRepository.listByUser.mockResolvedValue([[safeDouyinDmLead], 1])
    leadReplyTaskRepository.create.mockResolvedValue({ id: 'task-dm-review', status: 'human_required' })

    const result = await service.createBatchTasks('user-1', {
      limit: 20,
      dryRun: false,
      onlyPending: true,
    } as any, 'operator-1')

    expect(result).toEqual(expect.objectContaining({
      matched: 1,
      queued: 0,
      skipped: 1,
      taskIds: ['task-dm-review'],
    }))
    expect(queueService.addAcquisitionLeadReplyTaskJob).not.toHaveBeenCalled()
  })

  it('does not retry unsupported or terminal tasks', async () => {
    for (const task of [
      { id: 'task-1', platform: 'kwai', status: 'failed' },
      { id: 'task-2', platform: 'xhs', status: 'blocked' },
      { id: 'task-3', platform: 'xhs', status: 'cancelled' },
      { id: 'task-4', platform: 'xhs', status: 'success' },
      { id: 'task-5', platform: 'xhs', status: 'running' },
    ]) {
      leadReplyTaskRepository.getByIdAndUser.mockResolvedValueOnce(task)
      await expect(service.retryTask('user-1', task.id, 'operator-1'))
        .rejects
        .toMatchObject({ code: ResponseCode.ValidationFailed })
    }

    expect(queueService.addAcquisitionLeadReplyTaskJob).not.toHaveBeenCalled()
  })
})
