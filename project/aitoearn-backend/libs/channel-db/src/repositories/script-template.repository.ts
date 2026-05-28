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
}
