import type { AcquisitionPlatform } from './acquisitionContent'

export type HookTemplateCategory =
  | 'follow_guide'
  | 'private_message_guide'
  | 'profile_guide'
  | 'benefit_guide'
  | 'stock_urgency'
  | 'size_consulting'
  | 'wechat_guide'

export type ScriptTemplateScene =
  | 'friendly'
  | 'professional'
  | 'promotion'
  | 'restrained'
  | 'reply_style_classifier'
  | 'comment_ask_price'
  | 'comment_ask_link'
  | 'comment_ask_size'
  | 'comment_praise'
  | 'comment_price_objection'
  | 'comment_negative'
  | 'private_message_first'
  | 'private_message_value'
  | 'private_message_wechat_guide'

export type ScriptTemplateRiskLevel = 'low' | 'medium' | 'high'

export type ReplyTone = 'friendly' | 'professional' | 'promotion' | 'restrained'

export interface HookTemplate {
  id: string
  userId: string
  name: string
  category: HookTemplateCategory
  content: string
  weight: number
  enabled: boolean
  applicablePlatforms: AcquisitionPlatform[]
  applicableCategories: string[]
  applicableAccountIds: string[]
  createdAt: string
  updatedAt: string
}

export interface ScriptTemplate {
  id: string
  userId: string
  name: string
  scene: ScriptTemplateScene
  content: string
  variables: string[]
  enabled: boolean
  applicableCategories: string[]
  riskLevel: ScriptTemplateRiskLevel
  platformConstraints: {
    allowWechatId: boolean
    requireManualConfirm: boolean
    blockedPlatforms: AcquisitionPlatform[]
  }
  createdAt: string
  updatedAt: string
}

export interface AccountOpsConfig {
  id?: string
  userId?: string
  accountId: string
  dailyPublishLimit: number
  dailyInteractionLimit: number
  dailyCommentFetchLimit: number
  dailyWechatGuideLimit: number
  defaultWechatId: string
  defaultScriptStrategy: string
  replyTone: ReplyTone
  enableAutoGenerate: boolean
  enableCommentFetch: boolean
  blockPublicContactInfo: boolean
  sensitiveWords: string[]
  commentFetchStatus?: string
  commentFetchStatusReason?: string
  commentFetchCheckedAt?: string
}

export interface AccountOpsConfigRow {
  accountId: string
  platform: string
  nickname: string
  avatar: string
  status: string
  config: AccountOpsConfig | null
}

export interface StrategyListResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export type CreateHookTemplatePayload = Pick<
  HookTemplate,
  'name' | 'category' | 'content' | 'weight' | 'enabled' | 'applicablePlatforms' | 'applicableCategories' | 'applicableAccountIds'
>

export type UpdateHookTemplatePayload = Partial<CreateHookTemplatePayload>

export type CreateScriptTemplatePayload = Pick<
  ScriptTemplate,
  'name' | 'scene' | 'content' | 'variables' | 'enabled' | 'applicableCategories' | 'riskLevel' | 'platformConstraints'
>

export type UpdateScriptTemplatePayload = Partial<CreateScriptTemplatePayload>

export type UpsertAccountOpsConfigPayload = Omit<
  AccountOpsConfig,
  'id' | 'userId' | 'accountId' | 'commentFetchStatus' | 'commentFetchStatusReason' | 'commentFetchCheckedAt'
>
