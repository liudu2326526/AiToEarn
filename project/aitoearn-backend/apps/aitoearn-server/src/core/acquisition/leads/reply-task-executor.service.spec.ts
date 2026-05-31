import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReplyTaskExecutorService } from './reply-task-executor.service'

describe('ReplyTaskExecutorService', () => {
  const leadReplyTaskRepository = {
    getById: vi.fn(),
    markRunning: vi.fn(),
    markTerminal: vi.fn(),
  }
  const leadActivityLogRepository = {
    append: vi.fn(),
  }
  const replyExecutionService = {
    recordResult: vi.fn(),
  }
  const platformReplyAdapterRegistry = {
    get: vi.fn(),
  }
  const replyTaskScreenshotService = {
    uploadScreenshot: vi.fn(),
  }

  let service: ReplyTaskExecutorService

  const task = {
    id: 'task-1',
    userId: 'user-1',
    leadId: 'lead-1',
    platform: 'xhs',
    postId: 'post-1',
    postUrl: 'https://www.xiaohongshu.com/explore/post-1?xsec_token=token',
    commentId: 'comment-1',
    replyContent: '可以看主页同款入口哦',
    status: 'queued',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ReplyTaskExecutorService(
      leadReplyTaskRepository as any,
      leadActivityLogRepository as any,
      replyExecutionService as any,
      platformReplyAdapterRegistry as any,
      replyTaskScreenshotService as any,
    )
  })

  it('marks task success and records reply result', async () => {
    leadReplyTaskRepository.getById.mockResolvedValue(task)
    leadReplyTaskRepository.markRunning.mockResolvedValue({ ...task, status: 'running', attemptCount: 1 })
    platformReplyAdapterRegistry.get.mockReturnValue({
      execute: vi.fn().mockResolvedValue({ success: true, platformReplyId: 'reply-1' }),
    })
    leadReplyTaskRepository.markTerminal.mockResolvedValue({ ...task, status: 'success' })

    await service.execute('task-1', 'operator-1')

    expect(leadReplyTaskRepository.markTerminal).toHaveBeenCalledWith('task-1', 'success', expect.objectContaining({
      platformReplyId: 'reply-1',
    }))
    expect(replyExecutionService.recordResult).toHaveBeenCalledWith('user-1', 'lead-1', {
      replyContent: '可以看主页同款入口哦',
      status: 'success',
      executionMode: 'platform_adapter',
      failureReason: '',
    }, 'operator-1')
  })

  it('marks task human_required when adapter reports human assist', async () => {
    leadReplyTaskRepository.getById.mockResolvedValue(task)
    leadReplyTaskRepository.markRunning.mockResolvedValue({ ...task, status: 'running' })
    platformReplyAdapterRegistry.get.mockReturnValue({
      execute: vi.fn().mockResolvedValue({
        success: false,
        needHumanAssist: true,
        failureReason: '需要验证',
      }),
    })

    await service.execute('task-1', 'operator-1')

    expect(leadReplyTaskRepository.markTerminal).toHaveBeenCalledWith('task-1', 'human_required', expect.objectContaining({
      lastError: '需要验证',
    }))
    expect(leadActivityLogRepository.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'reply_task_human_required',
    }))
  })

  it('marks task failed when adapter throws', async () => {
    leadReplyTaskRepository.getById.mockResolvedValue(task)
    leadReplyTaskRepository.markRunning.mockResolvedValue({ ...task, status: 'running' })
    platformReplyAdapterRegistry.get.mockReturnValue({
      execute: vi.fn().mockRejectedValue(new Error('bridge disconnected')),
    })

    await service.execute('task-1', 'operator-1')

    expect(leadReplyTaskRepository.markTerminal).toHaveBeenCalledWith('task-1', 'failed', expect.objectContaining({
      lastError: 'bridge disconnected',
    }))
    expect(replyExecutionService.recordResult).not.toHaveBeenCalled()
  })

  it('does not execute cancelled task', async () => {
    leadReplyTaskRepository.getById.mockResolvedValue({ ...task, status: 'cancelled' })

    await service.execute('task-1', 'operator-1')

    expect(platformReplyAdapterRegistry.get).not.toHaveBeenCalled()
    expect(leadReplyTaskRepository.markRunning).not.toHaveBeenCalled()
  })

  it('uploads screenshot evidence when adapter returns screenshotDataUrl', async () => {
    leadReplyTaskRepository.getById.mockResolvedValue(task)
    leadReplyTaskRepository.markRunning.mockResolvedValue({ ...task, status: 'running' })
    platformReplyAdapterRegistry.get.mockReturnValue({
      execute: vi.fn().mockResolvedValue({
        success: false,
        needHumanAssist: true,
        failureReason: '需要验证',
        screenshotDataUrl: 'data:image/png;base64,cG5n',
      }),
    })
    replyTaskScreenshotService.uploadScreenshot.mockResolvedValue('https://obs.example.com/task-1.png')

    await service.execute('task-1', 'operator-1')

    expect(replyTaskScreenshotService.uploadScreenshot).toHaveBeenCalledWith(
      'user-1',
      'task-1',
      'data:image/png;base64,cG5n',
    )
    expect(leadReplyTaskRepository.markTerminal).toHaveBeenCalledWith('task-1', 'human_required', expect.objectContaining({
      screenshotUrl: 'https://obs.example.com/task-1.png',
    }))
  })
})
