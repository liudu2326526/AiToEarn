import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { LeadReplyTask, LeadReplyTaskStatus } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class LeadReplyTaskRepository extends BaseRepository<LeadReplyTask> {
  constructor(
    @InjectModel(LeadReplyTask.name, DB_CONNECTION_NAME) private readonly leadReplyTaskModel: Model<LeadReplyTask>,
  ) {
    super(leadReplyTaskModel)
  }

  async listByUser(userId: string, query: {
    status?: string
    leadId?: string
    page?: number
    pageSize?: number
  }) {
    const filter: Record<string, unknown> = { userId }
    if (query.status) filter['status'] = query.status
    if (query.leadId) filter['leadId'] = query.leadId

    const page = Math.max(Number(query.page || 1), 1)
    const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100)
    const [list, total] = await Promise.all([
      this.leadReplyTaskModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean({ virtuals: true })
        .exec(),
      this.leadReplyTaskModel.countDocuments(filter).exec(),
    ])

    return [list, total] as const
  }

  async getByIdAndUser(id: string, userId: string) {
    return await this.leadReplyTaskModel.findOne({ _id: id, userId }).lean({ virtuals: true }).exec()
  }

  async markQueued(id: string) {
    return await this.leadReplyTaskModel.findByIdAndUpdate(
      id,
      { status: LeadReplyTaskStatus.Queued },
      { new: true },
    ).lean({ virtuals: true }).exec()
  }

  async markRunning(id: string) {
    return await this.leadReplyTaskModel.findByIdAndUpdate(
      id,
      {
        status: LeadReplyTaskStatus.Running,
        $inc: { attemptCount: 1 },
        startedAt: new Date(),
        lastError: '',
      },
      { new: true },
    ).lean({ virtuals: true }).exec()
  }

  async markTerminal(id: string, status: LeadReplyTaskStatus, patch: Record<string, unknown>) {
    return await this.leadReplyTaskModel.findByIdAndUpdate(
      id,
      {
        ...patch,
        status,
        finishedAt: new Date(),
      },
      { new: true },
    ).lean({ virtuals: true }).exec()
  }
}
