import { createZodDto } from '@yikart/common'
import { z } from 'zod'
import {
  ACQUISITION_CONTENT_STATUS_VALUES,
  ACQUISITION_PLATFORM_VALUES,
  ACQUISITION_REPLY_TONE_VALUES,
} from './acquisition-content.constants'

import { HookTemplateCategory, ScriptTemplateRiskLevel, ScriptTemplateScene } from '@yikart/channel-db'

export const AcquisitionPlatformSchema = z.enum(ACQUISITION_PLATFORM_VALUES).describe('获客平台')

export const GenerateAcquisitionContentSchema = z.object({
  accountIds: z.array(z.string().min(1).describe('账号 ID')).min(1).describe('发布账号 ID 列表'),
  platforms: z.array(AcquisitionPlatformSchema).min(1).describe('目标平台列表'),
  productName: z.string().min(1).max(80).describe('产品名称'),
  productCategory: z.string().min(1).max(40).describe('产品类型，如裙子、牛仔裤、通勤套装'),
  priceRange: z.string().max(40).optional().describe('价格区间'),
  sizeRange: z.string().max(80).optional().describe('尺码范围'),
  sellingPoints: z.string().min(1).max(800).describe('面料、版型、卖点'),
  contentStyle: z.string().max(40).optional().describe('内容风格'),
  referenceImageUrls: z.array(z.string().url().describe('参考图片 URL')).max(9).default([]).describe('产品图片或参考图片'),
  autoAttachHook: z.boolean().default(true).describe('是否自动附加引流钩子'),
  generateMedia: z.boolean().default(false).describe('是否调用现有 AI 草稿能力生成图文或视频素材'),
  mediaMode: z.enum(['image_text', 'video']).default('image_text').describe('素材生成模式'),
  chatModel: z.string().default('gpt-5.5').describe('内容规划 Chat 模型'),
  model: z.string().optional().describe('视频生成模型'),
  imageModel: z.string().optional().describe('图文生成模型'),
})
export class GenerateAcquisitionContentDto extends createZodDto(GenerateAcquisitionContentSchema, 'GenerateAcquisitionContentDto') {}

export const ListAcquisitionContentSchema = z.object({
  status: z.enum(ACQUISITION_CONTENT_STATUS_VALUES).optional().describe('内容状态'),
  platform: AcquisitionPlatformSchema.optional().describe('平台筛选'),
  productCategory: z.string().optional().describe('产品类型筛选'),
  page: z.coerce.number().int().min(1).default(1).describe('页码'),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).describe('每页数量'),
})
export class ListAcquisitionContentDto extends createZodDto(ListAcquisitionContentSchema, 'ListAcquisitionContentDto') {}

export const ReviewAcquisitionContentSchema = z.object({
  action: z.enum(['approve', 'reject']).describe('审核动作'),
  note: z.string().max(500).optional().describe('审核备注'),
})
export class ReviewAcquisitionContentDto extends createZodDto(ReviewAcquisitionContentSchema, 'ReviewAcquisitionContentDto') {}

export const UpdatePlatformContentSchema = z.object({
  platform: AcquisitionPlatformSchema.describe('平台'),
  title: z.string().max(100).describe('标题'),
  body: z.string().max(2200).describe('正文'),
  topics: z.array(z.string().min(1).max(40).describe('话题')).max(10).describe('话题列表'),
})
export class UpdatePlatformContentDto extends createZodDto(UpdatePlatformContentSchema, 'UpdatePlatformContentDto') {}

export const ScheduleAcquisitionContentSchema = z.object({
  publishAt: z.coerce.date().describe('发布时间'),
  accountMap: z.record(AcquisitionPlatformSchema, z.string().min(1).describe('账号 ID')).optional().describe('平台到账户 ID 的映射'),
})
export class ScheduleAcquisitionContentDto extends createZodDto(ScheduleAcquisitionContentSchema, 'ScheduleAcquisitionContentDto') {}

