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
}
