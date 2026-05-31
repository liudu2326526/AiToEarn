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
  const monitoredPostRepository = {
    findByUserPostIdentities: vi.fn(),
  }
  let service: LeadManagementService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new LeadManagementService(leadRepository as any, leadActivityLogRepository as any, monitoredPostRepository as any)
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

  it('updates the lead reply style and records the change', async () => {
    leadRepository.getByIdAndUser.mockResolvedValue({ id: 'lead-1', replyStyle: 'auto' })
    leadRepository.updateById.mockResolvedValue({ id: 'lead-1', replyStyle: 'promotion' })

    const result = await service.updateReplyStyle('user-1', 'lead-1', 'promotion', 'operator-1')

    expect(result.replyStyle).toBe('promotion')
    expect(leadRepository.updateById).toHaveBeenCalledWith('lead-1', expect.objectContaining({
      replyStyle: 'promotion',
    }))
    expect(leadActivityLogRepository.append).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      leadId: 'lead-1',
      action: 'reply_style_changed',
      fromValue: 'auto',
      toValue: 'promotion',
    }))
  })

  it('auto selects reply styles for filtered leads that still use system judgement', async () => {
    leadRepository.listByUser.mockResolvedValue([
      [
        { id: 'lead-link', replyStyle: 'auto', sourceContent: '衣服求链' },
        { id: 'lead-size', replyStyle: 'auto', sourceContent: '这个尺码适合 160 吗' },
        { id: 'lead-negative', replyStyle: 'auto', sourceContent: '这个质量不行，太贵了' },
        { id: 'lead-friendly', replyStyle: 'auto', sourceContent: '哈哈哈太可爱了' },
        { id: 'lead-manual', replyStyle: 'friendly', sourceContent: '哪里买' },
      ],
      5,
    ])
    leadRepository.updateById.mockImplementation((id, data) => Promise.resolve({ id, ...data }))

    const result = await service.autoSelectReplyStyles(
      'user-1',
      { postId: 'post-1', onlyAuto: true, limit: 20 } as any,
      'operator-1',
    )

    expect(result).toEqual({
      total: 5,
      updated: 4,
      skipped: 1,
      styles: {
        friendly: 1,
        professional: 1,
        promotion: 1,
        restrained: 1,
      },
    })
    expect(leadRepository.listByUser).toHaveBeenCalledWith('user-1', expect.objectContaining({
      postId: 'post-1',
      page: 1,
      pageSize: 20,
    }))
    expect(leadRepository.updateById).toHaveBeenCalledWith('lead-link', expect.objectContaining({ replyStyle: 'promotion' }))
    expect(leadRepository.updateById).toHaveBeenCalledWith('lead-size', expect.objectContaining({ replyStyle: 'professional' }))
    expect(leadRepository.updateById).toHaveBeenCalledWith('lead-negative', expect.objectContaining({ replyStyle: 'restrained' }))
    expect(leadRepository.updateById).toHaveBeenCalledWith('lead-friendly', expect.objectContaining({ replyStyle: 'friendly' }))
    expect(leadRepository.updateById).not.toHaveBeenCalledWith('lead-manual', expect.anything())
    expect(leadActivityLogRepository.append).toHaveBeenCalledWith(expect.objectContaining({
      action: 'auto_reply_style_selected',
      leadId: 'lead-link',
      fromValue: 'auto',
      toValue: 'promotion',
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

  it('enriches listed leads with their source post context', async () => {
    leadRepository.listByUser.mockResolvedValue([
      [
        {
          id: 'lead-1',
          platform: 'xhs',
          accountId: 'account-1',
          postId: 'post-1',
          sourceContent: '衣服求链',
        },
      ],
      1,
    ])
    monitoredPostRepository.findByUserPostIdentities.mockResolvedValue([
      {
        platform: 'xhs',
        accountId: 'account-1',
        postId: 'post-1',
        title: '海边的感觉',
        postUrl: 'https://www.xiaohongshu.com/explore/post-1',
        cover: 'https://example.com/cover.jpg',
      },
    ])

    const [list, total] = await service.list('user-1', { page: 1, pageSize: 20 } as any)

    expect(total).toBe(1)
    expect(list[0]).toEqual(expect.objectContaining({
      postTitle: '海边的感觉',
      postUrl: 'https://www.xiaohongshu.com/explore/post-1',
      postCover: 'https://example.com/cover.jpg',
    }))
    expect(monitoredPostRepository.findByUserPostIdentities).toHaveBeenCalledWith('user-1', [
      { platform: 'xhs', accountId: 'account-1', postId: 'post-1' },
    ])
  })
})
