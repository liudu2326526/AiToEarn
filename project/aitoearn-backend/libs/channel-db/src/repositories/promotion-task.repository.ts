import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { FilterQuery, Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { PromotionTask } from '../schemas'
import { BaseRepository, LeanDoc } from './base.repository'

@Injectable()
export class PromotionTaskRepository extends BaseRepository<PromotionTask> {
  constructor(
    @InjectModel(PromotionTask.name, DB_CONNECTION_NAME) private promotionTaskModel: Model<PromotionTask>,
  ) {
    super(promotionTaskModel)
  }

  async createTask(data: Partial<PromotionTask>): Promise<LeanDoc<PromotionTask>> {
    return this.create(data)
  }

  async findTaskById(taskId: string): Promise<LeanDoc<PromotionTask> | null> {
    return this.getById(taskId)
  }

  async updateTask(taskId: string, data: Partial<PromotionTask>): Promise<LeanDoc<PromotionTask> | null> {
    return this.updateById(taskId, data)
  }

  async incrementAcceptedCount(taskId: string, count = 1): Promise<LeanDoc<PromotionTask> | null> {
    return this.updateById(taskId, { $inc: { quotaAccepted: count } })
  }

  async findVisibleTasks(
    filter: FilterQuery<PromotionTask>,
    page = 1,
    pageSize = 20,
  ): Promise<readonly [LeanDoc<PromotionTask>[], number]> {
    return this.findWithPagination({
      page,
      pageSize,
      filter,
      options: { sort: { pinned: -1, aiScore: -1, createdAt: -1 } },
    })
  }

  async listAdvertiserTasks(
    advertiserUserId: string,
    page = 1,
    pageSize = 20,
  ): Promise<readonly [LeanDoc<PromotionTask>[], number]> {
    return this.findWithPagination({
      page,
      pageSize,
      filter: { advertiserUserId },
      options: { sort: { createdAt: -1 } },
    })
  }
}
