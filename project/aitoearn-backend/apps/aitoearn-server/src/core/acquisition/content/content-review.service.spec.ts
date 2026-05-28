import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AcquisitionContentStatus } from '@yikart/channel-db'
import { ResponseCode } from '@yikart/common'
import { ContentReviewService } from './content-review.service'

describe('ContentReviewService', () => {
  const repository = {
    listByUser: vi.fn(),
    getByIdAndUserId: vi.fn(),
    updateStatusById: vi.fn(),
    updatePlatformContentsById: vi.fn(),
  }
  const sensitiveWordService = {
    check: vi.fn(),
  }
  const service = new ContentReviewService(
    repository as any,
    sensitiveWordService as any,
  )

  beforeEach(() => vi.clearAllMocks())

  it('approves pending review content', async () => {
    repository.getByIdAndUserId.mockResolvedValue({ id: 'content-1', status: AcquisitionContentStatus.PendingReview })
    repository.updateStatusById.mockResolvedValue({ id: 'content-1', status: AcquisitionContentStatus.Approved })

    const result = await service.review('user-1', 'content-1', { action: 'approve', note: 'ok' })

    expect(result.status).toBe(AcquisitionContentStatus.Approved)
  })

  it('rejects approving a scheduled item', async () => {
    repository.getByIdAndUserId.mockResolvedValue({ id: 'content-1', status: AcquisitionContentStatus.Scheduled })

    await expect(service.review('user-1', 'content-1', { action: 'approve' })).rejects.toMatchObject({
      code: ResponseCode.ValidationFailed,
    })
  })

  it('rejects reviewing a non-existent item', async () => {
    repository.getByIdAndUserId.mockResolvedValue(null)

    await expect(service.review('user-1', 'content-1', { action: 'approve' })).rejects.toMatchObject({
      code: ResponseCode.AcquisitionContentNotFound,
    })
  })
})
