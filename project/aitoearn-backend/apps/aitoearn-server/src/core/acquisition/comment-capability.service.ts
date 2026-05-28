import { Injectable } from '@nestjs/common'
import { AccountOpsConfigRepository, CommentFetchCapabilityStatus } from '@yikart/channel-db'
import { AcquisitionCapabilityStatus, AcquisitionPlatform } from './acquisition.constants'

@Injectable()
export class CommentCapabilityService {
  constructor(private readonly accountOpsConfigRepository: AccountOpsConfigRepository) {}

  async save(
    accountId: string,
    status: AcquisitionCapabilityStatus,
    reason = '',
    meta: Record<string, unknown> = {},
  ) {
    const mapped = this.mapStatus(status)
    return await this.accountOpsConfigRepository.updateCommentCapability(accountId, mapped, reason, meta)
  }

  getDefaultStatus(platform: AcquisitionPlatform) {
    if (platform === AcquisitionPlatform.Kwai) {
      return {
        status: AcquisitionCapabilityStatus.PendingConfirmation,
        reason: 'Kwai comment API permission is not confirmed for Phase 1',
      }
    }
    return {
      status: AcquisitionCapabilityStatus.NotConfigured,
      reason: 'comment capability has not been checked',
    }
  }

  private mapStatus(status: AcquisitionCapabilityStatus): CommentFetchCapabilityStatus {
    const map: Record<AcquisitionCapabilityStatus, CommentFetchCapabilityStatus> = {
      [AcquisitionCapabilityStatus.NotConfigured]: CommentFetchCapabilityStatus.NotConfigured,
      [AcquisitionCapabilityStatus.PendingAuthorization]: CommentFetchCapabilityStatus.PendingAuthorization,
      [AcquisitionCapabilityStatus.PermissionRequired]: CommentFetchCapabilityStatus.PermissionRequired,
      [AcquisitionCapabilityStatus.Ready]: CommentFetchCapabilityStatus.Ready,
      [AcquisitionCapabilityStatus.Failed]: CommentFetchCapabilityStatus.Failed,
      [AcquisitionCapabilityStatus.ManualRequired]: CommentFetchCapabilityStatus.ManualRequired,
      [AcquisitionCapabilityStatus.PendingConfirmation]: CommentFetchCapabilityStatus.PendingConfirmation,
    }
    return map[status]
  }
}
