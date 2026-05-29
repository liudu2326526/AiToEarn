import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MonitoredPostRepository } from './monitored-post.repository'

function createModel() {
  return {
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  }
}

describe('MonitoredPostRepository', () => {
  const model = createModel()
  // @ts-ignore
  const repository = new MonitoredPostRepository(model as any)

  beforeEach(() => vi.clearAllMocks())

  it('upserts the same user/platform/account/postId into one monitored post', async () => {
    const mockData = {
      id: 'monitored-1',
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
      postUrl: 'https://www.xiaohongshu.com/explore/post-1?xsec_token=abc',
      source: 'manual',
      monitorStatus: 'active',
    }
    model.findOneAndUpdate.mockResolvedValue(mockData)

    const first = await repository.upsertByIdentity({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
      postUrl: 'https://www.xiaohongshu.com/explore/post-1',
      source: 'manual',
      monitorStatus: 'active',
    })

    const second = await repository.upsertByIdentity({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
      postUrl: 'https://www.xiaohongshu.com/explore/post-1?xsec_token=abc',
      source: 'manual',
      monitorStatus: 'active',
    })

    expect(String(second.id)).toBe(String(first.id))
    expect(second.postUrl).toContain('xsec_token=abc')
  })

  it('lists monitored posts with virtual id fields enabled', async () => {
    const lean = vi.fn().mockReturnValue({
      exec: vi.fn().mockResolvedValue([{ _id: 'monitored-1', id: 'monitored-1' }]),
    })
    const limit = vi.fn().mockReturnValue({ lean })
    const skip = vi.fn().mockReturnValue({ limit })
    const sort = vi.fn().mockReturnValue({ skip })
    model.find.mockReturnValue({ sort })
    model.countDocuments.mockReturnValue({
      exec: vi.fn().mockResolvedValue(1),
    })

    const [list, total] = await repository.listWithPagination('user-1', { platform: 'xhs' }, 1, 20)

    expect(lean).toHaveBeenCalledWith({ virtuals: true })
    expect(list[0].id).toBe('monitored-1')
    expect(total).toBe(1)
    expect(model.find).toHaveBeenCalledWith({ platform: 'xhs', userId: 'user-1' })
  })
})
