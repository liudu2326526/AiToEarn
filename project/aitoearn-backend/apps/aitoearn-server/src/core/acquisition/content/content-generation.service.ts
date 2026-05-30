import { Injectable } from '@nestjs/common'
import { AiService } from '@yikart/aitoearn-ai-client'
import { AccountType } from '@yikart/aitoearn-server-client'
import { AccountOpsConfig, AccountOpsConfigRepository, AcquisitionContentRepository, AcquisitionContentStatus } from '@yikart/channel-db'
import { CreditsConsumptionSource, UserType } from '@yikart/common'
import { z } from 'zod'
import { SensitiveWordService } from '../../sensitive-word/sensitive-word.service'
import { GenerateAcquisitionContentDto } from './acquisition-content.dto'
import { HookSelectionService } from './hook-selection.service'
import { PlatformContentAdapterService } from './platform-content-adapter.service'

const AiGeneratedVariantSchema = z.object({
  platform: z.enum(['xhs', 'douyin', 'kwai']),
  title: z.string(),
  body: z.string(),
  topics: z.array(z.string()).default([]),
  suggestedPublishAt: z.string().optional(),
  strategyNote: z.string().default(''),
})

const AiGeneratedContentSchema = z.object({
  variants: z.array(AiGeneratedVariantSchema).min(1),
})

@Injectable()
export class ContentGenerationService {
  constructor(
    private readonly aiService: AiService,
    private readonly acquisitionContentRepository: AcquisitionContentRepository,
    private readonly accountOpsConfigRepository: AccountOpsConfigRepository,
    private readonly hookSelectionService: HookSelectionService,
    private readonly platformContentAdapter: PlatformContentAdapterService,
    private readonly sensitiveWordService: SensitiveWordService,
  ) {}

  async generate(userId: string, userType: UserType, dto: GenerateAcquisitionContentDto) {
    const accountConfig = dto.accountIds[0]
      ? await this.accountOpsConfigRepository.getByAccountId(userId, dto.accountIds[0])
      : null
    const prompt = this.buildPrompt(dto, accountConfig)
    try {
      const aiResult = await this.aiService.chatCompletion({
        userId,
        userType,
        model: dto.chatModel,
        source: CreditsConsumptionSource.Plugin,
        messages: [
          { role: 'system', content: '你是服装行业社交媒体获客文案策划。只输出 JSON，不要 Markdown。' },
          { role: 'user', content: prompt },
        ],
      })
      const parsed = AiGeneratedContentSchema.parse(JSON.parse(String(aiResult.content || '{}')))
      const platformContents = []

      for (const variant of parsed.variants) {
        const normalized = this.platformContentAdapter.normalize(variant)
        const hook = dto.autoAttachHook
          ? await this.hookSelectionService.selectHook({
            userId,
            platform: normalized.platform,
            accountId: dto.accountIds[0],
            category: dto.productCategory,
          })
          : null
        const bodyWithHook = hook ? `${normalized.body}\n\n${hook.content}` : normalized.body
        const safety = this.sensitiveWordService.check(`${normalized.title}\n${bodyWithHook}\n${normalized.topics.join(' ')}`)
        if (!safety.passed) {
          return await this.createFailed(userId, dto, `generated public content blocked: ${safety.hits.join(',')}`, String(aiResult.model || ''))
        }
        platformContents.push({
          ...normalized,
          body: bodyWithHook,
          suggestedPublishAt: variant.suggestedPublishAt ? new Date(variant.suggestedPublishAt) : undefined,
          hook: hook || { hookTemplateId: '', content: '', category: '' },
          strategyNote: variant.strategyNote,
          accountId: '',
          publishRecordId: '',
        })
      }

      const draftTaskIds = dto.generateMedia ? await this.createMediaTasks(userId, userType, dto, prompt) : []
      return await this.acquisitionContentRepository.createByUser({
        userId,
        productName: dto.productName,
        productCategory: dto.productCategory,
        priceRange: dto.priceRange || '',
        sizeRange: dto.sizeRange || '',
        sellingPoints: dto.sellingPoints,
        contentStyle: dto.contentStyle || '',
        referenceImageUrls: dto.referenceImageUrls,
        targetPlatforms: dto.platforms,
        status: AcquisitionContentStatus.PendingReview,
        platformContents,
        draftTaskIds,
        generatedByModel: String(aiResult.model || ''),
      })
    }
    catch (error) {
      return await this.createFailed(userId, dto, error instanceof Error ? error.message : 'generation failed', '')
    }
  }

