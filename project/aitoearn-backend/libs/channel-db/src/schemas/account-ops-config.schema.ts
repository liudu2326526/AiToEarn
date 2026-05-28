import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { DEFAULT_SCHEMA_OPTIONS } from '../channel-db.constants'
import { BaseTemp } from './time.tamp'

@Schema({ ...DEFAULT_SCHEMA_OPTIONS, collection: 'account_ops_config' })
export class AccountOpsConfig extends BaseTemp {
  id: string

  @Prop({ required: true, unique: true, index: true, type: String })
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

  @Prop({ type: [String], default: [] })
  sensitiveWords: string[]
}

export const AccountOpsConfigSchema = SchemaFactory.createForClass(AccountOpsConfig)
