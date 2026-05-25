import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { PromotionApplication } from '../schemas'
import { BaseRepository, LeanDoc } from './base.repository'

@Injectable()
export class PromotionApplicationRepository extends BaseRepository<PromotionApplication> {
  constructor(
    @InjectModel(PromotionApplication.name, DB_CONNECTION_NAME) private promotionApplicationModel: Model<PromotionApplication>,
  ) {
    super(promotionApplicationModel)
  }

  async createApplication(data: Partial<PromotionApplication>): Promise<LeanDoc<PromotionApplication>> {
    return this.create(data)
  }

  async findApplicationById(applicationId: string): Promise<LeanDoc<PromotionApplication> | null> {
    return this.getById(applicationId)
  }

  async findByTaskCreatorAndAccount(
    taskId: string,
    creatorUserId: string,
    accountId?: string,
  ): Promise<LeanDoc<PromotionApplication> | null> {
    const filter: Partial<PromotionApplication> = { taskId, creatorUserId }
    if (accountId) {
      filter.accountId = accountId
    }
    return this.findOne(filter)
  }

  async updateApplication(
    applicationId: string,
    data: Partial<PromotionApplication>,
  ): Promise<LeanDoc<PromotionApplication> | null> {
    return this.updateById(applicationId, data)
  }

  async listCreatorApplications(
    creatorUserId: string,
    page = 1,
    pageSize = 20,
  ): Promise<readonly [LeanDoc<PromotionApplication>[], number]> {
    return this.findWithPagination({
      page,
      pageSize,
      filter: { creatorUserId },
      options: { sort: { createdAt: -1 } },
    })
  }
}
