import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../mongodb.constants'
import { WithTimestampSchema } from './timestamp.schema'

export enum EngagementTaskStatus {
  CREATED = 'CREATED',
  DISTRIBUTED = 'DISTRIBUTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
  CANCELED = 'CANCELED',
  FAILED = 'FAILED',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
}
export enum EngagementTaskType {
  LIKE = 'LIKE',
  FAVORITE = 'FAVORITE',
  COMMENT = 'COMMENT', // comment on post
  REPLY = 'REPLY', // reply to comment
}

export enum EngagementTargetScope {
  ALL = 'ALL',
  PARTIAL = 'PARTIAL',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'engagementTask' })
export class EngagementTask extends WithTimestampSchema {
  id: string
  @Prop({
    required: true,
    type: String,
  })
  accountId: string

  @Prop({
    required: true,
    type: String,
  })
  userId: string

  @Prop({
    required: true,
    type: String,
  })
  postId: string

  @Prop({
    required: true,
    type: String,
  })
  platform: string

  @Prop({
    required: true,
    default: '',
    type: String,
  })
  model: string

  @Prop({
    required: false,
    default: '',
    type: String,
  })
  prompt: string

  @Prop({
    required: true,
    enum: EngagementTaskType,
    default: EngagementTaskType.REPLY,
    type: String,
  })
  taskType: EngagementTaskType

  @Prop({
    required: true,
    enum: EngagementTargetScope,
    default: EngagementTargetScope.ALL,
    type: String,
  })
  targetScope: EngagementTargetScope

  @Prop({
    required: false,
    type: [String],
  })
  targetIds: string[]

  @Prop({
    required: true,
    enum: EngagementTaskStatus,
    default: EngagementTaskStatus.CREATED,
    type: String,
  })
  status: EngagementTaskStatus

  @Prop({
    required: true,
    default: 0,
  })
  subTaskCount: number

  @Prop({
    required: true,
    default: 0,
  })
  completedSubTaskCount: number

  @Prop({
    required: true,
    default: 0,
  })
  failedSubTaskCount: number
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'engagementSubTask' })
export class EngagementSubTask extends WithTimestampSchema {
  id: string

  @Prop({
    required: true,
    index: true,
    type: String,
  })
  taskId: string

  @Prop({
    required: true,
    type: String,
  })
  accountId: string

  @Prop({
    required: true,
    type: String,
  })
  userId: string

  @Prop({
    required: true,
    type: String,
  })
  postId: string

  @Prop({
    required: true,
    type: String,
  })
  commentId: string

  @Prop({
    required: true,
    default: '',
    type: String,
  })
  commentContent: string

  @Prop({
    required: false,
    default: '',
    type: String,
  })
  replyContent: string

  @Prop({
    required: true,
    type: String,
  })
  platform: string

  @Prop({
    required: true,
    enum: EngagementTaskStatus,
    default: EngagementTaskStatus.CREATED,
    type: String,
  })
  status: EngagementTaskStatus
}
export const EngagementTaskSchema = SchemaFactory.createForClass(EngagementTask)
export const EngagementSubTaskSchema = SchemaFactory.createForClass(EngagementSubTask)
