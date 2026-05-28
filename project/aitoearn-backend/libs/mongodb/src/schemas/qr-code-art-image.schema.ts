import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { UserType } from '@yikart/common'
import { AiLogStatus } from '../enums'
import { DEFAULT_SCHEMA_OPTIONS } from '../mongodb.constants'
import { WithTimestampSchema } from './timestamp.schema'

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'qrCodeArtImages' })
export class QrCodeArtImage extends WithTimestampSchema {
  id: string

  @Prop({ required: true, index: true, type: String })
  userId: string

  @Prop({ required: true, enum: UserType, type: String })
  userType: UserType

  @Prop({ required: true, index: true, type: String })
  relId: string

  @Prop({ required: true, type: String })
  relType: string

  @Prop({ required: true, index: true, type: String })
  logId: string

  @Prop({ required: true, type: String })
  content: string

  @Prop({ required: false, type: String })
  referenceImageUrl?: string

  @Prop({ required: true, type: String })
  prompt: string

  @Prop({ required: true, type: String })
  model: string

  @Prop({ required: false, type: String })
  size?: string

  @Prop({ required: true, enum: AiLogStatus, default: AiLogStatus.Generating, type: Number })
  status: AiLogStatus

  @Prop({ required: false, type: String })
  imageUrl?: string
}

export const QrCodeArtImageSchema = SchemaFactory.createForClass(QrCodeArtImage)

QrCodeArtImageSchema.index({ userId: 1, relId: 1, relType: 1 })
QrCodeArtImageSchema.index({ relId: 1, relType: 1, createdAt: -1 })
