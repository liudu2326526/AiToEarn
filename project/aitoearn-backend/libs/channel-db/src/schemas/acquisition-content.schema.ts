import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export const ACQUISITION_PLATFORMS = ['xhs', 'douyin', 'kwai'] as const
export type AcquisitionPlatform = (typeof ACQUISITION_PLATFORMS)[number]

export enum AcquisitionContentStatus {
  Draft = 'draft',
  PendingReview = 'pending_review',
  Approved = 'approved',
  Rejected = 'rejected',
  Scheduled = 'scheduled',
  Published = 'published',
  PublishFailed = 'publish_failed',
  GenerationFailed = 'generation_failed',
}

@Schema({ _id: false })
export class AcquisitionGeneratedHook {
  @Prop({ type: String, default: '' })
  hookTemplateId: string

  @Prop({ type: String, default: '' })
  content: string

  @Prop({ type: String, default: '' })
  category: string
}

export const AcquisitionGeneratedHookSchema = SchemaFactory.createForClass(AcquisitionGeneratedHook)

@Schema({ _id: false })
export class AcquisitionPlatformContent {
  @Prop({ required: true, enum: ACQUISITION_PLATFORMS, index: true, type: String })
  platform: AcquisitionPlatform

  @Prop({ type: String, default: '' })
  accountId: string

  @Prop({ type: String, default: '' })
  title: string

  @Prop({ type: String, default: '' })
  body: string

  @Prop({ type: [String], default: [] })
  topics: string[]

  @Prop({ type: Date, default: null })
  suggestedPublishAt?: Date

  @Prop({ type: AcquisitionGeneratedHookSchema, default: () => ({}) })
  hook: AcquisitionGeneratedHook

  @Prop({ type: String, default: '' })
  strategyNote: string

  @Prop({ type: String, default: '' })
  publishRecordId: string
}

export const AcquisitionPlatformContentSchema = SchemaFactory.createForClass(AcquisitionPlatformContent)

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'acquisition_content' })
export class AcquisitionContent extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  userId: string

  @Prop({ required: true, type: String })
  productName: string

  @Prop({ required: true, index: true, type: String })
  productCategory: string

  @Prop({ type: String, default: '' })
  priceRange: string

  @Prop({ type: String, default: '' })
  sizeRange: string

  @Prop({ type: String, default: '' })
  sellingPoints: string

  @Prop({ type: String, default: '' })
  contentStyle: string

  @Prop({ type: [String], default: [] })
  referenceImageUrls: string[]

  @Prop({ type: [String], default: [] })
  targetPlatforms: AcquisitionPlatform[]

  @Prop({ required: true, enum: AcquisitionContentStatus, default: AcquisitionContentStatus.Draft, index: true, type: String })
  status: AcquisitionContentStatus

  @Prop({ type: [AcquisitionPlatformContentSchema], default: [] })
  platformContents: AcquisitionPlatformContent[]

  @Prop({ type: [String], default: [] })
  draftTaskIds: string[]

  @Prop({ type: String, default: '' })
  generatedByModel: string

  @Prop({ type: String, default: '' })
  failureReason: string

  @Prop({ type: String, default: '' })
  reviewerId: string

  @Prop({ type: String, default: '' })
  reviewNote: string

  @Prop({ type: Date, default: null })
  reviewedAt?: Date

  @Prop({ type: Date, default: null })
  scheduledAt?: Date

  @Prop({ type: Number, default: 0 })
  version: number
}

export const AcquisitionContentSchema = SchemaFactory.createForClass(AcquisitionContent)
AcquisitionContentSchema.index({ userId: 1, status: 1, createdAt: -1 })
AcquisitionContentSchema.index({ userId: 1, productCategory: 1, createdAt: -1 })
