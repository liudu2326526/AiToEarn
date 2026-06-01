import { PublishRecordLinkStatus, PublishStatus } from '@yikart/mongodb'
import { describe, expect, it, vi } from 'vitest'
import { PublishController } from './publish.controller'

function createController() {
  const publishRecordService = {
    getPublishRecordInfo: vi.fn(),
    getOneByTraceId: vi.fn(),
    updateStatusById: vi.fn(),
    updateWorkLinkById: vi.fn(),
    completeById: vi.fn(),
  }
  const platformService = {
    getWorkLinkInfo: vi.fn(),
  }
  const queueService = {
    addAcquisitionPostBackfillJob: vi.fn(),
    addXhsTokenRefreshJob: vi.fn(),
    getXhsTokenRefreshJobs: vi.fn(),
    removeXhsTokenRefreshJob: vi.fn(),
  }
  const monitoredPostRepository = {
    upsertPublishedBackfillMonitor: vi.fn(),
    getByIdentity: vi.fn(),
  }

  const controller = new PublishController(
    {} as any,
    {} as any,
    publishRecordService as any,
    {} as any,
    {} as any,
    {} as any,
    platformService as any,
    {} as any,
    queueService as any,
    monitoredPostRepository as any,
  )

  return {
    controller,
    publishRecordService,
    platformService,
    queueService,
    monitoredPostRepository,
  }
}

