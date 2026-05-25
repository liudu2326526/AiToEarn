import { UserType } from '@yikart/common'
import { describe, expect, it, vi } from 'vitest'
import { DraftGenerationService } from './draft-generation.service'

vi.mock('@yikart/assets', () => ({
  AssetsService: class {},
  VideoMetadataService: class {},
}))

vi.mock('@yikart/helpers', () => ({
  CreditsHelperService: class {},
}))

vi.mock('../ai/image/image.service', () => ({
  ImageService: class {},
}))

vi.mock('../ai/video/video.service', () => ({
  VideoService: class {},
}))

vi.mock('../ai-availability', () => ({
  AiAvailabilityService: class {},
}))

vi.mock('./draft-generation-memory.service', () => ({
  DraftGenerationMemoryService: class {},
}))

vi.mock('./draft-generation-planner.service', () => ({
  DraftGenerationPlannerService: class {},
}))

vi.mock('../../config', () => ({
  config: {
    ai: {
      draftGeneration: {
        imageModels: [
          {
            model: 'gpt-image-2',
            pricing: [{ resolution: '1K', pricePerImage: 3 }],
          },
        ],
        queue: {
          lowPriorityMinPriority: 100,
        },
        planner: {
          defaultModel: 'gpt-5.5',
        },
      },
      models: {
        chat: [
          { name: 'gpt-5.5', scenes: ['draft-generation'], outputModalities: [] },
        ],
        image: {
          generation: [{ name: 'gpt-image-2' }],
          edit: [],
        },
        video: {
          generation: [
            { name: 'grok-imagine-video', channel: 'grok', durations: [8], modes: [], defaults: { duration: 8 } },
            { name: 'doubao-seedance-2-0-260128', channel: 'volcengine', durations: [8], modes: [], defaults: { duration: 8 } },
            { name: 'doubao-seedance-2-0-fast-260128', channel: 'volcengine', durations: [8], modes: [], defaults: { duration: 8 } },
          ],
        },
      },
    },
  },
}))

vi.mock('@yikart/mongodb', () => ({
  AiLogChannel: {
    Gemini: 'gemini',
    Grok: 'grok',
    NewApi: 'new-api',
    Volcengine: 'volcengine',
  },
  AiLogStatus: {
    Generating: 'generating',
    Success: 'success',
  },
  AiLogType: {
    DraftGeneration: 'draft-generation',
  },
  AiLogRepository: class {},
  AssetType: {},
  MaterialGroupRepository: class {},
  MaterialRepository: class {},
  MaterialSource: {
    PlaceDraft: 'place-draft',
  },
  MaterialStatus: {
    SUCCESS: 'success',
  },
  MaterialType: {
    ARTICLE: 'article',
    VIDEO: 'video',
  },
  MediaType: {
    IMG: 'img',
    VIDEO: 'video',
  },
  MediaRepository: class {},
}))

describe('draftGenerationService OpenAI image size resolution', () => {
  const service = Object.create(DraftGenerationService.prototype) as unknown as {
    resolveOpenAIImageSize: (aspectRatio?: string) => string
  }

  it('为 GPT Image 2 生成真实比例且符合 16 倍数的尺寸', () => {
    expect(service.resolveOpenAIImageSize('3:2')).toBe('1536x1024')
    expect(service.resolveOpenAIImageSize('2:3')).toBe('1024x1536')
    expect(service.resolveOpenAIImageSize('4:3')).toBe('1408x1056')
    expect(service.resolveOpenAIImageSize('3:4')).toBe('1056x1408')
    expect(service.resolveOpenAIImageSize('5:4')).toBe('1360x1088')
    expect(service.resolveOpenAIImageSize('4:5')).toBe('1088x1360')
    expect(service.resolveOpenAIImageSize('16:9')).toBe('1536x864')
    expect(service.resolveOpenAIImageSize('9:16')).toBe('864x1536')
  })

  it('保留默认竖图和方图标准尺寸', () => {
    expect(service.resolveOpenAIImageSize()).toBe('1024x1536')
    expect(service.resolveOpenAIImageSize('1:1')).toBe('1024x1024')
  })

  it('拒绝 GPT Image 2 不支持的比例范围', () => {
    expect(() => service.resolveOpenAIImageSize('4:1')).toThrow('between 1:3 and 3:1')
  })
})

describe('draftGenerationService pricing models', () => {
  const service = Object.create(DraftGenerationService.prototype) as DraftGenerationService

  it('草稿视频生成定价列表包含 Grok 和 Seedance 模型', () => {
    const pricing = service.getDraftGenerationPricing()
    const modelNames = pricing.videoModels.map(model => model.name)

    expect(modelNames).toContain('grok-imagine-video')
    expect(modelNames).toContain('doubao-seedance-2-0-260128')
    expect(modelNames).toContain('doubao-seedance-2-0-fast-260128')
  })
})

describe('draftGenerationService credits preflight', () => {
  it('创建用户草稿任务前按预计积分校验余额', async () => {
    const service = Object.create(DraftGenerationService.prototype) as any
    service.creditsHelper = {
      ensureEnoughCredits: vi.fn(async () => {
        throw new Error('余额不足，请联系管理员充值')
      }),
    }

    await expect(service.assertUserCreditsSufficient('user-1', UserType.User, 9))
      .rejects
      .toThrow('余额不足，请联系管理员充值')
    expect(service.creditsHelper.ensureEnoughCredits).toHaveBeenCalledWith({
      userId: 'user-1',
      amount: 9,
    })
  })

  it('非用户或无需积分时不校验余额', async () => {
    const service = Object.create(DraftGenerationService.prototype) as any
    service.creditsHelper = {
      ensureEnoughCredits: vi.fn(),
    }

    await service.assertUserCreditsSufficient('user-1', UserType.Admin, 9)
    await service.assertUserCreditsSufficient('user-1', UserType.User, 0)

    expect(service.creditsHelper.ensureEnoughCredits).not.toHaveBeenCalled()
  })
})
