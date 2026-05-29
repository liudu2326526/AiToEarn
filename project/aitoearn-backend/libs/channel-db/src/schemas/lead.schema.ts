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

export enum LeadSourceType {
  PublicComment = 'public_comment',
  PrivateMessage = 'private_message',
  Manual = 'manual',
}

export enum LeadSuggestionStatus {
  Empty = 'empty',
  Generated = 'generated',
  Blocked = 'blocked',
  Edited = 'edited',
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

@Schema({ _id: false })
export class LeadSuggestedReply {
  @Prop({ type: String, default: '' })
  content: string

  @Prop({ type: String, default: '' })
  model: string

  @Prop({ required: true, enum: LeadSuggestionStatus, default: LeadSuggestionStatus.Empty, type: String })
  status: LeadSuggestionStatus

  @Prop({ type: [String], default: [] })
  riskHits: string[]

  @Prop({ type: Date, default: null })
  generatedAt?: Date
}

const LeadSuggestedReplySchema = SchemaFactory.createForClass(LeadSuggestedReply)

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'lead' })
export class Lead extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  userId: string

  @Prop({ required: true, index: true, type: String })
  platform: string

  @Prop({ required: true, index: true, type: String })
  accountId: string

  @Prop({ required: true, index: true, type: String })
  postId: string

  @Prop({ type: String, default: '', index: true })
  commentId: string

  @Prop({ type: String, default: '', index: true })
  parentCommentId: string

  @Prop({ type: String, default: '' })
  userName: string

  @Prop({ required: true, enum: LeadSourceType, default: LeadSourceType.PublicComment, index: true, type: String })
  sourceType: LeadSourceType

  @Prop({ type: String, default: '' })
  userAvatar: string

  @Prop({ type: String, default: '' })
  sourceContent: string

  @Prop({ required: true, enum: LeadStage, default: LeadStage.NewComment, index: true, type: String })
  stage: LeadStage

  @Prop({ required: true, enum: LeadStatus, default: LeadStatus.Pending, index: true, type: String })
  status: LeadStatus

  @Prop({ type: String, default: '', index: true })
  assignee: string

  @Prop({ type: LeadAttributionSchema, default: () => ({}) })
  attribution: LeadAttribution

  @Prop({ type: LeadSuggestedReplySchema, default: () => ({}) })
  suggestedReply: LeadSuggestedReply

  @Prop({ type: String, default: '' })
  lastReplyRecordId: string

  @Prop({ type: Date, default: null, index: true })
  lastFollowUpAt?: Date
}

export const LeadSchema = SchemaFactory.createForClass(Lead)

LeadSchema.index(
  { userId: 1, platform: 1, accountId: 1, postId: 1, commentId: 1, parentCommentId: 1 },
  { unique: true, name: 'uniq_lead_public_comment_identity' },
)
