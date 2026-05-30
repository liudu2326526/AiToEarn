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
  const scriptTemplateRepository = {
    listByScene: vi.fn(),
  }
  let service: ReplySuggestionService

  beforeEach(() => {
    vi.clearAllMocks()
    scriptTemplateRepository.listByScene.mockResolvedValue([])
    service = new ReplySuggestionService(
      leadRepository as any,
      leadActivityLogRepository as any,
      aiService as any,
      sensitiveWordService as any,
      scriptTemplateRepository as any,
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

  it('includes the current user script template in the AI prompt', async () => {
    leadRepository.getByIdAndUser.mockResolvedValue({
      id: 'lead-1',
      platform: 'xhs',
      sourceContent: '有链接吗',
    })
    scriptTemplateRepository.listByScene.mockResolvedValue([
      { id: 'script-1', content: '先感谢，再提醒用户看主页橱窗。' },
    ])
    aiService.chatCompletion.mockResolvedValue({ content: '可以看主页橱窗哦', model: 'gpt-5.5' })
    sensitiveWordService.check.mockReturnValue({ passed: true, hits: [] })
    leadRepository.updateById.mockResolvedValue({ id: 'lead-1', suggestedReply: { status: 'generated' } })

    await service.generate('user-1', 'lead-1', 'operator-1')

    expect(scriptTemplateRepository.listByScene).toHaveBeenCalledWith('user-1', 'comment_praise', '')
    expect(aiService.chatCompletion).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('先感谢，再提醒用户看主页橱窗。'),
        }),
      ]),
    }))
  })
})
