import { createZodDto } from '@yikart/common'
import { z } from 'zod'

export const LeadStageSchema = z.enum(['new_comment', 'replied', 'messaged', 'wechat_guided', 'wechat_added', 'lost'])
export const LeadStatusSchema = z.enum(['pending', 'in_progress', 'converted', 'lost', 'invalid'])
export const LeadPlatformSchema = z.enum(['xhs', 'douyin', 'kwai'])
export const LeadReplyStyleSchema = z.enum(['auto', 'friendly', 'professional', 'promotion', 'restrained'])

export const LeadListQuerySchema = z.object({
  platform: LeadPlatformSchema.optional(),
  accountId: z.string().optional(),
  postId: z.string().optional(),
  stage: LeadStageSchema.optional(),
  status: LeadStatusSchema.optional(),
  assignee: z.string().optional(),
  keyword: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export class LeadListQueryDto extends createZodDto(LeadListQuerySchema, 'LeadListQueryDto') {}

export const LeadStatsQuerySchema = LeadListQuerySchema.omit({
  page: true,
  pageSize: true,
})

export class LeadStatsQueryDto extends createZodDto(LeadStatsQuerySchema, 'LeadStatsQueryDto') {}

export const AutoSelectLeadReplyStyleSchema = LeadStatsQuerySchema.extend({
  onlyAuto: z.boolean().default(true),
  limit: z.coerce.number().int().min(1).max(100).default(100),
})

export class AutoSelectLeadReplyStyleDto extends createZodDto(AutoSelectLeadReplyStyleSchema, 'AutoSelectLeadReplyStyleDto') {}

export const AutoReplyLeadSchema = z.object({
  regenerate: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  requireSuggestionReview: z.boolean().default(false),
})

export class AutoReplyLeadDto extends createZodDto(AutoReplyLeadSchema, 'AutoReplyLeadDto') {}

export const BatchAutoReplyLeadsSchema = LeadStatsQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  onlyPending: z.boolean().default(true),
  dryRun: z.boolean().default(false),
})

export class BatchAutoReplyLeadsDto extends createZodDto(BatchAutoReplyLeadsSchema, 'BatchAutoReplyLeadsDto') {}

export const LeadReplyTaskListQuerySchema = z.object({
  status: z.enum(['pending', 'queued', 'running', 'success', 'failed', 'blocked', 'human_required', 'cancelled']).optional(),
  leadId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export class LeadReplyTaskListQueryDto extends createZodDto(LeadReplyTaskListQuerySchema, 'LeadReplyTaskListQueryDto') {}

export const MaterializeLeadsSchema = z.object({
  monitoredPostId: z.string().optional(),
  platform: LeadPlatformSchema.optional(),
  accountId: z.string().optional(),
  postId: z.string().optional(),
  fetchBatch: z.string().optional(),
  postLimit: z.coerce.number().int().min(1).max(100).default(20),
  commentLimit: z.coerce.number().int().min(1).max(500).default(100),
  totalCommentLimit: z.coerce.number().int().min(1).max(500).default(100),
})

export class MaterializeLeadsDto extends createZodDto(MaterializeLeadsSchema, 'MaterializeLeadsDto') {}

export class UpdateLeadAssigneeDto extends createZodDto(
  z.object({ assignee: z.string().default('') }),
  'UpdateLeadAssigneeDto',
) {}

export class BatchAssignLeadsDto extends createZodDto(
  z.object({ leadIds: z.array(z.string()).min(1).max(100), assignee: z.string().default('') }),
  'BatchAssignLeadsDto',
) {}

export class UpdateLeadReplyStyleDto extends createZodDto(
  z.object({ replyStyle: LeadReplyStyleSchema.default('auto') }),
  'UpdateLeadReplyStyleDto',
) {}

export class BatchUpdateLeadReplyStyleDto extends createZodDto(
  z.object({ leadIds: z.array(z.string()).min(1).max(100), replyStyle: LeadReplyStyleSchema.default('auto') }),
  'BatchUpdateLeadReplyStyleDto',
) {}

export class UpdateLeadStageDto extends createZodDto(
  z.object({ stage: LeadStageSchema }),
  'UpdateLeadStageDto',
) {}

export class AddLeadNoteDto extends createZodDto(
  z.object({ note: z.string().min(1).max(1000) }),
  'AddLeadNoteDto',
) {}

export class ReplyResultDto extends createZodDto(
  z.object({
    replyContent: z.string().min(1).max(1000),
    status: z.enum(['success', 'failed']),
    executionMode: z.enum(['manual', 'platform_adapter']).default('manual'),
    failureReason: z.string().optional(),
  }),
  'ReplyResultDto',
) {}

export class PrivateMessageCapabilityQueryDto extends createZodDto(
  z.object({
    platform: LeadPlatformSchema.optional(),
    accountId: z.string().optional(),
  }),
  'PrivateMessageCapabilityQueryDto',
) {}
