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

  async append(data: {
    userId: string
    leadId: string
    action: string
    operatorId: string
    fromValue?: string
    toValue?: string
    note?: string
  }) {
    return await this.create({
      userId: data.userId,
      leadId: data.leadId,
      action: data.action as any,
      operatorId: data.operatorId,
      fromValue: data.fromValue || '',
      toValue: data.toValue || '',
      note: data.note || '',
    })
  }

  async listByLeadId(userId: string, leadId: string, limit = 100) {
    return await this.find({ userId, leadId } as any, { sort: { createdAt: -1 }, limit })
  }
}
