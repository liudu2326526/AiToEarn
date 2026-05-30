import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResponseCode } from '@yikart/common'
import { WorkDataService } from './work-data.service'

describe('WorkDataService', () => {
  let service: WorkDataService
  const monitoredPostRepository = {
    upsertByIdentity: vi.fn(),
    listWithPagination: vi.fn(),
    updateById: vi.fn(),
    findOne: vi.fn(),
    getByIdAndUser: vi.fn(),
    getByIdentity: vi.fn(),
    findLatestAuthorUserIdByAccount: vi.fn(),
    deleteByIdAndUser: vi.fn(),
  }
  const monitoredPostFetchLogRepository = {
    countByAccountSince: vi.fn(),
    create: vi.fn(),
    deleteByMonitoredPostId: vi.fn(),
  }
  const postSnapshotRepository = {
    listByPost: vi.fn(),
    findLatest: vi.fn(),
    deleteByPost: vi.fn(),
  }
  const commentSnapshotRepository = {
    listWithPagination: vi.fn(),
    deleteByPost: vi.fn(),
  }
  const accountOpsConfigRepository = {
    getByAccountId: vi.fn(),
  }
  const accountRepository = {
    getAccountById: vi.fn(),
  }
  const acquisitionService = {
    fetchNow: vi.fn(),
    refreshTokens: vi.fn(),
  }

  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    // @ts-ignore
    service = new WorkDataService(
      monitoredPostRepository as any,
      monitoredPostFetchLogRepository as any,
      postSnapshotRepository as any,
      commentSnapshotRepository as any,
      accountOpsConfigRepository as any,
      accountRepository as any,
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
    accountRepository.getAccountById.mockResolvedValue({ uid: 'author-1' })
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
      authorUserId: 'author-1',
      source: 'published_backfill',
    }))
  })

  it('stores xhs token metadata from a published backfill url and ignores virtual multipost uid', async () => {
    const tokenUpdatedAt = new Date('2026-05-30T03:30:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(tokenUpdatedAt)
    accountRepository.getAccountById.mockResolvedValue({ uid: 'multipost-rednote' })
    monitoredPostRepository.findLatestAuthorUserIdByAccount.mockResolvedValue('')
    monitoredPostRepository.upsertByIdentity.mockResolvedValue({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'xhs_multipost-rednote_web',
      postId: 'post-1',
      source: 'published_backfill',
    })

    await service.upsertFromPublishedBackfill({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'xhs_multipost-rednote_web',
      postUrl: 'https://www.xiaohongshu.com/explore/post-1?xsec_token=token-1&xsec_source=pc_user',
    })

    expect(monitoredPostRepository.upsertByIdentity).toHaveBeenCalledWith(expect.objectContaining({
      authorUserId: '',
      xsecToken: 'token-1',
      xsecSource: 'pc_user',
      xsecTokenUpdatedAt: tokenUpdatedAt,
    }))
    vi.useRealTimers()
  })

  it('reuses latest known xhs author id for multipost published backfills', async () => {
    accountRepository.getAccountById.mockResolvedValue({ uid: 'multipost-rednote' })
    monitoredPostRepository.findLatestAuthorUserIdByAccount.mockResolvedValue('author-1')
    monitoredPostRepository.upsertByIdentity.mockResolvedValue({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'xhs_multipost-rednote_web',
      postId: 'post-2',
      source: 'published_backfill',
    })

    await service.upsertFromPublishedBackfill({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'xhs_multipost-rednote_web',
      postUrl: 'https://www.xiaohongshu.com/explore/post-2',
    })

    expect(monitoredPostRepository.findLatestAuthorUserIdByAccount).toHaveBeenCalledWith(
      'user-1',
      'xhs',
      'xhs_multipost-rednote_web',
    )
    expect(monitoredPostRepository.upsertByIdentity).toHaveBeenCalledWith(expect.objectContaining({
      authorUserId: 'author-1',
    }))
  })

  it('uses cached xhs token for worker fetch even when author user id is missing', async () => {
    const tokenUpdatedAt = new Date()
    monitoredPostRepository.getByIdentity.mockResolvedValue({
      id: 'monitored-1',
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'xhs_multipost-rednote_web',
      postId: 'post-1',
      postUrl: 'https://www.xiaohongshu.com/explore/post-1',
      authorUserId: '',
      xsecToken: 'token-1',
      xsecSource: 'pc_user',
      xsecTokenUpdatedAt: tokenUpdatedAt,
    })
    accountOpsConfigRepository.getByAccountId.mockResolvedValue(null)
    acquisitionService.fetchNow.mockResolvedValue({
      capabilityStatus: 'ready',
      postSaved: false,
      fetchBatch: 'batch-1',
    })
    monitoredPostRepository.updateById.mockResolvedValue({
      fetchStatus: 'ready',
    })

    await service.processWorkerFetch('user-1', {
      accountId: 'xhs_multipost-rednote_web',
      platform: 'xhs',
      postUrl: 'https://www.xiaohongshu.com/explore/post-1',
    })

    expect(acquisitionService.refreshTokens).not.toHaveBeenCalled()
    expect(acquisitionService.fetchNow).toHaveBeenCalledWith('user-1', expect.objectContaining({
      postUrl: 'https://www.xiaohongshu.com/explore/post-1?xsec_token=token-1&xsec_source=pc_user',
    }))
  })

  it('keeps xhs worker fetch pending when token is unavailable', async () => {
    monitoredPostRepository.getByIdentity.mockResolvedValue({
      id: 'monitored-1',
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'xhs_multipost-rednote_web',
      postId: 'post-1',
      postUrl: 'https://www.xiaohongshu.com/explore/post-1',
      authorUserId: '',
      xsecToken: '',
      xsecSource: '',
      xsecTokenUpdatedAt: null,
    })
    accountOpsConfigRepository.getByAccountId.mockResolvedValue(null)
    monitoredPostRepository.updateById.mockResolvedValue({
      fetchStatus: 'pending_confirmation',
      capabilityReason: 'XHS xsec_token is not available yet',
    })

    const result = await service.processWorkerFetch('user-1', {
      accountId: 'xhs_multipost-rednote_web',
      platform: 'xhs',
      postUrl: 'https://www.xiaohongshu.com/explore/post-1',
    })

    expect(result.fetchStatus).toBe('pending_confirmation')
    expect(acquisitionService.fetchNow).not.toHaveBeenCalled()
    expect(monitoredPostFetchLogRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      fetchStatus: 'pending_confirmation',
      reason: 'XHS xsec_token is not available yet',
    }))
  })

  it('deletes a monitored post and its related work data for the current user', async () => {
    monitoredPostRepository.getByIdAndUser.mockResolvedValue({
      id: 'monitored-1',
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: 'post-1',
    })
    postSnapshotRepository.deleteByPost.mockResolvedValue(undefined)
    commentSnapshotRepository.deleteByPost.mockResolvedValue(undefined)
    monitoredPostFetchLogRepository.deleteByMonitoredPostId.mockResolvedValue(undefined)
    monitoredPostRepository.deleteByIdAndUser.mockResolvedValue({ id: 'monitored-1' })

    const result = await service.deleteMonitoredPost('user-1', 'monitored-1')

    expect(result).toEqual({ success: true })
    expect(postSnapshotRepository.deleteByPost).toHaveBeenCalledWith('account-1', 'xhs', 'post-1')
    expect(commentSnapshotRepository.deleteByPost).toHaveBeenCalledWith('account-1', 'xhs', 'post-1')
    expect(monitoredPostFetchLogRepository.deleteByMonitoredPostId).toHaveBeenCalledWith('user-1', 'monitored-1')
    expect(monitoredPostRepository.deleteByIdAndUser).toHaveBeenCalledWith('monitored-1', 'user-1')
  })

  it('rejects deleting a missing or unowned monitored post', async () => {
    monitoredPostRepository.getByIdAndUser.mockResolvedValue(null)

    await expect(service.deleteMonitoredPost('user-1', 'missing-id'))
      .rejects.toMatchObject({ code: ResponseCode.MonitoredPostNotFound })
    expect(monitoredPostRepository.deleteByIdAndUser).not.toHaveBeenCalled()
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
