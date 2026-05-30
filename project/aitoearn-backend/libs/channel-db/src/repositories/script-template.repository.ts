import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { ScriptTemplate } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class ScriptTemplateRepository extends BaseRepository<ScriptTemplate> {
  constructor(
    @InjectModel(ScriptTemplate.name, DB_CONNECTION_NAME) private scriptTemplateModel: Model<ScriptTemplate>,
  ) {
    super(scriptTemplateModel)
  }

  async getByName(userId: string, name: string) {
    return await this.scriptTemplateModel.findOne({ userId, name }).lean({ virtuals: true }).exec()
  }

  async listByUser(userId: string, query: {
    scene?: string
    riskLevel?: string
    enabled?: boolean
    keyword?: string
    page: number
    pageSize: number
  }) {
    const filter: any = { userId }
    if (query.scene) filter.scene = query.scene
    if (query.riskLevel) filter.riskLevel = query.riskLevel
    if (typeof query.enabled === 'boolean') filter.enabled = query.enabled
    if (query.keyword) filter.name = { $regex: query.keyword, $options: 'i' }
    return await this.findWithPagination({
      page: query.page,
      pageSize: query.pageSize,
      filter,
      options: { sort: { updatedAt: -1 } },
    })
  }

  async getByIdAndUser(id: string, userId: string) {
    return await this.scriptTemplateModel.findOne({ _id: id, userId }).lean({ virtuals: true }).exec()
  }

  async updateByIdAndUser(id: string, userId: string, data: Partial<ScriptTemplate>) {
    return await this.updateOne({ _id: id, userId }, { $set: data })
  }

  async deleteByIdAndUser(id: string, userId: string) {
    return await this.deleteOne({ _id: id, userId })
  }

  async listByScene(userId: string, scene: string, category?: string) {
    return await this.scriptTemplateModel.find({
      userId,
      scene,
      enabled: true,
      $or: [{ applicableCategories: { $size: 0 } }, { applicableCategories: { $in: category ? [category] : [] } }],
    }).lean({ virtuals: true }).exec()
  }

  async updateEnabledById(id: string, enabled: boolean) {
    return await this.updateOne({ _id: id }, { $set: { enabled } })
  }
}
