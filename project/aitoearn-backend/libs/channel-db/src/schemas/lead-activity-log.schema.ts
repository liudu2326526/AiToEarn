import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum LeadActivityAction {
  Materialized = 'materialized',
  Assigned = 'assigned',
  Claimed = 'claimed',
  Transferred = 'transferred',
  BatchAssigned = 'batch_assigned',
  StageChanged = 'stage_changed',
  ReplyStyleChanged = 'reply_style_changed',
  BatchReplyStyleChanged = 'batch_reply_style_changed',
  AutoReplyStyleSelected = 'auto_reply_style_selected',
  NoteAdded = 'note_added',
  ReplySuggested = 'reply_suggested',
  ReplyExecuted = 'reply_executed',
  ReplyFailed = 'reply_failed',
  ReplyTaskCreated = 'reply_task_created',
  ReplyTaskQueued = 'reply_task_queued',
  ReplyTaskRunning = 'reply_task_running',
  ReplyTaskHumanRequired = 'reply_task_human_required',
  ReplyTaskCancelled = 'reply_task_cancelled',
  ReplyTaskRetryQueued = 'reply_task_retry_queued',
  PrivateMessageStatusChecked = 'private_message_status_checked',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'lead_activity_log' })
export class LeadActivityLog extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  leadId: string

  @Prop({ required: true, index: true, type: String })
  userId: string

  @Prop({ required: true, enum: LeadActivityAction, index: true, type: String })
  action: LeadActivityAction

  @Prop({ required: true, index: true, type: String })
  operatorId: string

  @Prop({ type: String, default: '' })
  fromValue: string

  @Prop({ type: String, default: '' })
  toValue: string

  @Prop({ type: String, default: '' })
  note: string
}

export const LeadActivityLogSchema = SchemaFactory.createForClass(LeadActivityLog)
