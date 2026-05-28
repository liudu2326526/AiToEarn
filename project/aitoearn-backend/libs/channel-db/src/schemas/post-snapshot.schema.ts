import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

@Schema({ _id: false })
export class PostSnapshotMetrics {
  @Prop({ type: Object, default: {} })
  raw: Record<string, unknown>

  @Prop({ type: Object, default: {} })
  normalized: Record<string, number>
}

const PostSnapshotMetricsSchema = SchemaFactory.createForClass(PostSnapshotMetrics)

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'post_snapshot' })
export class PostSnapshot extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  platform: string

  @Prop({ required: true, index: true, type: String })
  accountId: string

  @Prop({ required: true, index: true, type: String })
  postId: string

  @Prop({ required: true, index: true, type: String })
  fetchDate: string

  @Prop({ type: String, default: '' })
  postUrl: string

  @Prop({ type: String, default: '' })
  title: string

  @Prop({ type: String, default: '' })
  cover: string

  @Prop({ type: PostSnapshotMetricsSchema, default: () => ({}) })
  metrics: PostSnapshotMetrics

  @Prop({ type: Date, required: true, index: true })
  fetchedAt: Date

  @Prop({ required: true, index: true, type: String })
  dataSource: string
}

export const PostSnapshotSchema = SchemaFactory.createForClass(PostSnapshot)
