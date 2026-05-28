import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { UserType } from '@yikart/common'
import { PortraitAssetStatus } from '../enums/portrait-asset.enum'
import { DEFAULT_SCHEMA_OPTIONS } from '../mongodb.constants'
import { WithTimestampSchema } from './timestamp.schema'

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'portrait_assets' })
export class PortraitAsset extends WithTimestampSchema {
  id: string

  @Prop({ required: true, type: String })
  userId: string

  @Prop({
    required: true,
    enum: UserType,
    default: UserType.User,
    type: String,
  })
  userType: UserType

  @Prop({ type: String })
  sourceAssetId?: string

  @Prop({ required: true, type: String })
  sourceUrl: string

  @Prop({ type: String })
  filename?: string

  @Prop({ type: String })
  mimeType?: string

  @Prop({ type: Number })
  size?: number

  @Prop({ type: Number })
  width?: number

  @Prop({ type: Number })
  height?: number

  @Prop({ type: String })
  projectName?: string

  @Prop({ type: String })
  volcAssetGroupId?: string

  @Prop({ type: String })
  volcAssetId?: string

  @Prop({ type: String })
  assetUri?: string

  @Prop({
    required: true,
    enum: PortraitAssetStatus,
    default: PortraitAssetStatus.Pending,
    type: String,
  })
  status: PortraitAssetStatus

  @Prop({ type: String })
  failureReason?: string

  @Prop({ type: Object })
  rawResponse?: Record<string, any>

  @Prop({ type: Date })
  deletedAt?: Date
}

export const PortraitAssetSchema = SchemaFactory.createForClass(PortraitAsset)

PortraitAssetSchema.index({ userId: 1, userType: 1, status: 1, createdAt: -1 })
PortraitAssetSchema.index({ userId: 1, userType: 1, volcAssetGroupId: 1 })
PortraitAssetSchema.index({ volcAssetId: 1 }, { sparse: true })
PortraitAssetSchema.index({ assetUri: 1 }, { sparse: true })
PortraitAssetSchema.index({ deletedAt: 1, createdAt: -1 })
