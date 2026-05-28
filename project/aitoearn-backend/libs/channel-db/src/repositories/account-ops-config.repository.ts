import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { AccountOpsConfig } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class AccountOpsConfigRepository extends BaseRepository<AccountOpsConfig> {
  constructor(
    @InjectModel(AccountOpsConfig.name, DB_CONNECTION_NAME) private accountOpsConfigModel: Model<AccountOpsConfig>,
  ) {
    super(accountOpsConfigModel)
  }
}