export const UpsertAccountOpsConfigSchema = z.object({
  dailyPublishLimit: z.number().int().min(0).max(100).describe('每日发布上限'),
  dailyInteractionLimit: z.number().int().min(0).max(1000).describe('每日互动上限'),
  dailyCommentFetchLimit: z.number().int().min(0).max(1000).describe('每日评论抓取上限'),
  dailyWechatGuideLimit: z.number().int().min(0).max(1000).describe('每日引导微信上限'),
  defaultWechatId: z.string().max(80).optional().describe('默认微信号，仅私聊人工确认场景使用'),
  defaultScriptStrategy: z.string().max(80).optional().describe('默认话术策略'),
  replyTone: z.enum(ACQUISITION_REPLY_TONE_VALUES).default('friendly').describe('回复语气'),
  enableAutoGenerate: z.boolean().describe('是否启用自动内容生成'),
  enableCommentFetch: z.boolean().describe('是否启用评论抓取'),
  blockPublicContactInfo: z.boolean().default(true).describe('公开内容是否拦截联系方式'),
  sensitiveWords: z.array(z.string().min(1).max(80).describe('敏感词')).max(200).describe('自定义敏感词'),
})
export class UpsertAccountOpsConfigDto extends createZodDto(UpsertAccountOpsConfigSchema, 'UpsertAccountOpsConfigDto') {}

const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(80).optional(),
})

export const ListHookTemplateSchema = PaginationQuerySchema.extend({
  category: z.nativeEnum(HookTemplateCategory).optional(),
  enabled: z.coerce.boolean().optional(),
})
export class ListHookTemplateDto extends createZodDto(ListHookTemplateSchema, 'ListHookTemplateDto') {}

export const CreateHookTemplateSchema = z.object({
  name: z.string().min(1).max(40).describe('模板名称'),
  category: z.nativeEnum(HookTemplateCategory).describe('钩子类型'),
  content: z.string().min(1).max(500).describe('钩子内容'),
  weight: z.number().min(0).max(100).default(1).describe('权重'),
  enabled: z.boolean().default(true).describe('是否启用'),
  applicablePlatforms: z.array(z.string()).default([]).describe('适用平台'),
  applicableCategories: z.array(z.string()).default([]).describe('适用类目'),
  applicableAccountIds: z.array(z.string()).default([]).describe('适用账号'),
})
export class CreateHookTemplateDto extends createZodDto(CreateHookTemplateSchema, 'CreateHookTemplateDto') {}

export const UpdateHookTemplateSchema = CreateHookTemplateSchema.extend({
  category: z.nativeEnum(HookTemplateCategory).optional(),
  weight: z.number().min(0).max(100).optional(),
  enabled: z.boolean().optional(),
  applicableAccountIds: z.array(z.string()).default([]).optional(),
}).partial()
export class UpdateHookTemplateDto extends createZodDto(UpdateHookTemplateSchema, 'UpdateHookTemplateDto') {}

export const ListScriptTemplateSchema = PaginationQuerySchema.extend({
  scene: z.nativeEnum(ScriptTemplateScene).optional(),
  riskLevel: z.nativeEnum(ScriptTemplateRiskLevel).optional(),
  enabled: z.coerce.boolean().optional(),
})
export class ListScriptTemplateDto extends createZodDto(ListScriptTemplateSchema, 'ListScriptTemplateDto') {}

export const CreateScriptTemplateSchema = z.object({
  name: z.string().min(1).max(40).describe('模板名称'),
  content: z.string().min(1).max(1000).describe('话术内容'),
  scene: z.nativeEnum(ScriptTemplateScene).describe('适用场景'),
  variables: z.array(z.string().min(1).max(40)).max(20).default([]).describe('变量名'),
  enabled: z.boolean().default(true).describe('是否启用'),
  applicableCategories: z.array(z.string()).default([]).describe('适用类目'),
  riskLevel: z.nativeEnum(ScriptTemplateRiskLevel).default(ScriptTemplateRiskLevel.Low).describe('风险等级'),
  platformConstraints: z.object({
    allowWechatId: z.boolean().default(false),
    requireManualConfirm: z.boolean().default(true),
    blockedPlatforms: z.array(z.string()).default([]),
  }).default({
    allowWechatId: false,
    requireManualConfirm: true,
    blockedPlatforms: [],
  }).describe('平台约束'),
})
export class CreateScriptTemplateDto extends createZodDto(CreateScriptTemplateSchema, 'CreateScriptTemplateDto') {}

export const UpdateScriptTemplateSchema = CreateScriptTemplateSchema.extend({
  variables: z.array(z.string().min(1).max(40)).max(20).optional(),
  enabled: z.boolean().optional(),
  riskLevel: z.nativeEnum(ScriptTemplateRiskLevel).optional(),
  platformConstraints: z.object({
    allowWechatId: z.boolean().default(false),
    requireManualConfirm: z.boolean().default(true),
    blockedPlatforms: z.array(z.string()).default([]),
  }).optional(),
}).partial()
export class UpdateScriptTemplateDto extends createZodDto(UpdateScriptTemplateSchema, 'UpdateScriptTemplateDto') {}