describe('PublishController.updatePluginPublishResult', () => {
  it('keeps XHS bare work links pending without backfill', async () => {
    const { controller, publishRecordService, platformService, queueService, monitoredPostRepository } = createController()
    const updatedRecord = { id: 'record-1', linkStatus: PublishRecordLinkStatus.PENDING }
    publishRecordService.getPublishRecordInfo.mockResolvedValue({
      id: 'record-1',
      userId: 'user-1',
      dataId: 'trace-1',
      accountType: 'xhs',
      accountId: 'account-1',
      title: '海边的感觉',
      coverUrl: 'cover-1',
      linkMeta: { provider: 'multipost' },
    })
    publishRecordService.updateWorkLinkById.mockResolvedValue(updatedRecord)
    platformService.getWorkLinkInfo.mockRejectedValue(new Error('reviewing'))

    const result = await controller.updatePluginPublishResult({ id: 'user-1' } as any, {
      id: 'record-1',
      success: true,
      workLink: 'https://www.xiaohongshu.com/explore/6a1a6469000000000702602a',
    } as any)

    expect(result).toBe(updatedRecord)
    expect(queueService.addAcquisitionPostBackfillJob).not.toHaveBeenCalled()
    expect(platformService.getWorkLinkInfo).not.toHaveBeenCalled()
    expect(monitoredPostRepository.upsertPublishedBackfillMonitor).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: '6a1a6469000000000702602a',
      postUrl: 'https://www.xiaohongshu.com/explore/6a1a6469000000000702602a',
      title: '海边的感觉',
      cover: 'cover-1',
      source: 'published_backfill',
      monitorStatus: 'published',
      fetchStatus: 'pending_confirmation',
      publishRecordId: 'record-1',
      linkStatus: PublishRecordLinkStatus.PENDING,
    }))
    expect(publishRecordService.updateStatusById).toHaveBeenCalledWith('record-1', PublishStatus.PUBLISHING)
    expect(publishRecordService.updateWorkLinkById).toHaveBeenCalledWith('record-1', {
      dataId: '6a1a6469000000000702602a',
      linkStatus: PublishRecordLinkStatus.PENDING,
      linkError: 'XHS xsec_token is not available yet',
      linkMeta: {
        provider: 'multipost',
        pendingConfirmation: true,
        missingXsecToken: true,
        unverifiedWorkLink: 'https://www.xiaohongshu.com/explore/6a1a6469000000000702602a',
      },
    })
  })

  it('resolves MultiPost plugin results by traceId when record id is missing', async () => {
    const { controller, publishRecordService, platformService, queueService, monitoredPostRepository } = createController()
    const updatedRecord = { id: 'record-1', linkStatus: PublishRecordLinkStatus.PENDING }
    publishRecordService.getOneByTraceId.mockResolvedValue({
      id: 'record-1',
      userId: 'user-1',
      dataId: 'trace-1',
      accountType: 'xhs',
      accountId: 'account-1',
      title: '山的那边是什么',
      imgUrlList: ['image-1'],
      linkMeta: { provider: 'multipost', traceId: 'trace-1' },
    })
    publishRecordService.updateWorkLinkById.mockResolvedValue(updatedRecord)
    platformService.getWorkLinkInfo.mockRejectedValue(new Error('reviewing'))

    const result = await controller.updatePluginPublishResult({ id: 'user-1' } as any, {
      traceId: 'trace-1',
      success: true,
      workLink: 'https://www.xiaohongshu.com/explore/6a1a6469000000000702602a?xsec_token=token-1&xsec_source=pc_user',
      authorUserId: 'author-1',
      xsecToken: 'token-1',
      xsecSource: 'pc_user',
    } as any)

    expect(result).toBe(updatedRecord)
    expect(publishRecordService.getPublishRecordInfo).not.toHaveBeenCalled()
    expect(publishRecordService.getOneByTraceId).toHaveBeenCalledWith('user-1', 'trace-1')
    expect(queueService.addAcquisitionPostBackfillJob).toHaveBeenCalledWith({
      userId: 'user-1',
      accountId: 'account-1',
      platform: 'xhs',
      postUrl: 'https://www.xiaohongshu.com/explore/6a1a6469000000000702602a?xsec_token=token-1&xsec_source=pc_user',
      authorUserId: 'author-1',
      xsecToken: 'token-1',
      xsecSource: 'pc_user',
    })
    expect(platformService.getWorkLinkInfo).toHaveBeenCalledWith(
      'xhs',
      'https://www.xiaohongshu.com/explore/6a1a6469000000000702602a?xsec_token=token-1&xsec_source=pc_user',
      'trace-1',
      'account-1',
    )
  })

  it('stores pending XHS note id when the note manager only reports a bare work link', async () => {
    const { controller, publishRecordService, platformService, queueService, monitoredPostRepository } = createController()
    const updatedRecord = { id: 'record-1', linkStatus: PublishRecordLinkStatus.PENDING }
    publishRecordService.getOneByTraceId.mockResolvedValue({
      id: 'record-1',
      userId: 'user-1',
      dataId: 'trace-1',
      accountType: 'xhs',
      accountId: 'account-1',
      title: '山的那边是什么',
      imgUrlList: ['image-1'],
      linkMeta: { provider: 'multipost', traceId: 'trace-1' },
    })
    publishRecordService.updateWorkLinkById.mockResolvedValue(updatedRecord)

    const result = await controller.updatePluginPublishResult({ id: 'user-1' } as any, {
      traceId: 'trace-1',
      success: true,
      pendingConfirmation: true,
      workLink: 'https://www.xiaohongshu.com/explore/6a1cea220000000008025813',
    } as any)

    expect(result).toBe(updatedRecord)
    expect(queueService.addAcquisitionPostBackfillJob).not.toHaveBeenCalled()
    expect(platformService.getWorkLinkInfo).not.toHaveBeenCalled()
    expect(monitoredPostRepository.upsertPublishedBackfillMonitor).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: '6a1cea220000000008025813',
      postUrl: 'https://www.xiaohongshu.com/explore/6a1cea220000000008025813',
      title: '山的那边是什么',
      cover: 'image-1',
      source: 'published_backfill',
      monitorStatus: 'published',
      fetchStatus: 'reviewing',
      publishRecordId: 'record-1',
      publishTraceId: 'trace-1',
      linkStatus: PublishRecordLinkStatus.PENDING,
    }))
    expect(publishRecordService.updateWorkLinkById).toHaveBeenCalledWith('record-1', {
      dataId: '6a1cea220000000008025813',
      linkStatus: PublishRecordLinkStatus.PENDING,
      linkMeta: {
        provider: 'multipost',
        traceId: 'trace-1',
        pendingConfirmation: true,
        unverifiedWorkLink: 'https://www.xiaohongshu.com/explore/6a1cea220000000008025813',
        missingXsecToken: true,
      },
    })
  })
})

