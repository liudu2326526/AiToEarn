import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkDataService } from './work-data.service'

describe('WorkDataService', () => {
  let service: WorkDataService
  const monitoredPostRepository = {
    upsertByIdentity: vi.fn(),
    listWithPagination: vi.fn(),
    updateById: vi.fn(),
    findOne: vi.fn(),
    getByIdAndUser: vi.fn(),
  }
  const monitoredPostFetchLogRepository = {
    countByAccountSince: vi.fn(),
    create: vi.fn(),
  }
  const postSnapshotRepository = {
    listByPost: vi.fn(),
    findLatest: vi.fn(),
  }
  const commentSnapshotRepository = {
    listWithPagination: vi.fn(),
  }
  const accountOpsConfigRepository = {
    getByAccountId: vi.fn(),
  }
  const acquisitionService = {
    fetchNow: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // @ts-ignore
    service = new WorkDataService(
      monitoredPostRepository as any,
      monitoredPostFetchLogRepository as any,
      postSnapshotRepository as any,
      commentSnapshotRepository as any,
      accountOpsConfigRepository as any,
      acquisitionService as any,
    )
  })

  it('creates a manual monitored post and extracts xhs postId from url', async () => {
    monitoredPostRepository.upsertByIdentity.mockResolvedValue({
      userId: 'user-1',
      postId: 'abc123',
      source: 'manual',
    })

    const result = await service.createManual('user-1', {
      platform: 'xhs',
      accountId: 'account-1',
      postUrl: 'https://www.xiaohongshu.com/explore/abc123?xsec_token=token',
    })

    expect(result.userId).toBe('user-1')
    expect(result.postId).toBe('abc123')
    expect(result.source).toBe('manual')
    expect(monitoredPostRepository.upsertByIdentity).toHaveBeenCalledWith(expect.objectContaining({
      postId: 'abc123',
    }))
  })

  it('lists comments with pagination and data source only for the current user', async () => {
    const mockComments = [[{ content: 'nice', dataSource: 'xhs_plugin_api' }], 1]
    commentSnapshotRepository.listWithPagination.mockResolvedValue(mockComments)
    // @ts-ignore
    monitoredPostRepository.getByIdAndUser.mockResolvedValue({
      id: 'monitored-1',
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
    })

    const [list, total] = await service.listComments('user-1', 'monitored-1', {
      page: 1,
      pageSize: 20,
      sortBy: 'like',
    })

    expect(list[0]).toMatchObject({
      content: expect.any(String),
      dataSource: expect.any(String),
    })
    expect(total).toBe(1)
    expect(commentSnapshotRepository.listWithPagination).toHaveBeenCalledWith(expect.objectContaining({
      sortBy: 'like',
    }))
  })

  it('creates monitored post from published backfill job', async () => {
    monitoredPostRepository.upsertByIdentity.mockResolvedValue({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
      source: 'published_backfill',
    })

    const result = await service.upsertFromPublishedBackfill({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postUrl: 'https://www.xiaohongshu.com/explore/post-1',
      postId: 'post-1',
    })

    expect(result.source).toBe('published_backfill')
    expect(monitoredPostRepository.upsertByIdentity).toHaveBeenCalledWith(expect.objectContaining({
      source: 'published_backfill',
    }))
  })

  describe('fetchNow strategy guards', () => {
    const mockPost = {
      id: 'monitored-1',
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
      postUrl: 'https://xhs.com/post-1',
    }

    beforeEach(() => {
      // @ts-ignore
      service.getDetail = vi.fn().mockResolvedValue(mockPost)
    })

    it('does not fetch when account config disables comment fetch', async () => {
      // @ts-ignore
      accountOpsConfigRepository.getByAccountId.mockResolvedValue({
        accountId: 'account-1',
        enableCommentFetch: false,
      })
      // @ts-ignore
      monitoredPostRepository.updateById.mockResolvedValue({
        fetchStatus: 'not_configured',
      })

      const result = await service.fetchNow('user-1', 'monitored-1')

      expect(result.fetchStatus).toBe('not_configured')
      expect(acquisitionService.fetchNow).not.toHaveBeenCalled()
    })

    it('does not fetch when the account daily comment fetch limit is reached', async () => {
      // @ts-ignore
      accountOpsConfigRepository.getByAccountId.mockResolvedValue({
        accountId: 'account-1',
        enableCommentFetch: true,
        dailyCommentFetchLimit: 2,
      })
      // @ts-ignore
      monitoredPostFetchLogRepository.countByAccountSince.mockResolvedValue(2)
      // @ts-ignore
      monitoredPostRepository.updateById.mockResolvedValue({
        fetchStatus: 'not_configured',
        capabilityReason: 'daily comment fetch limit reached',
      })

      const result = await service.fetchNow('user-1', 'monitored-1')

      expect(result.fetchStatus).toBe('not_configured')
      expect(result.capabilityReason).toBe('daily comment fetch limit reached')
      expect(acquisitionService.fetchNow).not.toHaveBeenCalled()
    })
  })
})
