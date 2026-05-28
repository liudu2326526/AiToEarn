import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum HookTemplateCategory {
  FollowGuide = 'follow_guide',
  PrivateMessageGuide = 'private_message_guide',
  ProfileGuide = 'profile_guide',
  BenefitGuide = 'benefit_guide',
  StockUrgency = 'stock_urgency',
  SizeConsulting = 'size_consulting',
  WechatGuide = 'wechat_guide',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'hook_template' })
export class HookTemplate extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  name: string

  @Prop({ required: true, enum: HookTemplateCategory, index: true })
  category: HookTemplateCategory

  @Prop({ required: true, type: String })
  content: string

  @Prop({ type: Number, default: 1 })
  weight: number

  @Prop({ type: Boolean, default: true, index: true })
  enabled: boolean

  @Prop({ type: [String], default: [] })
  applicablePlatforms: string[]

  @Prop({ type: [String], default: [] })
  applicableCategories: string[]

  @Prop({ type: [String], default: [] })
  applicableAccountIds: string[]
}

export const HookTemplateSchema = SchemaFactory.createForClass(HookTemplate)
