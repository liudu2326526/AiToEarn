import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReplySuggestionService } from './reply-suggestion.service'

describe('ReplySuggestionService', () => {
  const leadRepository = {
    getByIdAndUser: vi.fn(),
    updateById: vi.fn(),
  }
  const leadActivityLogRepository = {
    append: vi.fn(),
  }
  const aiService = {
    chatCompletion: vi.fn(),
  }
  const sensitiveWordService = {
    check: vi.fn(),
  }
  let service: ReplySuggestionService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ReplySuggestionService(
      leadRepository as any,
      leadActivityLogRepository as any,
      aiService as any,
      sensitiveWordService as any,
    )
  })

  it('stores blocked suggestion when generated reply hits sensitive rules', async () => {
    leadRepository.getByIdAndUser.mockResolvedValue({
      id: 'lead-1',
      platform: 'xhs',
      sourceContent: '多少钱',
    })
    aiService.chatCompletion.mockResolvedValue({ content: '加微信详聊', model: 'gpt-5.5' })
    sensitiveWordService.check.mockReturnValue({ passed: false, hits: ['微信'] })
    leadRepository.updateById.mockResolvedValue({ id: 'lead-1', suggestedReply: { status: 'blocked' } })

    await service.generate('user-1', 'lead-1', 'operator-1')

    expect(leadRepository.updateById).toHaveBeenCalledWith('lead-1', expect.objectContaining({
      suggestedReply: expect.objectContaining({
        content: '加微信详聊',
        status: 'blocked',
        riskHits: ['微信'],
      }),
    }))
  })
})
