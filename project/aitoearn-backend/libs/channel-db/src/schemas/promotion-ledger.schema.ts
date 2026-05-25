import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum PromotionLedgerStatus {
  Pending = 'pending',
  Available = 'available',
  Frozen = 'frozen',
  Refunded = 'refunded',
  Voided = 'voided',
}

export enum PromotionLedgerRole {
  Creator = 'creator',
  Advertiser = 'advertiser',
}

export enum PromotionLedgerDirection {
  Credit = 'credit',
  Debit = 'debit',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'promotionLedger' })
export class PromotionLedger extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  userId: string

  @Prop({ required: true, enum: PromotionLedgerRole, type: String })
  role: PromotionLedgerRole

  @Prop({ required: true, type: String })
  taskId: string

  @Prop({ type: String })
  applicationId?: string

  @Prop({ required: true, type: Number })
  amount: number

  @Prop({ required: true, enum: PromotionLedgerDirection, type: String })
  direction: PromotionLedgerDirection

  @Prop({ required: true, enum: PromotionLedgerStatus, type: String })
  status: PromotionLedgerStatus

  @Prop({ required: true, type: String })
  type: string
}

export const PromotionLedgerSchema = SchemaFactory.createForClass(PromotionLedger)
