import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AcquisitionContentRepository } from './acquisition-content.repository'
import { AcquisitionContent, AcquisitionContentStatus } from '../schemas/acquisition-content.schema'

function createModel() {
  return {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    countDocuments: vi.fn(),
  }
}

describe('AcquisitionContentRepository', () => {
  const model = createModel()
  const repository = new AcquisitionContentRepository(model as any)

  beforeEach(() => vi.clearAllMocks())

  it('creates a generated content workflow record', async () => {
    model.create.mockResolvedValue({ id: 'content-1', status: AcquisitionContentStatus.PendingReview })

    const result = await repository.createByUser({
      userId: 'user-1',
      productName: '通勤针织裙',
      productCategory: '裙子',
      targetPlatforms: ['xhs', 'douyin'] as any,
      status: AcquisitionContentStatus.PendingReview,
      platformContents: [],
    })

    expect(result.id).toBe('content-1')
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      productName: '通勤针织裙',
      status: AcquisitionContentStatus.PendingReview,
    }))
  })

  it('updates status with optimistic version increment', async () => {
    model.findOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ id: 'content-1', status: AcquisitionContentStatus.Approved, version: 2 }),
      }),
    })

    const result = await repository.updateStatusById('content-1', 'user-1', AcquisitionContentStatus.Approved)

    expect(result?.status).toBe(AcquisitionContentStatus.Approved)
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'content-1', userId: 'user-1' },
      { $set: { status: AcquisitionContentStatus.Approved }, $inc: { version: 1 } },
      { new: true },
    )
  })
})
