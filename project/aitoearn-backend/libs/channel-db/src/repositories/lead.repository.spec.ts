import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LeadRepository } from './lead.repository'

function createModel() {
  return {
    findOneAndUpdate: vi.fn(),
    countDocuments: vi.fn(),
  }
}

describe('LeadRepository', () => {
  const model = createModel()
  // @ts-ignore
  const repository = new LeadRepository(model as any)

  beforeEach(() => vi.clearAllMocks())

  it('reads includeResultMetadata upsert results without chaining lean', async () => {
    const exec = vi.fn().mockResolvedValue({
      value: {
        _id: 'lead-1',
        userId: 'user-1',
        platform: 'xhs',
        accountId: 'account-1',
        postId: 'post-1',
        commentId: 'comment-1',
        parentCommentId: '',
        toObject: () => ({
          _id: 'lead-1',
          userId: 'user-1',
          platform: 'xhs',
          accountId: 'account-1',
          postId: 'post-1',
          commentId: 'comment-1',
          parentCommentId: '',
        }),
      },
      lastErrorObject: {
        upserted: 'lead-1',
      },
    })
    model.findOneAndUpdate.mockReturnValue({ exec })

    const result = await repository.upsertFromComment({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
      commentId: 'comment-1',
      parentCommentId: '',
      userName: 'buyer',
      userAvatar: '',
      sourceContent: '多少钱',
    })

    expect(result.created).toBe(true)
    expect(result.lead?.id).toBe('lead-1')
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', commentId: 'comment-1' }),
      expect.objectContaining({
        $setOnInsert: expect.not.objectContaining({
          userName: expect.anything(),
          userAvatar: expect.anything(),
          sourceContent: expect.anything(),
        }),
        $set: expect.objectContaining({
          userName: 'buyer',
          userAvatar: '',
          sourceContent: '多少钱',
        }),
      }),
      expect.objectContaining({
        new: true,
        upsert: true,
        includeResultMetadata: true,
      }),
    )
  })
})
