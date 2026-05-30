import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum ScriptTemplateScene {
  CommentAskPrice = 'comment_ask_price',
  CommentAskLink = 'comment_ask_link',
  CommentAskSize = 'comment_ask_size',
  CommentPraise = 'comment_praise',
  CommentPriceObjection = 'comment_price_objection',
  CommentNegative = 'comment_negative',
  PrivateMessageFirst = 'private_message_first',
  PrivateMessageValue = 'private_message_value',
  PrivateMessageWechatGuide = 'private_message_wechat_guide',
}

export enum ScriptTemplateRiskLevel {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

@Schema({ _id: false })
export class ScriptPlatformConstraints {
  @Prop({ type: Boolean, default: false })
  allowWechatId: boolean

  @Prop({ type: Boolean, default: true })
  requireManualConfirm: boolean

  @Prop({ type: [String], default: [] })
  blockedPlatforms: string[]
}

const ScriptPlatformConstraintsSchema = SchemaFactory.createForClass(ScriptPlatformConstraints)

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'script_template' })
export class ScriptTemplate extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  userId: string

  @Prop({ required: true, index: true, type: String })
  name: string

  @Prop({ required: true, enum: ScriptTemplateScene, index: true, type: String })
  scene: ScriptTemplateScene

  @Prop({ required: true, type: String })
  content: string

  @Prop({ type: [String], default: [] })
  variables: string[]

  @Prop({ type: Boolean, default: true, index: true })
  enabled: boolean

  @Prop({ type: [String], default: [] })
  applicableCategories: string[]

  @Prop({ required: true, enum: ScriptTemplateRiskLevel, default: ScriptTemplateRiskLevel.Low, index: true, type: String })
  riskLevel: ScriptTemplateRiskLevel

  @Prop({ type: ScriptPlatformConstraintsSchema, default: () => ({}) })
  platformConstraints: ScriptPlatformConstraints
}

export const ScriptTemplateSchema = SchemaFactory.createForClass(ScriptTemplate)

ScriptTemplateSchema.index({ userId: 1, name: 1 }, { unique: true, name: 'uniq_script_template_user_name' })
ScriptTemplateSchema.index({ userId: 1, enabled: 1, scene: 1 }, { name: 'idx_script_template_scene_selection' })
