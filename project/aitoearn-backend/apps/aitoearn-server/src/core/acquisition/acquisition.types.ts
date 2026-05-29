import { AcquisitionCapabilityStatus, AcquisitionDataSource, AcquisitionPlatform } from './acquisition.constants'

export interface NormalizedPostSnapshot {
  platform: AcquisitionPlatform
  accountId: string
  postId: string
  postUrl: string
  title: string
  cover: string
  metrics: {
    raw: Record<string, unknown>
    normalized: Record<string, number>
  }
  fetchedAt: Date
  fetchDate: string
  dataSource: AcquisitionDataSource
}

export interface NormalizedCommentSnapshot {
  platform: AcquisitionPlatform
  accountId: string
  postId: string
  commentId: string
  parentCommentId: string
  userName: string
  userAvatar: string
  content: string
  likeCount: number
  ipLocation: string
  xsecToken: string
  commentedAt?: Date
  fetchBatch: string
  dataSource: AcquisitionDataSource
}

export interface AcquisitionFetchRequest {
  userId?: string
  accountId: string
  platform: AcquisitionPlatform
  postUrl: string
  postId?: string
  cursor?: string
  fetchBatch?: string
}

export interface AcquisitionFetchResult {
  post?: NormalizedPostSnapshot
  comments: NormalizedCommentSnapshot[]
  cursor: string
  hasMore: boolean
  capabilityStatus: AcquisitionCapabilityStatus
  capabilityReason: string
  fetchBatch: string
}

export interface PersistedAcquisitionFetchResult extends AcquisitionFetchResult {
  postSaved: boolean
  commentsSaved: number
}
