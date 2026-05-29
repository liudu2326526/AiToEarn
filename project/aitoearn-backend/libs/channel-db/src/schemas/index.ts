import { Account, AccountSchema } from './account.schema'
import { AccountOpsConfig, AccountOpsConfigSchema } from './account-ops-config.schema'
import { CommentSnapshot, CommentSnapshotSchema } from './comment-snapshot.schema'
import { EngagementSubTask, EngagementSubTaskSchema, EngagementTask, EngagementTaskSchema } from './engagement-task.schema'
import { HookTemplate, HookTemplateSchema } from './hook-template.schema'
import { InteractionRecord, InteractionRecordSchema } from './interaction-record.schema'
import { LeadActivityLog, LeadActivityLogSchema } from './lead-activity-log.schema'
import { Lead, LeadSchema } from './lead.schema'
import { OAuth2Credential, OAuth2CredentialSchema } from './oauth2-credential.schema'
import { PostMediaContainer, PostMediaContainerSchema } from './post-media-container.schema'
import { PostSnapshot, PostSnapshotSchema } from './post-snapshot.schema'
import { PromotionApplication, PromotionApplicationSchema } from './promotion-application.schema'
import { PromotionLedger, PromotionLedgerSchema } from './promotion-ledger.schema'
import { PromotionTask, PromotionTaskSchema } from './promotion-task.schema'
import { ReplyCommentRecord, ReplyCommentRecordSchema } from './reply-comment-record.schema'
import { ScriptTemplate, ScriptTemplateSchema } from './script-template.schema'
import { AcquisitionContent, AcquisitionContentSchema } from './acquisition-content.schema'
import { MonitoredPost, MonitoredPostSchema } from './monitored-post.schema'
import { MonitoredPostFetchLog, MonitoredPostFetchLogSchema } from './monitored-post-fetch-log.schema'

export * from './account.schema'
export * from './account-ops-config.schema'
export * from './comment-snapshot.schema'
export * from './engagement-task.schema'
export * from './hook-template.schema'
export * from './interaction-record.schema'
export * from './lead-activity-log.schema'
export * from './lead.schema'
export * from './oauth2-credential.schema'
export * from './post-media-container.schema'
export * from './post-snapshot.schema'
export * from './promotion-application.schema'
export * from './promotion-ledger.schema'
export * from './promotion-task.schema'
export * from './reply-comment-record.schema'
export * from './script-template.schema'
export * from './acquisition-content.schema'
export * from './monitored-post.schema'
export * from './monitored-post-fetch-log.schema'

export const schemas = [
  { name: Account.name, schema: AccountSchema },
  { name: EngagementTask.name, schema: EngagementTaskSchema },
  { name: EngagementSubTask.name, schema: EngagementSubTaskSchema },
  { name: InteractionRecord.name, schema: InteractionRecordSchema },
  { name: OAuth2Credential.name, schema: OAuth2CredentialSchema },
  { name: PostMediaContainer.name, schema: PostMediaContainerSchema },
  { name: PromotionApplication.name, schema: PromotionApplicationSchema },
  { name: PromotionLedger.name, schema: PromotionLedgerSchema },
  { name: PromotionTask.name, schema: PromotionTaskSchema },
  { name: ReplyCommentRecord.name, schema: ReplyCommentRecordSchema },
  { name: AccountOpsConfig.name, schema: AccountOpsConfigSchema },
  { name: CommentSnapshot.name, schema: CommentSnapshotSchema },
  { name: HookTemplate.name, schema: HookTemplateSchema },
  { name: Lead.name, schema: LeadSchema },
  { name: LeadActivityLog.name, schema: LeadActivityLogSchema },
  { name: PostSnapshot.name, schema: PostSnapshotSchema },
  { name: ScriptTemplate.name, schema: ScriptTemplateSchema },
  { name: AcquisitionContent.name, schema: AcquisitionContentSchema },
  { name: MonitoredPost.name, schema: MonitoredPostSchema },
  { name: MonitoredPostFetchLog.name, schema: MonitoredPostFetchLogSchema },
] as const
