import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum PromotionApplicationStatus {
  Accepted = 'accepted',
  Submitted = 'submitted',
  Reviewing = 'reviewing',
  Approved = 'approved',
  Rejected = 'rejected',
  Settled = 'settled',
  Canceled = 'canceled',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'promotionApplication' })
export class PromotionApplication extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  taskId: string

  @Prop({ required: true, index: true, type: String })
  creatorUserId: string

  @Prop({ required: true, type: String })
  accountId: string

  @Prop({ required: true, type: String })
  platform: string

  @Prop({
    required: true,
    enum: PromotionApplicationStatus,
    default: PromotionApplicationStatus.Accepted,
    type: String,
  })
  status: PromotionApplicationStatus

  @Prop({ default: '', type: String })
  workLink: string

  @Prop({ type: String })
  publishRecordId?: string

  @Prop({ type: Date })
  submittedAt?: Date

  @Prop({ type: Date })
  reviewedAt?: Date

  @Prop({ default: '', type: String })
  reviewReason: string
}

export const PromotionApplicationSchema = SchemaFactory.createForClass(PromotionApplication)
