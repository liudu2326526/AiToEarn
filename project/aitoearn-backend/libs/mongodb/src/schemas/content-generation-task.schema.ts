import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { SchemaTypes } from 'mongoose'
import { ContentGenerationTaskStatus } from '../enums'
import { DEFAULT_SCHEMA_OPTIONS } from '../mongodb.constants'
import { WithTimestampSchema } from './timestamp.schema'

export type TaskAnalysisPriority = 'none' | 'high' | 'medium' | 'low'
export type TaskAnalysisOptimizationPriority = 'high' | 'medium' | 'low'

export interface TaskAnalysisOptimization {
  issue: string
  priority: TaskAnalysisOptimizationPriority
}

export interface TaskAnalysis {
  summary: string
  priority: TaskAnalysisPriority
  optimizations?: TaskAnalysisOptimization[]
  analyzedAt: Date
  model: string
  error?: string
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'contentGenerationTask' })
export class ContentGenerationTask extends WithTimestampSchema {
  id: string

  @Prop({
    required: true,
    type: String,
  })
  userId: string

  @Prop({
    required: false,
    index: true,
    type: String,
  })
  sessionId?: string

  @Prop({
    required: false,
    type: String,
  })
  title?: string

  @Prop({
    required: false,
    default: [],
    type: [SchemaTypes.Mixed],
  })
  messages: Array<Record<string, unknown>>

  @Prop({
    type: Date,
    required: false,
  })
  deletedAt?: Date

  @Prop({
    required: true,
    enum: ContentGenerationTaskStatus,
    default: ContentGenerationTaskStatus.Running,
    type: String,
  })
  status: ContentGenerationTaskStatus

  @Prop({
    required: false,
    min: 1,
    max: 5,
    type: Number,
  })
  rating?: number

  @Prop({
    required: false,
    type: String,
  })
  ratingComment?: string

  @Prop({
    required: false,
    index: true,
    type: String,
  })
  publicShareToken?: string

  @Prop({
    required: false,
    type: Date,
  })
  publicShareExpiresAt?: Date

  @Prop({
    required: false,
    type: [String],
    default: [],
  })
  subAgentIds?: string[]

  @Prop({
    required: false,
    type: [String],
    default: [],
  })
  todos?: string[]

  @Prop({
    type: Date,
    required: false,
  })
  favoritedAt?: Date

  @Prop({
    type: {
      summary: String,
      priority: { type: String, enum: ['none', 'high', 'medium', 'low'] },
      optimizations: [{
        issue: String,
        priority: { type: String, enum: ['high', 'medium', 'low'] },
      }],
      analyzedAt: Date,
      model: String,
      error: String,
    },
    required: false,
  })
  analysis?: TaskAnalysis
}

export const ContentGenerationTaskSchema = SchemaFactory.createForClass(ContentGenerationTask)

ContentGenerationTaskSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 })
ContentGenerationTaskSchema.index({ userId: 1, favoritedAt: -1, deletedAt: 1 })
ContentGenerationTaskSchema.index({ status: 1, deletedAt: 1, updatedAt: 1 })
