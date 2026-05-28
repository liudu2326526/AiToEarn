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

  async getByName(name: string) {
    return await this.scriptTemplateModel.findOne({ name }).lean({ virtuals: true }).exec()
  }

  async listByScene(scene: string, category?: string) {
    return await this.scriptTemplateModel.find({
      scene,
      enabled: true,
      $or: [{ applicableCategories: { $size: 0 } }, { applicableCategories: category || '' }],
    }).lean({ virtuals: true }).exec()
  }

  async updateEnabledById(id: string, enabled: boolean) {
    return await this.updateOne({ _id: id }, { $set: { enabled } })
  }
}
