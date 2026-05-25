import { BadRequestException, Injectable } from '@nestjs/common'
import {
  PromotionApplicationRepository,
  PromotionApplicationStatus,
  PromotionLedgerDirection,
  PromotionLedgerRepository,
  PromotionLedgerRole,
  PromotionLedgerStatus,
  PromotionTask,
  PromotionTaskRepository,
  PromotionTaskStatus,
} from '@yikart/channel-db'
import {
  AcceptPromotionTaskDto,
  CreatePromotionTaskDto,
  PromotionTaskListDto,
  ReviewPromotionSubmissionDto,
  SubmitPromotionWorkDto,
  UpdatePromotionTaskDto,
} from './promotion-marketplace.dto'

@Injectable()
export class PromotionMarketplaceService {
  constructor(
    private readonly taskRepository: PromotionTaskRepository,
    private readonly applicationRepository: PromotionApplicationRepository,
    private readonly ledgerRepository: PromotionLedgerRepository,
  ) {}

  async listTasks(_userId: string, dto: PromotionTaskListDto) {
    const filter: Record<string, unknown> = {
      status: PromotionTaskStatus.Published,
    }

    if (dto.platform) {
      filter['platform'] = dto.platform
    }
    if (dto.settlementType) {
      filter['settlementType'] = dto.settlementType
    }
    if (dto.tag) {
      filter['tags'] = dto.tag
    }
    if (dto.keyword) {
      filter['$or'] = [
        { title: { $regex: dto.keyword, $options: 'i' } },
        { description: { $regex: dto.keyword, $options: 'i' } },
      ]
    }

    const [items, total] = await this.taskRepository.findVisibleTasks(filter, dto.page, dto.pageSize)
    return {
      list: items.map(item => this.toTaskItem(item)),
      total,
      page: dto.page,
      pageSize: dto.pageSize,
    }
  }

  async getTaskDetail(taskId: string) {
    const task = await this.taskRepository.findTaskById(taskId)
    if (!task || task.status === PromotionTaskStatus.Archived) {
      throw new BadRequestException('Promotion task does not exist.')
    }
    return this.toTaskItem(task)
  }

  async createAdvertiserTask(userId: string, dto: CreatePromotionTaskDto) {
    return this.taskRepository.createTask({
      ...dto,
      advertiserUserId: userId,
      quotaAccepted: 0,
      status: dto.status ?? PromotionTaskStatus.Draft,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
    })
  }

  async updateAdvertiserTask(userId: string, taskId: string, dto: UpdatePromotionTaskDto) {
    const task = await this.ensureAdvertiserTask(userId, taskId)
    return this.taskRepository.updateTask(task.id, {
      ...dto,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
    })
  }

  async listAdvertiserTasks(userId: string, page = 1, pageSize = 20) {
    const [items, total] = await this.taskRepository.listAdvertiserTasks(userId, page, pageSize)
    return { list: items.map(item => this.toTaskItem(item)), total, page, pageSize }
  }

  async acceptTask(userId: string, taskId: string, dto: AcceptPromotionTaskDto) {
    const task = await this.taskRepository.findTaskById(taskId)
    if (!task || task.status !== PromotionTaskStatus.Published) {
      throw new BadRequestException('Promotion task is not available.')
    }
    if (this.isSoldOut(task)) {
      throw new BadRequestException('Promotion task is sold out.')
    }

    const existing = await this.applicationRepository.findByTaskCreatorAndAccount(taskId, userId, dto.accountId)
    if (existing) {
      return existing
    }

    const application = await this.applicationRepository.createApplication({
      taskId,
      creatorUserId: userId,
      accountId: dto.accountId,
      platform: task.platform,
      status: PromotionApplicationStatus.Accepted,
    })
    await this.taskRepository.incrementAcceptedCount(taskId, 1)
    return application
  }

  async listCreatorApplications(userId: string, page = 1, pageSize = 20) {
    const [items, total] = await this.applicationRepository.listCreatorApplications(userId, page, pageSize)
    return { list: items, total, page, pageSize }
  }

  async submitWork(userId: string, applicationId: string, dto: SubmitPromotionWorkDto) {
    const application = await this.applicationRepository.findApplicationById(applicationId)
    if (!application || application.creatorUserId !== userId) {
      throw new BadRequestException('Promotion application does not exist.')
    }
    return this.applicationRepository.updateApplication(applicationId, {
      workLink: dto.workLink,
      publishRecordId: dto.publishRecordId,
      status: PromotionApplicationStatus.Submitted,
      submittedAt: new Date(),
    })
  }

  async reviewSubmission(userId: string, applicationId: string, dto: ReviewPromotionSubmissionDto) {
    const application = await this.applicationRepository.findApplicationById(applicationId)
    if (!application) {
      throw new BadRequestException('Promotion application does not exist.')
    }

    const task = await this.taskRepository.findTaskById(application.taskId)
    if (!task || task.advertiserUserId !== userId) {
      throw new BadRequestException('Promotion task does not exist.')
    }

    const status = dto.approved ? PromotionApplicationStatus.Approved : PromotionApplicationStatus.Rejected
    const updated = await this.applicationRepository.updateApplication(applicationId, {
      status,
      reviewedAt: new Date(),
      reviewReason: dto.reason,
    })

    if (dto.approved) {
      await this.ledgerRepository.createLedger({
        userId: application.creatorUserId,
        role: PromotionLedgerRole.Creator,
        taskId: task.id,
        applicationId,
        amount: task.rewardAmount ?? task.cpmRewardPerThousand ?? task.cpeRewardPerThousand ?? 0,
        direction: PromotionLedgerDirection.Credit,
        status: PromotionLedgerStatus.Available,
        type: 'task_reward',
      })
    }

    return updated
  }

  async getGoldSummary(userId: string) {
    const available = await this.ledgerRepository.sumByUserAndStatus(userId, PromotionLedgerStatus.Available)
    const pending = await this.ledgerRepository.sumByUserAndStatus(userId, PromotionLedgerStatus.Pending)
    return { available, pending }
  }

  async listLedger(userId: string, page = 1, pageSize = 20) {
    const [items, total] = await this.ledgerRepository.listLedger(userId, page, pageSize)
    return { list: items, total, page, pageSize }
  }

  private async ensureAdvertiserTask(userId: string, taskId: string) {
    const task = await this.taskRepository.findTaskById(taskId)
    if (!task || task.advertiserUserId !== userId) {
      throw new BadRequestException('Promotion task does not exist.')
    }
    return task
  }

  private toTaskItem(task: PromotionTask & { id?: string }) {
    return {
      ...task,
      isSoldOut: this.isSoldOut(task),
    }
  }

  private isSoldOut(task: Pick<PromotionTask, 'quotaTotal' | 'quotaAccepted'>) {
    return Boolean(task.quotaTotal && task.quotaTotal > 0 && task.quotaAccepted >= task.quotaTotal)
  }
}
