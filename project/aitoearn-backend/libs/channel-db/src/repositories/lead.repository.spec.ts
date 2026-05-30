import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LeadRepository } from './lead.repository'

function createModel() {
  return {
    findOneAndUpdate: vi.fn(),
    countDocuments: vi.fn(),
    deleteOne: vi.fn(),
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
          postTitle: '',
          postUrl: '',
          postCover: '',
        }),
      }),
      expect.objectContaining({
        new: true,
        upsert: true,
        includeResultMetadata: true,
      }),
    )
  })

  it('marks a lead as replied when an author reply targets the same comment thread user', async () => {
    const exec = vi.fn().mockResolvedValue({ _id: 'lead-1', stage: 'replied' })
    const lean = vi.fn().mockReturnValue({ exec })
    model.findOneAndUpdate.mockReturnValue({ lean })

    const result = await repository.markAuthorReplied({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
      parentCommentId: 'root-1',
      repliedToUserName: 'buyer',
    })

    expect(result).toEqual({ _id: 'lead-1', stage: 'replied' })
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        platform: 'xhs',
        accountId: 'account-1',
        postId: 'post-1',
        $or: expect.arrayContaining([
          { userName: 'buyer', parentCommentId: 'root-1' },
          { userName: 'buyer', commentId: 'root-1' },
        ]),
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          stage: 'replied',
          status: 'in_progress',
        }),
      }),
      expect.objectContaining({ new: true }),
    )
  })

  it('marks a top-level lead as replied when an author reply targets its comment id', async () => {
    const exec = vi.fn().mockResolvedValue({ _id: 'lead-1', stage: 'replied' })
    const lean = vi.fn().mockReturnValue({ exec })
    model.findOneAndUpdate.mockReturnValue({ lean })

    await repository.markAuthorReplied({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
      parentCommentId: 'root-comment-1',
      repliedToUserName: 'buyer',
    })

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        platform: 'xhs',
        accountId: 'account-1',
        postId: 'post-1',
        $or: expect.arrayContaining([
          { userName: 'buyer', parentCommentId: 'root-comment-1' },
          { userName: 'buyer', commentId: 'root-comment-1' },
        ]),
      }),
      expect.anything(),
      expect.objectContaining({ new: true }),
    )
  })

  it('deletes a lead by public comment identity', async () => {
    const exec = vi.fn().mockResolvedValue({ deletedCount: 1 })
    model.deleteOne.mockReturnValue({ exec })

    await repository.deleteByCommentIdentity({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
      commentId: 'comment-2',
      parentCommentId: 'root-1',
    })

    expect(model.deleteOne).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
      commentId: 'comment-2',
      parentCommentId: 'root-1',
    }), undefined)
  })
})
