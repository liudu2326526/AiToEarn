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

  async getByName(name: string) {
    return await this.hookTemplateModel.findOne({ name }).lean({ virtuals: true }).exec()
  }

  async listEnabledForSelection(query: {
    platform: string
    accountId?: string
    category?: string
  }) {
    return await this.hookTemplateModel.find({
      enabled: true,
      $and: [
        { $or: [{ applicablePlatforms: { $size: 0 } }, { applicablePlatforms: query.platform }] },
        { $or: [{ applicableAccountIds: { $size: 0 } }, { applicableAccountIds: query.accountId || '' }] },
        { $or: [{ applicableCategories: { $size: 0 } }, { applicableCategories: query.category || '' }] },
      ],
    }).lean({ virtuals: true }).exec()
  }

  async updateEnabledById(id: string, enabled: boolean) {
    return await this.updateOne({ _id: id }, { $set: { enabled } })
  }
}
