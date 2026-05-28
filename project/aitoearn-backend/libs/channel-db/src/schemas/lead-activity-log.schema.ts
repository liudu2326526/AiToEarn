import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum LeadActivityAction {
  Assigned = 'assigned',
  Claimed = 'claimed',
  Transferred = 'transferred',
  StageChanged = 'stage_changed',
  NoteAdded = 'note_added',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'lead_activity_log' })
export class LeadActivityLog extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  leadId: string

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
