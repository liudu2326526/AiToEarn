import { AcquisitionCapabilityStatus } from '../acquisition.constants'
import { AcquisitionFetchRequest, AcquisitionFetchResult } from '../acquisition.types'

export interface AcquisitionProvider {
  fetchWorkAndComments(request: AcquisitionFetchRequest): Promise<AcquisitionFetchResult>
  getCapabilityStatus(accountId: string): Promise<{
    status: AcquisitionCapabilityStatus
    reason: string
    meta?: Record<string, unknown>
  }>
}
