import { createZodDto } from '@yikart/common'
import { z } from 'zod'

export const AcquisitionPlatformSchema = z.enum(['xhs', 'douyin', 'kwai']).describe('获客平台')

export const AcquisitionFetchWorkSchema = z.object({
  accountId: z.string().min(1).describe('平台账号 ID'),
  platform: AcquisitionPlatformSchema.describe('获客平台'),
  postUrl: z.url().describe('作品链接'),
  postId: z.string().min(1).optional().describe('平台作品 ID'),
  cursor: z.string().optional().describe('分页游标'),
})

export class AcquisitionFetchWorkDto extends createZodDto(AcquisitionFetchWorkSchema, 'AcquisitionFetchWorkDto') {}

export const AcquisitionCapabilityQuerySchema = z.object({
  accountId: z.string().min(1).describe('平台账号 ID'),
  platform: AcquisitionPlatformSchema.describe('获客平台'),
})

export class AcquisitionCapabilityQueryDto extends createZodDto(AcquisitionCapabilityQuerySchema, 'AcquisitionCapabilityQueryDto') {}

export const AcquisitionSnapshotQuerySchema = z.object({
  accountId: z.string().min(1).describe('平台账号 ID'),
  platform: AcquisitionPlatformSchema.describe('获客平台'),
  postId: z.string().min(1).describe('平台作品 ID'),
  limit: z.coerce.number().int().min(1).max(200).default(100).describe('返回数量'),
})

export class AcquisitionSnapshotQueryDto extends createZodDto(AcquisitionSnapshotQuerySchema, 'AcquisitionSnapshotQueryDto') {}