  private buildPrompt(dto: GenerateAcquisitionContentDto, accountConfig?: AccountOpsConfig | null) {
    const lines = [
      '你是服装行业社交媒体获客文案策划。',
      '只输出 JSON，不要 Markdown。',
      '输出格式: {"variants":[{"platform":"xhs|douyin|kwai","title":"","body":"","topics":[],"suggestedPublishAt":"ISO 时间","strategyNote":""}]}',
      '公开内容禁止出现微信号、手机号、URL、二维码、加我等联系方式引导。',
      `平台: ${dto.platforms.join(',')}`,
      `产品名称: ${dto.productName}`,
      `产品类型: ${dto.productCategory}`,
      `价格区间: ${dto.priceRange || '未提供'}`,
      `尺码范围: ${dto.sizeRange || '未提供'}`,
      `卖点: ${dto.sellingPoints}`,
      `风格: ${dto.contentStyle || '自然种草'}`,
    ]

    if (accountConfig?.replyTone) {
      lines.push(`账号语气: ${accountConfig.replyTone}`)
    }
    if (accountConfig?.sensitiveWords?.length) {
      lines.push(`账号自定义敏感词: ${accountConfig.sensitiveWords.join(',')}`)
    }

    return lines.join('\n')
  }

  private async createMediaTasks(userId: string, userType: UserType, dto: GenerateAcquisitionContentDto, prompt: string) {
    if (dto.mediaMode === 'video' && dto.model) {
      const response = await this.aiService.createDraftV2({
        userId,
        userType,
        quantity: 1,
        model: dto.model,
        prompt,
        captionPrompt: prompt,
        imageUrls: dto.referenceImageUrls,
        platforms: dto.platforms.map(platform => this.toAccountType(platform)),
        draftType: 'draft',
        disableMemory: true,
      })
      return response.taskIds
    }
    if (dto.mediaMode === 'image_text' && dto.imageModel) {
      const response = await this.aiService.createImageTextDraft({
        userId,
        userType,
        quantity: 1,
        imageModel: dto.imageModel,
        imageCount: 1,
        prompt,
        captionPrompt: prompt,
        imageUrls: dto.referenceImageUrls,
        platforms: dto.platforms.map(platform => this.toAccountType(platform)),
        draftType: 'draft',
        disableMemory: true,
      })
      return response.taskIds
    }
    return []
  }

  private async createFailed(userId: string, dto: GenerateAcquisitionContentDto, failureReason: string, model: string) {
    return await this.acquisitionContentRepository.createByUser({
      userId,
      productName: dto.productName,
      productCategory: dto.productCategory,
      priceRange: dto.priceRange || '',
      sizeRange: dto.sizeRange || '',
      sellingPoints: dto.sellingPoints,
      contentStyle: dto.contentStyle || '',
      referenceImageUrls: dto.referenceImageUrls,
      targetPlatforms: dto.platforms,
      status: AcquisitionContentStatus.GenerationFailed,
      platformContents: [],
      generatedByModel: model,
      failureReason,
    })
  }

  private toAccountType(platform: 'xhs' | 'douyin' | 'kwai') {
    if (platform === 'xhs') return AccountType.Xhs
    if (platform === 'douyin') return AccountType.Douyin
    return AccountType.KWAI
  }
}
