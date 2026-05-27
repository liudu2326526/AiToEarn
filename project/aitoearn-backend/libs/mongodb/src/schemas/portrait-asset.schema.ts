import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { UserType } from '@yikart/common'
import { PortraitAssetStatus } from '../enums/portrait-asset.enum'
import { DEFAULT_SCHEMA_OPTIONS } from '../mongodb.constants'
import { WithTimestampSchema } from './timestamp.schema'

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'portrait_assets' })
export class PortraitAsset extends WithTimestampSchema {
  id: string

  @Prop({ required: true })
  userId: string

  @Prop({
    required: true,
    enum: UserType,
    default: UserType.User,
  })
  userType: UserType

  @Prop()
  sourceAssetId?: string

  @Prop({ required: true })
  sourceUrl: string

  @Prop()
  filename?: string

  @Prop()
  mimeType?: string

  @Prop()
  size?: number

  @Prop()
  width?: number

  @Prop()
  height?: number

  @Prop()
  projectName?: string

  @Prop()
  volcAssetGroupId?: string

  @Prop()
  volcAssetId?: string

  @Prop()
  assetUri?: string

  @Prop({
    required: true,
    enum: PortraitAssetStatus,
    default: PortraitAssetStatus.Pending,
  })
  status: PortraitAssetStatus

  @Prop()
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
