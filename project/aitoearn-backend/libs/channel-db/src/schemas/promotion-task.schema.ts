import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum PromotionSettlementType {
  Fixed = 'fixed',
  Cpm = 'cpm',
  Cpe = 'cpe',
  Interaction = 'interaction',
}

export enum PromotionTaskStatus {
  Draft = 'draft',
  Published = 'published',
  Paused = 'paused',
  SoldOut = 'sold_out',
  Ended = 'ended',
  Archived = 'archived',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'promotionTask' })
export class PromotionTask extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  advertiserUserId: string

  @Prop({ required: true, type: String })
  title: string

  @Prop({ default: '', type: String })
  description: string

  @Prop({ required: true, index: true, type: String })
  platform: string

  @Prop({ type: [String], default: [] })
  tags: string[]

  @Prop({ required: true, enum: PromotionSettlementType, type: String })
  settlementType: PromotionSettlementType

  @Prop({ default: 0, type: Number })
  rewardAmount: number

  @Prop({ default: 0, type: Number })
  cpmRewardPerThousand: number

  @Prop({ default: 0, type: Number })
  cpeRewardPerThousand: number

  @Prop({ default: 0, type: Number })
  capAmount: number

  @Prop({ default: 0, type: Number })
  followerLimit: number

  @Prop({ default: 0, type: Number })
  quotaTotal: number

  @Prop({ default: 0, type: Number })
  quotaAccepted: number

  @Prop({ type: Date })
  startsAt?: Date

  @Prop({ type: Date })
  endsAt?: Date

  @Prop({ default: false, type: Boolean })
  oneClickPostEnabled: boolean

  @Prop({ type: String })
  materialGroupId?: string

  @Prop({
    required: true,
    enum: PromotionTaskStatus,
    default: PromotionTaskStatus.Draft,
    index: true,
    type: String,
  })
  status: PromotionTaskStatus

  @Prop({ default: false, type: Boolean })
  pinned: boolean

  @Prop({ default: null, type: Number })
  aiScore?: number
}

export const PromotionTaskSchema = SchemaFactory.createForClass(PromotionTask)
