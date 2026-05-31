import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export type LeadReplyTaskDocument = HydratedDocument<LeadReplyTask>

export enum LeadReplyTaskStatus {
  Pending = 'pending',
  Queued = 'queued',
  Running = 'running',
  Success = 'success',
  Failed = 'failed',
  Blocked = 'blocked',
  HumanRequired = 'human_required',
  Cancelled = 'cancelled',
}

export enum LeadReplyExecutorKind {
  BrowserPlugin = 'browser_plugin',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'lead_reply_task' })
export class LeadReplyTask extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  userId: string

  @Prop({ required: true, index: true, type: String })
  leadId: string

  @Prop({ required: true, enum: ['xhs', 'douyin', 'kwai'], index: true, type: String })
  platform: 'xhs' | 'douyin' | 'kwai'

  @Prop({ required: true, index: true, type: String })
  accountId: string

  @Prop({ required: true, index: true, type: String })
  postId: string

  @Prop({ required: true, type: String })
  postUrl: string

  @Prop({ required: true, index: true, type: String })
  commentId: string

  @Prop({ type: String, default: '' })
  parentCommentId: string

  @Prop({ required: true, type: String })
  replyContent: string

  @Prop({ required: true, type: String })
  replyStyle: string

  @Prop({ required: true, enum: LeadReplyTaskStatus, default: LeadReplyTaskStatus.Pending, index: true, type: String })
  status: LeadReplyTaskStatus

  @Prop({ required: true, enum: LeadReplyExecutorKind, default: LeadReplyExecutorKind.BrowserPlugin, type: String })
  executorKind: LeadReplyExecutorKind

  @Prop({ type: Number, default: 0 })
  attemptCount: number

  @Prop({ required: true, index: true, type: String })
  rateKey: string

  @Prop({ type: String, default: '' })
  lastError: string

  @Prop({ type: String, default: '' })
  platformReplyId: string

  @Prop({ type: String, default: '' })
  screenshotUrl: string

  @Prop({ type: Date, default: null })
  startedAt?: Date

  @Prop({ type: Date, default: null })
  finishedAt?: Date
}

export const LeadReplyTaskSchema = SchemaFactory.createForClass(LeadReplyTask)

LeadReplyTaskSchema.index({ userId: 1, status: 1, createdAt: -1 }, { name: 'idx_lead_reply_task_user_status_created' })
LeadReplyTaskSchema.index({ leadId: 1, createdAt: -1 }, { name: 'idx_lead_reply_task_lead_created' })
LeadReplyTaskSchema.index({ rateKey: 1, status: 1, createdAt: 1 }, { name: 'idx_lead_reply_task_rate_status_created' })
LeadReplyTaskSchema.index(
  { leadId: 1 },
  {
    name: 'uniq_lead_reply_task_active_lead',
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'queued', 'running'] } },
  },
)