describe('PublishController XHS token refresh', () => {
  it('queues manual token refresh with noteId resolved from unverified work link', async () => {
    const { controller, publishRecordService, queueService, monitoredPostRepository } = createController()
    publishRecordService.getPublishRecordInfo.mockResolvedValue({
      id: 'record-1',
      userId: 'user-1',
      dataId: 'req-1780283591198-n6d0xvwg',
      accountType: 'xhs',
      accountId: 'account-1',
      title: '山的那边是什么',
      coverUrl: 'cover-1',
      linkMeta: {
        pendingConfirmation: true,
        unverifiedWorkLink: 'https://www.xiaohongshu.com/explore/6a1cf8dc000000000803e2af',
      },
    })

    const result = await controller.refreshXhsToken({ id: 'user-1' } as any, 'record-1')

    expect(result).toEqual({ success: true })
    expect(queueService.addXhsTokenRefreshJob).toHaveBeenCalledWith(expect.objectContaining({
      publishRecordId: 'record-1',
      userId: 'user-1',
      noteId: '6a1cf8dc000000000803e2af',
    }))
  })

  it('updates token from plugin only for the current user and backfills the work-data monitor', async () => {
    const { controller, publishRecordService, queueService, monitoredPostRepository } = createController()
    publishRecordService.getPublishRecordInfo.mockResolvedValue({
      id: 'record-1',
      userId: 'user-1',
      dataId: '6a1cf8dc000000000803e2af',
      accountType: 'xhs',
      accountId: 'account-1',
      title: '山的那边是什么',
      coverUrl: 'cover-1',
      linkMeta: {
        pendingConfirmation: true,
        unverifiedWorkLink: 'https://www.xiaohongshu.com/explore/6a1cf8dc000000000803e2af',
      },
    })
    publishRecordService.updateWorkLinkById.mockResolvedValue({ id: 'record-1' })

    const result = await controller.updateTokenFromPlugin({ id: 'user-1' } as any, {
      publishRecordId: 'record-1',
      noteId: '6a1cf8dc000000000803e2af',
      workLink: 'https://www.xiaohongshu.com/explore/6a1cf8dc000000000803e2af?xsec_token=token-1&xsec_source=pc_creatormng',
      xsecToken: 'token-1',
      xsecSource: 'pc_creatormng',
      authorUserId: 'author-1',
    } as any)

    expect(result).toEqual({ success: true })
    expect(publishRecordService.updateWorkLinkById).toHaveBeenCalledWith('record-1', {
      dataId: '6a1cf8dc000000000803e2af',
      workLink: 'https://www.xiaohongshu.com/explore/6a1cf8dc000000000803e2af?xsec_token=token-1&xsec_source=pc_creatormng',
      linkStatus: PublishRecordLinkStatus.READY,
      linkMeta: {
        pendingConfirmation: false,
        unverifiedWorkLink: 'https://www.xiaohongshu.com/explore/6a1cf8dc000000000803e2af',
        tokenAutoRefreshed: true,
        tokenRefreshedAt: expect.any(Date),
      },
    })
    expect(queueService.addAcquisitionPostBackfillJob).toHaveBeenCalledWith({
      userId: 'user-1',
      accountId: 'account-1',
      platform: 'xhs',
      postUrl: 'https://www.xiaohongshu.com/explore/6a1cf8dc000000000803e2af?xsec_token=token-1&xsec_source=pc_creatormng',
      authorUserId: 'author-1',
      xsecToken: 'token-1',
      xsecSource: 'pc_creatormng',
    })
    expect(monitoredPostRepository.upsertPublishedBackfillMonitor).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      platform: 'xhs',
      accountId: 'account-1',
      postId: '6a1cf8dc000000000803e2af',
      postUrl: 'https://www.xiaohongshu.com/explore/6a1cf8dc000000000803e2af?xsec_token=token-1&xsec_source=pc_creatormng',
      title: '山的那边是什么',
      cover: 'cover-1',
      source: 'published_backfill',
      monitorStatus: 'active',
      fetchStatus: 'idle',
      publishRecordId: 'record-1',
      linkStatus: PublishRecordLinkStatus.READY,
      xsecToken: 'token-1',
      xsecSource: 'pc_creatormng',
    }))
  })
})
