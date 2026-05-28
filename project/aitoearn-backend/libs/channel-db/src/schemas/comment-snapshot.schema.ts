import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'comment_snapshot' })
export class CommentSnapshot extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  platform: string

  @Prop({ required: true, index: true, type: String })
  accountId: string

  @Prop({ required: true, index: true, type: String })
  postId: string

  @Prop({ required: true, index: true, type: String })
  commentId: string

  @Prop({ type: String, default: '', index: true })
  parentCommentId: string

  @Prop({ type: String, default: '' })
  userName: string

  @Prop({ type: String, default: '' })
  userAvatar: string

  @Prop({ required: true, type: String })
  content: string

  @Prop({ type: Number, default: 0 })
  likeCount: number

  @Prop({ type: String, default: '' })
  ipLocation: string

  @Prop({ type: Date, default: null, index: true })
  commentedAt?: Date

  @Prop({ required: true, index: true, type: String })
  fetchBatch: string

  @Prop({ required: true, index: true, type: String })
  dataSource: string
}

export const CommentSnapshotSchema = SchemaFactory.createForClass(CommentSnapshot)
