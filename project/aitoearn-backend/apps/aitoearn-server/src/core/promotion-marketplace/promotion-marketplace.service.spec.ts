import { BadRequestException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { PromotionMarketplaceService } from './promotion-marketplace.service'

enum PromotionSettlementType {
  Fixed = 'fixed',
  Cpm = 'cpm',
  Cpe = 'cpe',
  Interaction = 'interaction',
}

enum PromotionTaskStatus {
  Draft = 'draft',
  Published = 'published',
  Paused = 'paused',
  SoldOut = 'sold_out',
  Ended = 'ended',
  Archived = 'archived',
}

enum PromotionApplicationStatus {
  Accepted = 'accepted',
  Submitted = 'submitted',
  Reviewing = 'reviewing',
  Approved = 'approved',
  Rejected = 'rejected',
  Settled = 'settled',
  Canceled = 'canceled',
}

enum PromotionLedgerStatus {
  Pending = 'pending',
  Available = 'available',
  Frozen = 'frozen',
  Refunded = 'refunded',
  Voided = 'voided',
}

vi.mock('@yikart/channel-db', () => ({
  PromotionSettlementType: {
    Fixed: 'fixed',
    Cpm: 'cpm',
    Cpe: 'cpe',
    Interaction: 'interaction',
  },
  PromotionTaskStatus: {
    Draft: 'draft',
    Published: 'published',
    Paused: 'paused',
    SoldOut: 'sold_out',
    Ended: 'ended',
    Archived: 'archived',
  },
  PromotionApplicationStatus: {
    Accepted: 'accepted',
    Submitted: 'submitted',
    Reviewing: 'reviewing',
    Approved: 'approved',
    Rejected: 'rejected',
    Settled: 'settled',
    Canceled: 'canceled',
  },
  PromotionLedgerStatus: {
    Pending: 'pending',
    Available: 'available',
    Frozen: 'frozen',
    Refunded: 'refunded',
    Voided: 'voided',
  },
  PromotionLedgerRole: {
    Creator: 'creator',
    Advertiser: 'advertiser',
  },
  PromotionLedgerDirection: {
    Credit: 'credit',
    Debit: 'debit',
  },
  PromotionTaskRepository: class PromotionTaskRepository {},
  PromotionApplicationRepository: class PromotionApplicationRepository {},
  PromotionLedgerRepository: class PromotionLedgerRepository {},
}))

function createService() {
  const taskRepository = {
    findVisibleTasks: vi.fn(),
    findTaskById: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    incrementAcceptedCount: vi.fn(),
  }
  const applicationRepository = {
    createApplication: vi.fn(),
    findByTaskCreatorAndAccount: vi.fn(),
    findApplicationById: vi.fn(),
    updateApplication: vi.fn(),
    listCreatorApplications: vi.fn(),
  }
  const ledgerRepository = {
    createLedger: vi.fn(),
    listLedger: vi.fn(),
    sumByUserAndStatus: vi.fn(),
  }

  const service = new PromotionMarketplaceService(
    taskRepository as any,
    applicationRepository as any,
    ledgerRepository as any,
  )

  return { service, taskRepository, applicationRepository, ledgerRepository }
}

describe('PromotionMarketplaceService', () => {
  it('lists only visible published tasks and exposes CPM pricing fields', async () => {
    const { service, taskRepository } = createService()
    taskRepository.findVisibleTasks.mockResolvedValue([
      [{
        id: 'task-1',
        title: 'CPM task',
        status: PromotionTaskStatus.Published,
        settlementType: PromotionSettlementType.Cpm,
        cpmRewardPerThousand: 500,
        quotaTotal: 10,
        quotaAccepted: 2,
      }],
      1,
    ])

    const result = await service.listTasks('creator-1', { page: 1, pageSize: 10 })

    expect(taskRepository.findVisibleTasks).toHaveBeenCalledWith(
      expect.objectContaining({ status: PromotionTaskStatus.Published }),
      1,
      10,
    )
    expect(result.list[0]).toMatchObject({
      id: 'task-1',
      settlementType: PromotionSettlementType.Cpm,
      cpmRewardPerThousand: 500,
      isSoldOut: false,
    })
  })

  it('rejects accepting a sold-out task', async () => {
    const { service, taskRepository, applicationRepository } = createService()
    taskRepository.findTaskById.mockResolvedValue({
      id: 'task-1',
      status: PromotionTaskStatus.Published,
      quotaTotal: 1,
      quotaAccepted: 1,
      platform: 'xhs',
    })

    await expect(service.acceptTask('creator-1', 'task-1', { accountId: 'account-1' }))
      .rejects.toBeInstanceOf(BadRequestException)

    expect(applicationRepository.createApplication).not.toHaveBeenCalled()
  })

  it('returns the existing application when the same account accepts twice', async () => {
    const { service, taskRepository, applicationRepository } = createService()
    const existingApplication = {
      id: 'application-1',
      taskId: 'task-1',
      creatorUserId: 'creator-1',
      accountId: 'account-1',
      status: PromotionApplicationStatus.Accepted,
    }
    taskRepository.findTaskById.mockResolvedValue({
      id: 'task-1',
      status: PromotionTaskStatus.Published,
      quotaTotal: 10,
      quotaAccepted: 1,
      platform: 'xhs',
    })
    applicationRepository.findByTaskCreatorAndAccount.mockResolvedValue(existingApplication)

    const result = await service.acceptTask('creator-1', 'task-1', { accountId: 'account-1' })

    expect(result).toBe(existingApplication)
    expect(taskRepository.incrementAcceptedCount).not.toHaveBeenCalled()
    expect(applicationRepository.createApplication).not.toHaveBeenCalled()
  })

  it('approves a submission and creates an available creator ledger entry', async () => {
    const { service, taskRepository, applicationRepository, ledgerRepository } = createService()
    applicationRepository.findApplicationById.mockResolvedValue({
      id: 'application-1',
      taskId: 'task-1',
      creatorUserId: 'creator-1',
      status: PromotionApplicationStatus.Submitted,
    })
    taskRepository.findTaskById.mockResolvedValue({
      id: 'task-1',
      advertiserUserId: 'advertiser-1',
      rewardAmount: 200,
      settlementType: PromotionSettlementType.Fixed,
    })
    applicationRepository.updateApplication.mockResolvedValue({
      id: 'application-1',
      status: PromotionApplicationStatus.Approved,
    })

    await service.reviewSubmission('advertiser-1', 'application-1', { approved: true })

    expect(applicationRepository.updateApplication).toHaveBeenCalledWith(
      'application-1',
      expect.objectContaining({
        status: PromotionApplicationStatus.Approved,
      }),
    )
    expect(ledgerRepository.createLedger).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'creator-1',
      role: 'creator',
      amount: 200,
      direction: 'credit',
      status: PromotionLedgerStatus.Available,
      type: 'task_reward',
    }))
  })
})
