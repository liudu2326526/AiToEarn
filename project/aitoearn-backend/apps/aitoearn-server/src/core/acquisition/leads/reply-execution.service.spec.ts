import { AccountType, AppException, ResponseCode } from '@yikart/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReplyExecutionService } from './reply-execution.service'

describe('ReplyExecutionService', () => {
  const leadRepository = {
    getByIdAndUser: vi.fn(),
    updateById: vi.fn(),
  }
  const replyCommentRecordRepository = {
    addLeadReplyResult: vi.fn(),
  }
  const leadActivityLogRepository = {
    append: vi.fn(),
  }
  let service: ReplyExecutionService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ReplyExecutionService(
      leadRepository as any,
      replyCommentRecordRepository as any,
      leadActivityLogRepository as any,
    )
  })

  it('records manual reply result with required account type and updates lead', async () => {
    leadRepository.getByIdAndUser.mockResolvedValue({
      id: 'lead-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
      commentId: 'comment-1',
      sourceContent: '多少钱',
    })
    replyCommentRecordRepository.addLeadReplyResult.mockResolvedValue({ id: 'record-1' })
    leadRepository.updateById.mockResolvedValue({ id: 'lead-1', lastReplyRecordId: 'record-1' })

    await service.recordResult('user-1', 'lead-1', {
      replyContent: '已回复',
      status: 'success',
      executionMode: 'manual',
    } as any, 'operator-1')

    expect(replyCommentRecordRepository.addLeadReplyResult).toHaveBeenCalledWith(expect.objectContaining({
      type: AccountType.Xhs,
      executionMode: 'manual',
      status: 'success',
    }))
    expect(leadRepository.updateById).toHaveBeenCalledWith('lead-1', expect.objectContaining({
      lastReplyRecordId: 'record-1',
      stage: 'replied',
      status: 'in_progress',
    }))
  })

  it('rejects reply result recording for unsupported lead platforms', async () => {
    leadRepository.getByIdAndUser.mockResolvedValue({
      id: 'lead-1',
      platform: 'unknown',
      accountId: 'account-1',
      postId: 'post-1',
      commentId: 'comment-1',
      sourceContent: '多少钱',
    })

    await expect(service.recordResult('user-1', 'lead-1', {
      replyContent: '已回复',
      status: 'success',
      executionMode: 'manual',
    } as any, 'operator-1')).rejects.toMatchObject(new AppException(ResponseCode.PlatformNotSupported))

    expect(replyCommentRecordRepository.addLeadReplyResult).not.toHaveBeenCalled()
    expect(leadRepository.updateById).not.toHaveBeenCalled()
  })
})
