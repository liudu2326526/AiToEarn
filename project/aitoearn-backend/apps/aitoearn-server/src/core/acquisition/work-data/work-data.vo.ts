import { createPaginationVo, createZodDto } from '@yikart/common'
import { z } from 'zod'

export const MonitoredPostVoSchema = z.object({
  id: z.string().describe('ID'),
  userId: z.string().describe('用户 ID'),
  platform: z.string().describe('平台'),
  accountId: z.string().describe('账号 ID'),
  postId: z.string().describe('作品 ID'),
  postUrl: z.string().describe('作品链接'),
  title: z.string().describe('标题'),
  cover: z.string().describe('封面'),
  source: z.string().describe('来源'),
  monitorStatus: z.string().describe('监控状态'),
  fetchStatus: z.string().describe('抓取状态'),
  capabilityReason: z.string().describe('能力原因'),
  latestPostSnapshotId: z.string().describe('最新快照 ID'),
  lastFetchedAt: z.date().nullable().optional().describe('最近抓取时间'),
  nextFetchAt: z.date().nullable().optional().describe('下次抓取时间'),
  latestMetrics: z.record(z.string(), z.number()).describe('最新指标'),
  latestCommentCount: z.number().describe('最新评论数'),
  lastFetchBatch: z.string().describe('最近抓取批次'),
  publishRecordId: z.string().optional().describe('发布记录 ID'),
  publishTraceId: z.string().optional().describe('发布 trace ID'),
  linkStatus: z.string().optional().describe('作品链接状态'),
  linkError: z.string().optional().describe('作品链接错误'),
  createdAt: z.date().describe('创建时间'),
  updatedAt: z.date().describe('更新时间'),
})

export class MonitoredPostVo extends createZodDto(MonitoredPostVoSchema, 'MonitoredPostVo') {}

export const MonitoredPostListVo = createPaginationVo(MonitoredPostVoSchema, 'MonitoredPostListVo')

export const WorkCommentVoSchema = z.object({
  id: z.string().describe('ID'),
  platform: z.string().describe('平台'),
  accountId: z.string().describe('账号 ID'),
  postId: z.string().describe('作品 ID'),
  commentId: z.string().describe('评论 ID'),
  parentCommentId: z.string().describe('父评论 ID'),
  userName: z.string().describe('用户名'),
  userAvatar: z.string().describe('用户头像'),
  content: z.string().describe('内容'),
  likeCount: z.number().describe('点赞数'),
  ipLocation: z.string().describe('IP 属地'),
  commentedAt: z.date().nullable().optional().describe('评论时间'),
  fetchBatch: z.string().describe('抓取批次'),
  dataSource: z.string().describe('数据来源'),
})

export class WorkCommentVo extends createZodDto(WorkCommentVoSchema, 'WorkCommentVo') {}

export const WorkCommentListVo = createPaginationVo(WorkCommentVoSchema, 'WorkCommentListVo')

export const WorkSnapshotVoSchema = z.object({
  id: z.string().describe('ID'),
  platform: z.string().describe('平台'),
  accountId: z.string().describe('账号 ID'),
  postId: z.string().describe('作品 ID'),
  fetchDate: z.string().describe('抓取日期'),
  postUrl: z.string().describe('作品链接'),
  title: z.string().describe('标题'),
  cover: z.string().describe('封面'),
  metrics: z.object({
    normalized: z.record(z.string(), z.number()),
  }).describe('指标'),
  fetchedAt: z.date().describe('抓取时间'),
  dataSource: z.string().describe('数据来源'),
})

export class WorkSnapshotVo extends createZodDto(WorkSnapshotVoSchema, 'WorkSnapshotVo') {}
