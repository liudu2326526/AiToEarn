import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum LeadStage {
  NewComment = 'new_comment',
  Replied = 'replied',
  Messaged = 'messaged',
  WechatGuided = 'wechat_guided',
  WechatAdded = 'wechat_added',
  Lost = 'lost',
}

export enum LeadStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Converted = 'converted',
  Lost = 'lost',
  Invalid = 'invalid',
}

@Schema({ _id: false })
export class LeadAttribution {
  @Prop({ type: String, default: '' })
  hookTemplateId: string

  @Prop({ type: String, default: '' })
  scriptTemplateId: string

  @Prop({ type: Number, default: 0 })
  confidence: number
}

const LeadAttributionSchema = SchemaFactory.createForClass(LeadAttribution)

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'lead' })
export class Lead extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  platform: string

  @Prop({ required: true, index: true, type: String })
  accountId: string

  @Prop({ required: true, index: true, type: String })
  postId: string

  @Prop({ type: String, default: '', index: true })
  commentId: string

  @Prop({ type: String, default: '' })
  userName: string

  @Prop({ required: true, enum: LeadStage, default: LeadStage.NewComment, index: true })
  stage: LeadStage

  @Prop({ required: true, enum: LeadStatus, default: LeadStatus.Pending, index: true })
  status: LeadStatus

  @Prop({ type: String, default: '', index: true })
  assignee: string

  @Prop({ type: LeadAttributionSchema, default: () => ({}) })
  attribution: LeadAttribution

  @Prop({ type: Date, default: null, index: true })
  lastFollowUpAt?: Date
}

export const LeadSchema = SchemaFactory.createForClass(Lead)
