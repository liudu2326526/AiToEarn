import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export type MonitoredPostSource = 'manual' | 'published_backfill' | 'demo_seed'
export type MonitoredPostStatus = 'active' | 'published' | 'paused' | 'failed' | 'archived'
export type MonitoredPostFetchStatus = 'idle' | 'fetching' | 'ready' | 'failed' | 'permission_required' | 'not_configured' | 'pending_confirmation' | 'reviewing'

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'monitored_post' })
export class MonitoredPost extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  userId: string

  @Prop({ required: true, index: true, type: String })
  platform: string

  @Prop({ required: true, index: true, type: String })
  accountId: string

  @Prop({ required: true, index: true, type: String })
  postId: string

  @Prop({ required: true, type: String })
  postUrl: string

  @Prop({ type: String, default: '' })
  title: string

  @Prop({ type: String, default: '' })
  cover: string

  @Prop({ required: true, index: true, type: String })
  source: MonitoredPostSource

  @Prop({ required: true, index: true, type: String, default: 'active' })
  monitorStatus: MonitoredPostStatus

  @Prop({ required: true, index: true, type: String, default: 'idle' })
  fetchStatus: MonitoredPostFetchStatus

  @Prop({ type: String, default: '' })
  capabilityReason: string

  @Prop({ type: String, default: '' })
  authorUserId: string

  @Prop({ type: String, default: '' })
  xsecToken: string

  @Prop({ type: String, default: '' })
  xsecSource: string

  @Prop({ type: Date, default: null })
  xsecTokenUpdatedAt?: Date

  @Prop({ type: String, default: '' })
  latestPostSnapshotId: string

  @Prop({ type: Date, default: null, index: true })
  lastFetchedAt?: Date

  @Prop({ type: Date, default: null, index: true })
  nextFetchAt?: Date

  @Prop({ type: Object, default: {} })
  latestMetrics: Record<string, number>

  @Prop({ type: Number, default: 0 })
  latestCommentCount: number

  @Prop({ type: String, default: '' })
  lastFetchBatch: string

  @Prop({ type: String, default: '', index: true })
  publishRecordId: string

  @Prop({ type: String, default: '', index: true })
  publishTraceId: string

  @Prop({ type: String, default: '' })
  linkStatus: string

  @Prop({ type: String, default: '' })
  linkError: string
}

export const MonitoredPostSchema = SchemaFactory.createForClass(MonitoredPost)
MonitoredPostSchema.index({ userId: 1, platform: 1, accountId: 1, postId: 1 }, { unique: true })
