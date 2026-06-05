import { createZodDto } from '@yikart/common'
import { z } from 'zod'

export const DouyinCreatorImportCommentsSchema = z.object({
  accountId: z.string().min(1).describe('AitoEarn channel account ID that owns the Douyin Creator Center session'),
  workTitle: z.string().optional().describe('Creator Center work title filter; omit only when exportAll is true'),
  exportAll: z.boolean().default(false).describe('Whether to export all visible works instead of a single work'),
  limit: z.coerce.number().int().min(1).max(5000).default(500).describe('Maximum comments to import; import limit is separate from reply-send batch limit'),
})

export class DouyinCreatorImportCommentsDto extends createZodDto(
  DouyinCreatorImportCommentsSchema,
  'DouyinCreatorImportCommentsDto',
) {}

export const DouyinCreatorImportDmsSchema = z.object({
  accountId: z.string().min(1).describe('AitoEarn channel account ID that owns the Douyin Creator Center session'),
  limit: z.coerce.number().int().min(1).max(200).default(50).describe('Maximum existing DM conversations to import'),
})

export class DouyinCreatorImportDmsDto extends createZodDto(
  DouyinCreatorImportDmsSchema,
  'DouyinCreatorImportDmsDto',
) {}

export const DouyinCreatorReplySchema = z.object({
  leadIds: z.array(z.string()).min(1).max(20).describe('Lead IDs to create reply tasks for'),
  dryRun: z.boolean().default(true).describe('Create review/dry-run tasks instead of confirmed send tasks'),
  limit: z.coerce.number().int().min(1).max(20).default(20).describe('Maximum reply tasks to create in this request'),
})

export class DouyinCreatorReplyDto extends createZodDto(
  DouyinCreatorReplySchema,
  'DouyinCreatorReplyDto',
) {}

export const DouyinCreatorArticlePublishDryRunSchema = z.object({
  title: z.string().min(1).max(30).describe('Article title to fill in Douyin Creator Center'),
  subtitle: z.string().max(30).optional().describe('Optional article summary/subtitle'),
  content: z.string().min(1).max(8000).describe('Article body to fill in Douyin Creator Center'),
  imagePath: z.string().min(1).describe('Local cover image path accessible to the backend host'),
  music: z.string().optional().default('').describe('Optional music name to search in Creator Center'),
  tags: z.array(z.string().min(1).max(30)).max(5).optional().default([]).describe('Optional topic tags appended to the article content'),
})

export class DouyinCreatorArticlePublishDryRunDto extends createZodDto(
  DouyinCreatorArticlePublishDryRunSchema,
  'DouyinCreatorArticlePublishDryRunDto',
) {}

export const DouyinCreatorImageTextPublishDryRunSchema = z.object({
  title: z.string().max(20).optional().default('').describe('Image-text title to fill in Douyin Creator Center'),
  description: z.string().max(1000).optional().default('').describe('Image-text description to fill in Douyin Creator Center'),
  imagePaths: z.array(z.string().min(1)).min(1).max(35).describe('Local image paths accessible to the backend host'),
  music: z.string().optional().default('').describe('Optional music name to search in Creator Center'),
})

export class DouyinCreatorImageTextPublishDryRunDto extends createZodDto(
  DouyinCreatorImageTextPublishDryRunSchema,
  'DouyinCreatorImageTextPublishDryRunDto',
) {}
