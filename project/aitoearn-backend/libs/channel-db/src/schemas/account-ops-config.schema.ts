import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

export enum CommentFetchCapabilityStatus {
  NotConfigured = 'not_configured',
  PendingAuthorization = 'pending_authorization',
  PermissionRequired = 'permission_required',
  Ready = 'ready',
  Failed = 'failed',
  ManualRequired = 'manual_required',
  PendingConfirmation = 'pending_confirmation',
}

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'account_ops_config' })
export class AccountOpsConfig extends BaseTemp {
  id: string

  @Prop({ required: true, index: true, type: String })
  userId: string

  @Prop({ required: true, index: true, type: String })
  accountId: string

  @Prop({ type: Number, default: 10 })
  dailyPublishLimit: number

  @Prop({ type: Number, default: 50 })
  dailyInteractionLimit: number

  @Prop({ type: Number, default: 20 })
  dailyCommentFetchLimit: number

  @Prop({ type: String, default: '' })
  defaultWechatId: string

  @Prop({ type: String, default: '' })
  defaultScriptStrategy: string

  @Prop({ type: Boolean, default: true })
  enableAutoGenerate: boolean

  @Prop({ type: Boolean, default: true })
  enableCommentFetch: boolean

  @Prop({ type: Number, default: 10 })
  dailyWechatGuideLimit: number

  @Prop({ type: [String], default: [] })
  enabledScriptSceneIds: string[]

  @Prop({ type: [String], default: [] })
  preferredHookTemplateIds: string[]

  @Prop({ type: String, default: 'friendly' })
  replyTone: 'friendly' | 'professional' | 'promotion' | 'restrained'

  @Prop({ type: Boolean, default: true })
  blockPublicContactInfo: boolean

  @Prop({ type: [String], default: [] })
  sensitiveWords: string[]

  @Prop({
    required: true,
    enum: CommentFetchCapabilityStatus,
    default: CommentFetchCapabilityStatus.NotConfigured,
    index: true,
    type: String,
  })
  commentFetchStatus: CommentFetchCapabilityStatus

  @Prop({ type: String, default: '' })
  commentFetchStatusReason: string

  @Prop({ type: Date, default: null })
  commentFetchCheckedAt?: Date

  @Prop({ type: Object, default: {} })
  commentFetchMeta: Record<string, unknown>
}

export const AccountOpsConfigSchema = SchemaFactory.createForClass(AccountOpsConfig)

AccountOpsConfigSchema.index(
  { userId: 1, accountId: 1 },
  { unique: true, name: 'uniq_account_ops_config_user_account' },
)
