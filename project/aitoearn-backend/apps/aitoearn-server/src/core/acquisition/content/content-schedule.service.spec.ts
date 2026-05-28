import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AcquisitionContentStatus } from '@yikart/channel-db'
import { ContentScheduleService } from './content-schedule.service'

describe('ContentScheduleService', () => {
  const repository = {
    getByIdAndUserId: vi.fn(),
    updateStatusById: vi.fn(),
    updatePlatformContentsById: vi.fn(),
  }
  const publishingService = {
    createPublishingTask: vi.fn(),
    getPublishTaskListByFlowId: vi.fn(),
  }
  const service = new ContentScheduleService(
    repository as any,
    publishingService as any,
  )

  beforeEach(() => vi.clearAllMocks())

  it('creates publish tasks for approved platform variants', async () => {
    repository.getByIdAndUserId.mockResolvedValue({
      id: 'content-1',
      userId: 'user-1',
      status: AcquisitionContentStatus.Approved,
      platformContents: [{ platform: 'xhs', title: '标题', body: '正文', topics: ['穿搭'] }],
    })
    publishingService.createPublishingTask.mockResolvedValue({ id: 'publish-1' })
    repository.updatePlatformContentsById.mockResolvedValue({})
    repository.updateStatusById.mockResolvedValue({ id: 'content-1', status: AcquisitionContentStatus.Scheduled })

    const result = await service.schedule('user-1', 'content-1', {
      publishAt: new Date('2026-05-29T12:00:00.000Z'),
      accountMap: { xhs: 'acc-1' } as any,
    })

    expect(result.status).toBe(AcquisitionContentStatus.Scheduled)
    expect(publishingService.createPublishingTask).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 'acc-1',
      accountType: 'xhs',
      title: '标题',
      desc: '正文',
      topics: ['穿搭'],
    }))
  })
})
