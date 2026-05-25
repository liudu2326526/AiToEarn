import { createZodDto } from '@yikart/common'
import { PromotionSettlementType, PromotionTaskStatus } from '@yikart/channel-db'
import { z } from 'zod'

const PageSchema = z.coerce.number().int().min(1).default(1)
const PageSizeSchema = z.coerce.number().int().min(1).max(100).default(20)

export const PromotionTaskListSchema = z.object({
  page: PageSchema,
  pageSize: PageSizeSchema,
  keyword: z.string().trim().optional(),
  platform: z.string().trim().optional(),
  settlementType: z.enum(PromotionSettlementType).optional(),
  tag: z.string().trim().optional(),
})
export class PromotionTaskListDto extends createZodDto(PromotionTaskListSchema, 'PromotionTaskListDto') {}

export const CreatePromotionTaskSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(1000).optional(),
  platform: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  settlementType: z.enum(PromotionSettlementType),
  rewardAmount: z.number().min(0).optional(),
  cpmRewardPerThousand: z.number().min(0).optional(),
  cpeRewardPerThousand: z.number().min(0).optional(),
  capAmount: z.number().min(0).optional(),
  followerLimit: z.number().int().min(0).optional(),
  quotaTotal: z.number().int().min(0).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  oneClickPostEnabled: z.boolean().optional(),
  materialGroupId: z.string().optional(),
  status: z.enum(PromotionTaskStatus).optional(),
})
export class CreatePromotionTaskDto extends createZodDto(CreatePromotionTaskSchema, 'CreatePromotionTaskDto') {}

export const UpdatePromotionTaskSchema = CreatePromotionTaskSchema.partial()
export class UpdatePromotionTaskDto extends createZodDto(UpdatePromotionTaskSchema, 'UpdatePromotionTaskDto') {}

export const AcceptPromotionTaskSchema = z.object({
  accountId: z.string().optional(),
})
export class AcceptPromotionTaskDto extends createZodDto(AcceptPromotionTaskSchema, 'AcceptPromotionTaskDto') {}

export const SubmitPromotionWorkSchema = z.object({
  workLink: z.string().url(),
  publishRecordId: z.string().optional(),
})
export class SubmitPromotionWorkDto extends createZodDto(SubmitPromotionWorkSchema, 'SubmitPromotionWorkDto') {}

export const ReviewPromotionSubmissionSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
})
export class ReviewPromotionSubmissionDto extends createZodDto(ReviewPromotionSubmissionSchema, 'ReviewPromotionSubmissionDto') {}
