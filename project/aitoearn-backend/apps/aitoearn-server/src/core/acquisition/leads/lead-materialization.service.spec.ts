import { AppException, ResponseCode } from '@yikart/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LeadMaterializationService } from './lead-materialization.service'

describe('LeadMaterializationService', () => {
  const monitoredPostRepository = {
    getByIdAndUser: vi.fn(),
    listWithPagination: vi.fn(),
  }
  const commentSnapshotRepository = {
    listForLeadMaterializationByPost: vi.fn(),
  }
  const leadRepository = {
    upsertFromComment: vi.fn(),
  }
  const leadActivityLogRepository = {
    append: vi.fn(),
  }

  let service: LeadMaterializationService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new LeadMaterializationService(
      monitoredPostRepository as any,
      commentSnapshotRepository as any,
      leadRepository as any,
      leadActivityLogRepository as any,
    )
  })

  it('rejects materialization from a monitored post not owned by current user', async () => {
    monitoredPostRepository.getByIdAndUser.mockResolvedValue(null)

    await expect(service.materialize('user-1', { monitoredPostId: 'post-1' } as any, 'operator-1'))
      .rejects.toMatchObject(new AppException(ResponseCode.MonitoredPostNotFound))
    expect(commentSnapshotRepository.listForLeadMaterializationByPost).not.toHaveBeenCalled()
  })

  it('dedupes materialization logs when a comment lead already exists', async () => {
    monitoredPostRepository.getByIdAndUser.mockResolvedValue({
      id: 'monitored-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
    })
    commentSnapshotRepository.listForLeadMaterializationByPost.mockResolvedValue([
      {
        platform: 'xhs',
        accountId: 'account-1',
        postId: 'post-1',
        commentId: 'comment-1',
        parentCommentId: '',
        userName: 'buyer',
        userAvatar: '',
        content: '还有货吗',
      },
    ])
    leadRepository.upsertFromComment.mockResolvedValue({
      lead: { id: 'lead-1' },
      created: false,
    })

    const result = await service.materialize('user-1', { monitoredPostId: 'monitored-1' } as any, 'operator-1')

    expect(result).toEqual({ totalScanned: 1, materialized: 1 })
    expect(leadActivityLogRepository.append).not.toHaveBeenCalled()
  })

  it('honors totalCommentLimit globally across monitored posts', async () => {
    monitoredPostRepository.listWithPagination.mockResolvedValue([
      [
        { platform: 'xhs', accountId: 'account-1', postId: 'post-1' },
        { platform: 'xhs', accountId: 'account-1', postId: 'post-2' },
      ],
      2,
    ])
    commentSnapshotRepository.listForLeadMaterializationByPost
      .mockResolvedValueOnce([
        { platform: 'xhs', accountId: 'account-1', postId: 'post-1', commentId: 'c1', parentCommentId: '', userName: '', userAvatar: '', content: '1' },
        { platform: 'xhs', accountId: 'account-1', postId: 'post-1', commentId: 'c2', parentCommentId: '', userName: '', userAvatar: '', content: '2' },
      ])
      .mockResolvedValueOnce([
        { platform: 'xhs', accountId: 'account-1', postId: 'post-2', commentId: 'c3', parentCommentId: '', userName: '', userAvatar: '', content: '3' },
      ])
    leadRepository.upsertFromComment.mockResolvedValue({ lead: { id: 'lead' }, created: true })

    await service.materialize('user-1', {
      postLimit: 20,
      commentLimit: 100,
      totalCommentLimit: 3,
    } as any, 'operator-1')

    expect(commentSnapshotRepository.listForLeadMaterializationByPost).toHaveBeenNthCalledWith(1, expect.objectContaining({ limit: 3 }))
    expect(commentSnapshotRepository.listForLeadMaterializationByPost).toHaveBeenNthCalledWith(2, expect.objectContaining({ limit: 1 }))
  })
})
