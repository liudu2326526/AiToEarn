import { AppException, ResponseCode } from '@yikart/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LeadManagementService } from './lead-management.service'

describe('LeadManagementService', () => {
  const leadRepository = {
    listByUser: vi.fn(),
    statsByUser: vi.fn(),
    getByIdAndUser: vi.fn(),
    updateById: vi.fn(),
  }
  const leadActivityLogRepository = {
    append: vi.fn(),
    listByLeadId: vi.fn(),
  }
  let service: LeadManagementService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new LeadManagementService(leadRepository as any, leadActivityLogRepository as any)
  })

  it('changes stage and derives working status', async () => {
    leadRepository.getByIdAndUser.mockResolvedValue({ id: 'lead-1', stage: 'new_comment', status: 'pending' })
    leadRepository.updateById.mockResolvedValue({ id: 'lead-1', stage: 'wechat_added', status: 'converted' })

    const result = await service.changeStage('user-1', 'lead-1', 'wechat_added', 'operator-1')

    expect(result.status).toBe('converted')
    expect(leadRepository.updateById).toHaveBeenCalledWith('lead-1', expect.objectContaining({
      stage: 'wechat_added',
      status: 'converted',
    }))
    expect(leadActivityLogRepository.append).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      leadId: 'lead-1',
      action: 'stage_changed',
    }))
  })

  it('returns aggregate status stats from repository instead of current page data', async () => {
    leadRepository.statsByUser.mockResolvedValue({
      total: 42,
      pending: 12,
      in_progress: 20,
      converted: 8,
      lost: 1,
      invalid: 1,
    })

    const result = await service.stats('user-1', { platform: 'xhs' } as any)

    expect(result).toEqual(expect.objectContaining({
      total: 42,
      pending: 12,
      in_progress: 20,
      converted: 8,
    }))
    expect(leadRepository.statsByUser).toHaveBeenCalledWith('user-1', expect.objectContaining({ platform: 'xhs' }))
  })

  it('does not expose another users timeline', async () => {
    leadRepository.getByIdAndUser.mockResolvedValue(null)

    await expect(service.timeline('user-1', 'lead-1'))
      .rejects.toMatchObject(new AppException(ResponseCode.LeadNotFound))
    expect(leadActivityLogRepository.listByLeadId).not.toHaveBeenCalled()
  })
})
