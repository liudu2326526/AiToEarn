import { EngagementSubTaskRepository } from './engagement-sub-task.repository'
import { EngagementTaskRepository } from './engagement-task.repository'
import { InteractionRecordRepository } from './interaction-record.repository'
import { OAuth2CredentialRepository } from './oauth2-credential.repository'
import { PostMediaContainerRepository } from './post-media-container.repository'
import { PromotionApplicationRepository } from './promotion-application.repository'
import { PromotionLedgerRepository } from './promotion-ledger.repository'
import { PromotionTaskRepository } from './promotion-task.repository'
import { ReplyCommentRecordRepository } from './reply-comment-record.repository'

export * from './base.repository'
export * from './engagement-sub-task.repository'
export * from './engagement-task.repository'
export * from './interaction-record.repository'
export * from './oauth2-credential.repository'
export * from './post-media-container.repository'
export * from './promotion-application.repository'
export * from './promotion-ledger.repository'
export * from './promotion-task.repository'
export * from './reply-comment-record.repository'

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
] as const
