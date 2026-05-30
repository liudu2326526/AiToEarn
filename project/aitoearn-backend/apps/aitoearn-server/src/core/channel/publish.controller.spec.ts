import { PublishRecordLinkStatus, PublishStatus } from '@yikart/mongodb'
import { describe, expect, it, vi } from 'vitest'
import { PublishController } from './publish.controller'

function createController() {
  const publishRecordService = {
    getPublishRecordInfo: vi.fn(),
    updateStatusById: vi.fn(),
    updateWorkLinkById: vi.fn(),
    completeById: vi.fn(),
  }
  const platformService = {
    getWorkLinkInfo: vi.fn(),
  }
  const queueService = {
    addAcquisitionPostBackfillJob: vi.fn(),
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
  )

  return {
    controller,
    publishRecordService,
    platformService,
    queueService,
  }
}

describe('PublishController.updatePluginPublishResult', () => {
  it('keeps XHS bare work links pending without backfill', async () => {
    const { controller, publishRecordService, platformService, queueService } = createController()
    const updatedRecord = { id: 'record-1', linkStatus: PublishRecordLinkStatus.PENDING }
    publishRecordService.getPublishRecordInfo.mockResolvedValue({
      id: 'record-1',
      userId: 'user-1',
      dataId: 'trace-1',
      accountType: 'xhs',
      accountId: 'account-1',
      linkMeta: { provider: 'multipost' },
    })
    publishRecordService.updateWorkLinkById.mockResolvedValue(updatedRecord)

    const result = await controller.updatePluginPublishResult({ id: 'user-1' } as any, {
      id: 'record-1',
      success: true,
      workLink: 'https://www.xiaohongshu.com/explore/6a1a6469000000000702602a',
    } as any)

    expect(result).toBe(updatedRecord)
    expect(queueService.addAcquisitionPostBackfillJob).not.toHaveBeenCalled()
    expect(platformService.getWorkLinkInfo).not.toHaveBeenCalled()
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
})
