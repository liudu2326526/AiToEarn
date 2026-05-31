import { AppException, ResponseCode } from '@yikart/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReplyAutomationService } from './reply-automation.service'

describe('ReplyAutomationService', () => {
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

  it('blocks non-xhs leads in MVP', async () => {
    leadRepository.getByIdAndUser.mockResolvedValue({
      ...safeXhsLead,
      platform: 'douyin',
    })

    await expect(service.createSingleTask('user-1', 'lead-1', {} as any, 'operator-1'))
      .rejects.toMatchObject(new AppException(ResponseCode.PlatformNotSupported))
    expect(leadReplyTaskRepository.create).not.toHaveBeenCalled()
    expect(queueService.addAcquisitionLeadReplyTaskJob).not.toHaveBeenCalled()
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
      rateKey: 'user-1:xhs:account-1',
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

  it('does not retry unsupported or terminal tasks', async () => {
    for (const task of [
      { id: 'task-1', platform: 'douyin', status: 'failed' },
      { id: 'task-2', platform: 'xhs', status: 'blocked' },
      { id: 'task-3', platform: 'xhs', status: 'cancelled' },
      { id: 'task-4', platform: 'xhs', status: 'success' },
      { id: 'task-5', platform: 'xhs', status: 'running' },
    ]) {
      leadReplyTaskRepository.getByIdAndUser.mockResolvedValueOnce(task)
      await expect(service.retryTask('user-1', task.id, 'operator-1'))
        .rejects.toMatchObject({ code: ResponseCode.ValidationFailed })
    }

    expect(queueService.addAcquisitionLeadReplyTaskJob).not.toHaveBeenCalled()
  })
})
