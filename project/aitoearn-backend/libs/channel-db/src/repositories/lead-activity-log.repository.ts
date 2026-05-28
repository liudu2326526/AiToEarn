import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { LeadActivityLog } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class LeadActivityLogRepository extends BaseRepository<LeadActivityLog> {
  constructor(
    @InjectModel(LeadActivityLog.name, DB_CONNECTION_NAME) private leadActivityLogModel: Model<LeadActivityLog>,
  ) {
    super(leadActivityLogModel)
  }
}
