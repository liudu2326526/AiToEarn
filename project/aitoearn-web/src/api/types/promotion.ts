export type PromotionSettlementType = 'fixed' | 'cpm' | 'cpe' | 'interaction'
export type PromotionTaskStatus = 'draft' | 'published' | 'paused' | 'sold_out' | 'ended' | 'archived'
export type PromotionApplicationStatus = 'accepted' | 'submitted' | 'reviewing' | 'approved' | 'rejected' | 'settled' | 'canceled'
export type PromotionLedgerStatus = 'pending' | 'available' | 'frozen' | 'refunded' | 'voided'

export interface PromotionTask {
  id: string
  title: string
  description?: string
  platform: string
  tags?: string[]
  settlementType: PromotionSettlementType
  rewardAmount?: number
  cpmRewardPerThousand?: number
  cpeRewardPerThousand?: number
  capAmount?: number
  followerLimit?: number
  quotaTotal?: number
  quotaAccepted?: number
  startsAt?: string
  endsAt?: string
  oneClickPostEnabled?: boolean
  materialGroupId?: string
  status: PromotionTaskStatus
  pinned?: boolean
  aiScore?: number
  isSoldOut?: boolean
}

export interface PromotionTaskListParams {
  page?: number
  pageSize?: number
  keyword?: string
  platform?: string
  settlementType?: PromotionSettlementType
  tag?: string
}

export interface PromotionTaskListResponse {
  list: PromotionTask[]
  total: number
  page: number
  pageSize: number
}

export interface PromotionApplication {
  id: string
  taskId: string
  creatorUserId: string
  accountId?: string
  platform: string
  status: PromotionApplicationStatus
  workLink?: string
  publishRecordId?: string
  submittedAt?: string
  reviewedAt?: string
  reviewReason?: string
}

export interface PromotionGoldSummary {
  available: number
  pending: number
}

export interface PromotionLedgerItem {
  id: string
  userId: string
  taskId?: string
  applicationId?: string
  amount: number
  direction: 'credit' | 'debit'
  status: PromotionLedgerStatus
  type: string
  createdAt?: string
}
