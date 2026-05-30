import { createPaginationVo, createZodDto } from '@yikart/common'
import { z } from 'zod'
import {
  ACQUISITION_CONTENT_STATUS_VALUES,
  ACQUISITION_PLATFORM_VALUES,
} from './acquisition-content.constants'

const AcquisitionGeneratedHookVoSchema = z.object({
  hookTemplateId: z.string().optional(),
  content: z.string().optional(),
  category: z.string().optional(),
})

export const AcquisitionPlatformContentVoSchema = z.object({
  platform: z.enum(ACQUISITION_PLATFORM_VALUES),
  accountId: z.string().optional(),
  title: z.string(),
  body: z.string(),
  topics: z.array(z.string()),
  suggestedPublishAt: z.coerce.date().nullable().optional(),
  hook: AcquisitionGeneratedHookVoSchema.optional(),
  strategyNote: z.string().optional(),
  publishRecordId: z.string().optional(),
})

export const AcquisitionContentVoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  productName: z.string(),
  productCategory: z.string(),
  priceRange: z.string().optional(),
  sizeRange: z.string().optional(),
  sellingPoints: z.string().optional(),
  contentStyle: z.string().optional(),
  referenceImageUrls: z.array(z.string()).default([]),
  targetPlatforms: z.array(z.enum(ACQUISITION_PLATFORM_VALUES)),
  status: z.enum(ACQUISITION_CONTENT_STATUS_VALUES),
  platformContents: z.array(AcquisitionPlatformContentVoSchema).default([]),
  draftTaskIds: z.array(z.string()).default([]),
  generatedByModel: z.string().optional(),
  failureReason: z.string().optional(),
  reviewerId: z.string().optional(),
  reviewNote: z.string().optional(),
  reviewedAt: z.coerce.date().nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export class AcquisitionContentVo extends createZodDto(AcquisitionContentVoSchema, 'AcquisitionContentVo') {}
export class AcquisitionContentListVo extends createPaginationVo(AcquisitionContentVoSchema, 'AcquisitionContentListVo') {}

export const AccountOpsConfigVoSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  accountId: z.string(),
  dailyPublishLimit: z.number().optional(),
  dailyInteractionLimit: z.number().optional(),
  dailyCommentFetchLimit: z.number().optional(),
  dailyWechatGuideLimit: z.number().optional(),
  defaultWechatId: z.string().optional(),
  defaultScriptStrategy: z.string().optional(),
  replyTone: z.string().optional(),
  enableAutoGenerate: z.boolean().optional(),
  enableCommentFetch: z.boolean().optional(),
  blockPublicContactInfo: z.boolean().optional(),
  sensitiveWords: z.array(z.string()).optional(),
  commentFetchStatus: z.string().optional(),
  commentFetchStatusReason: z.string().optional(),
  commentFetchCheckedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
})
export class AccountOpsConfigVo extends createZodDto(AccountOpsConfigVoSchema, 'AccountOpsConfigVo') {}

export const HookTemplateVoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  category: z.string(),
  content: z.string(),
  weight: z.number(),
  enabled: z.boolean(),
  applicablePlatforms: z.array(z.string()).default([]),
  applicableCategories: z.array(z.string()).default([]),
  applicableAccountIds: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export class HookTemplateVo extends createZodDto(HookTemplateVoSchema, 'HookTemplateVo') {}
export class HookTemplateListVo extends createPaginationVo(HookTemplateVoSchema, 'HookTemplateListVo') {}

export const ScriptTemplateVoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  content: z.string(),
  scene: z.string(),
  variables: z.array(z.string()).default([]),
  enabled: z.boolean(),
  applicableCategories: z.array(z.string()).default([]),
  riskLevel: z.string(),
  platformConstraints: z.object({
    allowWechatId: z.boolean().default(false),
    requireManualConfirm: z.boolean().default(true),
    blockedPlatforms: z.array(z.string()).default([]),
  }).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export class ScriptTemplateVo extends createZodDto(ScriptTemplateVoSchema, 'ScriptTemplateVo') {}
export class ScriptTemplateListVo extends createPaginationVo(ScriptTemplateVoSchema, 'ScriptTemplateListVo') {}
