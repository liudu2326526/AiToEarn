import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'monitored_post_fetch_log' })
export class MonitoredPostFetchLog extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  userId: string

  @Prop({ required: true, index: true, type: String })
  monitoredPostId: string

  @Prop({ required: true, index: true, type: String })
  accountId: string

  @Prop({ required: true, index: true, type: String })
  platform: string

  @Prop({ required: true, index: true, type: String })
  fetchStatus: string

  @Prop({ type: String, default: '' })
  fetchBatch: string

  @Prop({ type: String, default: '' })
  reason: string

  @Prop({ required: true, index: true, type: Date })
  fetchedAt: Date
}

export const MonitoredPostFetchLogSchema = SchemaFactory.createForClass(MonitoredPostFetchLog)
MonitoredPostFetchLogSchema.index({ userId: 1, accountId: 1, fetchedAt: -1 })
