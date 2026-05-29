import { createZodDto, PaginationDtoSchema } from '@yikart/common'
import { z } from 'zod'

export const WorkDataPlatformSchema = z.enum(['xhs', 'douyin', 'kwai']).describe('平台')

export const CreateMonitoredPostSchema = z.object({
  platform: WorkDataPlatformSchema.describe('平台'),
  accountId: z.string().min(1).describe('账号 ID'),
  postUrl: z.string().url().describe('作品链接'),
  postId: z.string().optional().describe('作品 ID'),
})
export class CreateMonitoredPostDto extends createZodDto(CreateMonitoredPostSchema, 'CreateMonitoredPostDto') {}

export const ListMonitoredPostQuerySchema = PaginationDtoSchema.extend({
  platform: WorkDataPlatformSchema.optional().describe('平台'),
  accountId: z.string().optional().describe('账号 ID'),
  source: z.enum(['manual', 'published_backfill', 'demo_seed']).optional().describe('来源'),
  monitorStatus: z.enum(['active', 'paused', 'failed', 'archived']).optional().describe('监控状态'),
  fetchStatus: z.enum(['idle', 'fetching', 'ready', 'failed', 'permission_required', 'not_configured', 'pending_confirmation']).optional().describe('抓取状态'),
  keyword: z.string().optional().describe('标题或链接关键词'),
})
export class ListMonitoredPostQueryDto extends createZodDto(ListMonitoredPostQuerySchema, 'ListMonitoredPostQueryDto') {}

export const SnapshotHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('返回数量'),
})
export class SnapshotHistoryQueryDto extends createZodDto(SnapshotHistoryQuerySchema, 'SnapshotHistoryQueryDto') {}

export const WorkCommentQuerySchema = PaginationDtoSchema.extend({
  keyword: z.string().optional().describe('评论关键词'),
  parentCommentId: z.string().optional().describe('父评论 ID'),
  dataSource: z.string().optional().describe('数据来源'),
  fetchBatch: z.string().optional().describe('抓取批次'),
  sortBy: z.enum(['time', 'like']).default('time').describe('评论排序'),
})
export class WorkCommentQueryDto extends createZodDto(WorkCommentQuerySchema, 'WorkCommentQueryDto') {}
