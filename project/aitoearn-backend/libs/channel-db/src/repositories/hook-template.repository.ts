import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { HookTemplate } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class HookTemplateRepository extends BaseRepository<HookTemplate> {
  constructor(
    @InjectModel(HookTemplate.name, DB_CONNECTION_NAME) private hookTemplateModel: Model<HookTemplate>,
  ) {
    super(hookTemplateModel)
  }

  async getByName(userId: string, name: string) {
    return await this.hookTemplateModel.findOne({ userId, name }).lean({ virtuals: true }).exec()
  }

  async listByUser(userId: string, query: {
    category?: string
    enabled?: boolean
    keyword?: string
    page: number
    pageSize: number
  }) {
    const filter: any = { userId }
    if (query.category) filter.category = query.category
    if (typeof query.enabled === 'boolean') filter.enabled = query.enabled
    if (query.keyword) filter.name = { $regex: query.keyword, $options: 'i' }
    return await this.findWithPagination({
      page: query.page,
      pageSize: query.pageSize,
      filter,
      options: { sort: { updatedAt: -1 } },
    })
  }

  async listEnabledForSelection(query: {
    userId: string
    platform: string
    accountId?: string
    category?: string
  }) {
    return await this.hookTemplateModel.find({
      userId: query.userId,
      enabled: true,
      $and: [
        { $or: [{ applicablePlatforms: { $size: 0 } }, { applicablePlatforms: { $in: [query.platform] } }] },
        { $or: [{ applicableAccountIds: { $size: 0 } }, { applicableAccountIds: { $in: query.accountId ? [query.accountId] : [] } }] },
        { $or: [{ applicableCategories: { $size: 0 } }, { applicableCategories: { $in: query.category ? [query.category] : [] } }] },
      ],
    }).lean({ virtuals: true }).exec()
  }

  async getByIdAndUser(id: string, userId: string) {
    return await this.hookTemplateModel.findOne({ _id: id, userId }).lean({ virtuals: true }).exec()
  }

  async updateByIdAndUser(id: string, userId: string, data: Partial<HookTemplate>) {
    return await this.updateOne({ _id: id, userId }, { $set: data })
  }

  async deleteByIdAndUser(id: string, userId: string) {
    return await this.deleteOne({ _id: id, userId })
  }

  async updateEnabledById(id: string, enabled: boolean) {
    return await this.updateOne({ _id: id }, { $set: { enabled } })
  }
}
