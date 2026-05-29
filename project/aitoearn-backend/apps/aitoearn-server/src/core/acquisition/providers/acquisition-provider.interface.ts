import { AcquisitionCapabilityStatus } from '../acquisition.constants'
import { AcquisitionFetchRequest, AcquisitionFetchResult } from '../acquisition.types'

export interface AcquisitionProvider {
  fetchWorkAndComments(request: AcquisitionFetchRequest): Promise<AcquisitionFetchResult>
  getCapabilityStatus(accountId: string): Promise<{
    status: AcquisitionCapabilityStatus
    reason: string
    meta?: Record<string, unknown>
  }>
  /** 回作者主页刷新各作品的访问令牌(可选，仅需要 token 的平台实现) */
  refreshTokens?(authorUserId: string): Promise<Array<{ postId: string, xsecToken: string }>>
}
