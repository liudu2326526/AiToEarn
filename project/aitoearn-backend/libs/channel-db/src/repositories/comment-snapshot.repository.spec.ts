import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommentSnapshotRepository } from './comment-snapshot.repository'

function createModel() {
  return {
    find: vi.fn(),
    countDocuments: vi.fn(),
    bulkWrite: vi.fn(),
  }
}

describe('CommentSnapshotRepository', () => {
  const model = createModel()
  // @ts-ignore
  const repository = new CommentSnapshotRepository(model as any)

  beforeEach(() => vi.clearAllMocks())

  it('lists comment snapshots with virtual id fields enabled', async () => {
    const lean = vi.fn().mockReturnValue({
      exec: vi.fn().mockResolvedValue([{ _id: 'comment-1', id: 'comment-1' }]),
    })
    const limit = vi.fn().mockReturnValue({ lean })
    const skip = vi.fn().mockReturnValue({ limit })
    const sort = vi.fn().mockReturnValue({ skip })
    model.find.mockReturnValue({ sort })
    model.countDocuments.mockReturnValue({
      exec: vi.fn().mockResolvedValue(1),
    })

    const [list, total] = await repository.listWithPagination({
      accountId: 'account-1',
      platform: 'xhs',
      postId: 'post-1',
      keyword: 'hello',
      page: 1,
      pageSize: 20,
    })

    expect(lean).toHaveBeenCalledWith({ virtuals: true })
    expect(list[0].id).toBe('comment-1')
    expect(total).toBe(1)
    expect(model.find).toHaveBeenCalledWith({
      accountId: 'account-1',
      platform: 'xhs',
      postId: 'post-1',
      content: { $regex: 'hello', $options: 'i' },
    })
  })

  it('supports sorting comments by like count', async () => {
    const lean = vi.fn().mockReturnValue({
      exec: vi.fn().mockResolvedValue([]),
    })
    const limit = vi.fn().mockReturnValue({ lean })
    const skip = vi.fn().mockReturnValue({ limit })
    const sort = vi.fn().mockReturnValue({ skip })
    model.find.mockReturnValue({ sort })
    model.countDocuments.mockReturnValue({
      exec: vi.fn().mockResolvedValue(0),
    })

    await repository.listWithPagination({
      accountId: 'account-1',
      platform: 'xhs',
      postId: 'post-1',
      page: 1,
      pageSize: 20,
      sortBy: 'like',
    })

    expect(Object.keys(sort.mock.calls[0][0])).toEqual(['likeCount', 'commentedAt'])
  })
})
