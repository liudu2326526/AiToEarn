import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { MonitoredPostFetchLog } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class MonitoredPostFetchLogRepository extends BaseRepository<MonitoredPostFetchLog> {
  private readonly billableFetchStatuses = ['ready', 'failed', 'permission_required', 'pending_confirmation']

  constructor(
    @InjectModel(MonitoredPostFetchLog.name, DB_CONNECTION_NAME) private fetchLogModel: Model<MonitoredPostFetchLog>,
  ) {
    super(fetchLogModel)
  }

  async countByAccountSince(userId: string, accountId: string, since: Date) {
    return await this.fetchLogModel.countDocuments({
      userId,
      accountId,
      fetchStatus: { $in: this.billableFetchStatuses },
      fetchedAt: { $gte: since },
    })
  }
}
