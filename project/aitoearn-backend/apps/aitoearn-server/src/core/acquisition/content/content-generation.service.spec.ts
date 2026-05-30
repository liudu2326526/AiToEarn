import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AcquisitionContentStatus } from '@yikart/channel-db'
import { ContentGenerationService } from './content-generation.service'

describe('ContentGenerationService', () => {
  const aiService = {
    chatCompletion: vi.fn(),
    createImageTextDraft: vi.fn(),
    createDraftV2: vi.fn(),
  }
  const acquisitionContentRepository = {
    createByUser: vi.fn(),
  }
  const accountOpsConfigRepository = {
    getByAccountId: vi.fn(),
  }
  const hookSelectionService = {
    selectHook: vi.fn(),
  }
  const adapter = {
    normalize: vi.fn((input: any) => input),
  }
  const sensitiveWordService = {
    check: vi.fn(),
  }
  const service = new ContentGenerationService(
    aiService as any,
    acquisitionContentRepository as any,
    accountOpsConfigRepository as any,
    hookSelectionService as any,
    adapter as any,
    sensitiveWordService as any,
  )

  beforeEach(() => {
    vi.clearAllMocks()
    accountOpsConfigRepository.getByAccountId.mockResolvedValue(null)
  })

  it('generates normalized platform variants and attaches selected hook', async () => {
    hookSelectionService.selectHook.mockResolvedValue({
      hookTemplateId: 'hook-1',
      content: '想要同款的姐妹私信我',
      category: 'private_message_guide',
    })
    sensitiveWordService.check.mockReturnValue({ passed: true, hits: [] })
    aiService.chatCompletion.mockResolvedValue({
      content: JSON.stringify({
        variants: [
          {
            platform: 'xhs',
            title: '通勤针织裙',
            body: '显瘦又舒服，适合办公室',
            topics: ['通勤穿搭', '显瘦'],
            suggestedPublishAt: '2026-05-29T12:00:00.000Z',
            strategyNote: '主打显瘦通勤',
          },
        ],
      }),
      model: 'gpt-5.5',
    })
    acquisitionContentRepository.createByUser.mockResolvedValue({ id: 'content-1' })

    const result = await service.generate('user-1', 'user' as any, {
      accountIds: ['acc-1'],
      platforms: ['xhs'],
      productName: '通勤针织裙',
      productCategory: '裙子',
      sellingPoints: '显瘦，垂感好，不易皱',
      referenceImageUrls: [],
      autoAttachHook: true,
      generateMedia: false,
      mediaMode: 'image_text',
      chatModel: 'gpt-5.5',
    })

    expect(result.id).toBe('content-1')
    expect(acquisitionContentRepository.createByUser).toHaveBeenCalledWith(expect.objectContaining({
      status: AcquisitionContentStatus.PendingReview,
      platformContents: [expect.objectContaining({ platform: 'xhs', hook: expect.objectContaining({ hookTemplateId: 'hook-1' }) })],
    }))
    expect(aiService.chatCompletion).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gpt-5.5',
      messages: expect.arrayContaining([expect.objectContaining({ role: 'user' })]),
    }))
    expect(hookSelectionService.selectHook).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      accountId: 'acc-1',
    }))
  })

  it('stores generation_failed when AI output contains blocked public contact info', async () => {
    hookSelectionService.selectHook.mockResolvedValue(null)
    aiService.chatCompletion.mockResolvedValue({
      content: JSON.stringify({
        variants: [{ platform: 'xhs', title: '福利', body: '加微信 abc 领取', topics: [] }],
      }),
      model: 'gpt-5.5',
    })
    sensitiveWordService.check.mockReturnValue({ passed: false, hits: ['微信'] })
    acquisitionContentRepository.createByUser.mockResolvedValue({ id: 'content-failed', status: AcquisitionContentStatus.GenerationFailed })

    await service.generate('user-1', 'user' as any, {
      accountIds: ['acc-1'],
      platforms: ['xhs'],
      productName: '通勤针织裙',
      productCategory: '裙子',
      sellingPoints: '显瘦',
      referenceImageUrls: [],
      autoAttachHook: false,
      generateMedia: false,
      mediaMode: 'image_text',
      chatModel: 'gpt-5.5',
    })

    expect(acquisitionContentRepository.createByUser).toHaveBeenCalledWith(expect.objectContaining({
      status: AcquisitionContentStatus.GenerationFailed,
      failureReason: expect.stringContaining('微信'),
    }))
  })

  it('adds account operation guidance to the AI prompt when account config exists', async () => {
    accountOpsConfigRepository.getByAccountId.mockResolvedValue({
      replyTone: 'professional',
      sensitiveWords: ['竞品词'],
    })
    hookSelectionService.selectHook.mockResolvedValue(null)
    sensitiveWordService.check.mockReturnValue({ passed: true, hits: [] })
    aiService.chatCompletion.mockResolvedValue({
      content: JSON.stringify({
        variants: [{ platform: 'xhs', title: '通勤针织裙', body: '显瘦又舒服', topics: [] }],
      }),
      model: 'gpt-5.5',
    })
    acquisitionContentRepository.createByUser.mockResolvedValue({ id: 'content-1' })

    await service.generate('user-1', 'user' as any, {
      accountIds: ['acc-1'],
      platforms: ['xhs'],
      productName: '通勤针织裙',
      productCategory: '裙子',
      sellingPoints: '显瘦',
      referenceImageUrls: [],
      autoAttachHook: false,
      generateMedia: false,
      mediaMode: 'image_text',
      chatModel: 'gpt-5.5',
    })

    const request = aiService.chatCompletion.mock.calls[0][0]
    expect(request.messages[1].content).toContain('账号语气: professional')
    expect(request.messages[1].content).toContain('账号自定义敏感词: 竞品词')
  })
})
