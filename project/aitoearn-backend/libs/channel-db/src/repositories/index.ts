import { AccountOpsConfigRepository } from './account-ops-config.repository'
import { CommentSnapshotRepository } from './comment-snapshot.repository'
import { EngagementSubTaskRepository } from './engagement-sub-task.repository'
import { EngagementTaskRepository } from './engagement-task.repository'
import { HookTemplateRepository } from './hook-template.repository'
import { InteractionRecordRepository } from './interaction-record.repository'
import { LeadActivityLogRepository } from './lead-activity-log.repository'
import { LeadReplyTaskRepository } from './lead-reply-task.repository'
import { LeadRepository } from './lead.repository'
import { OAuth2CredentialRepository } from './oauth2-credential.repository'
import { PostMediaContainerRepository } from './post-media-container.repository'
import { PostSnapshotRepository } from './post-snapshot.repository'
import { PromotionApplicationRepository } from './promotion-application.repository'
import { PromotionLedgerRepository } from './promotion-ledger.repository'
import { PromotionTaskRepository } from './promotion-task.repository'
import { ReplyCommentRecordRepository } from './reply-comment-record.repository'
import { ScriptTemplateRepository } from './script-template.repository'
import { AcquisitionContentRepository } from './acquisition-content.repository'
import { MonitoredPostRepository } from './monitored-post.repository'
import { MonitoredPostFetchLogRepository } from './monitored-post-fetch-log.repository'

export * from './base.repository'
export * from './account-ops-config.repository'
export * from './comment-snapshot.repository'
export * from './engagement-sub-task.repository'
export * from './engagement-task.repository'
export * from './hook-template.repository'
export * from './interaction-record.repository'
export * from './lead-activity-log.repository'
export * from './lead-reply-task.repository'
export * from './lead.repository'
export * from './oauth2-credential.repository'
export * from './post-media-container.repository'
export * from './post-snapshot.repository'
export * from './promotion-application.repository'
export * from './promotion-ledger.repository'
export * from './promotion-task.repository'
export * from './reply-comment-record.repository'
export * from './script-template.repository'
export * from './acquisition-content.repository'
export * from './monitored-post.repository'
export * from './monitored-post-fetch-log.repository'

export const repositories = [
  PostMediaContainerRepository,
  EngagementTaskRepository,
  EngagementSubTaskRepository,
  InteractionRecordRepository,
  ReplyCommentRecordRepository,
  OAuth2CredentialRepository,
  PromotionTaskRepository,
  PromotionApplicationRepository,
  PromotionLedgerRepository,
  AccountOpsConfigRepository,
  CommentSnapshotRepository,
  HookTemplateRepository,
  LeadRepository,
  LeadActivityLogRepository,
  LeadReplyTaskRepository,
  PostSnapshotRepository,
  ScriptTemplateRepository,
  AcquisitionContentRepository,
  MonitoredPostRepository,
  MonitoredPostFetchLogRepository,
] as const
