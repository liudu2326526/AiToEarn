import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { FilterQuery, Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { MonitoredPost } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class MonitoredPostRepository extends BaseRepository<MonitoredPost> {
  constructor(
    @InjectModel(MonitoredPost.name, DB_CONNECTION_NAME) private monitoredPostModel: Model<MonitoredPost>,
  ) {
    super(monitoredPostModel)
  }

  async upsertByIdentity(data: Partial<MonitoredPost> & {
    userId: string
    platform: string
    accountId: string
    postId: string
    postUrl: string
    source: string
  }) {
    const { monitorStatus, fetchStatus, ...setData } = data
    return await this.monitoredPostModel.findOneAndUpdate(
      { userId: data.userId, platform: data.platform, accountId: data.accountId, postId: data.postId },
      {
        $set: setData,
        $setOnInsert: {
          monitorStatus: monitorStatus || 'active',
          fetchStatus: fetchStatus || 'idle',
        },
      },
      { new: true, upsert: true },
    )
  }

  async listWithPagination(userId: string, filter: FilterQuery<MonitoredPost>, page: number, pageSize: number): Promise<[MonitoredPost[], number]> {
    const skip = (page - 1) * pageSize
    const query = { ...filter, userId }
    return await Promise.all([
      this.monitoredPostModel.find(query).sort({ updatedAt: -1 }).skip(skip).limit(pageSize).lean({ virtuals: true }).exec(),
      this.monitoredPostModel.countDocuments(query).exec(),
    ])
  }

  public override async updateById(id: string, data: Partial<MonitoredPost>) {
    return await this.monitoredPostModel.findByIdAndUpdate(id, { $set: data }, { new: true })
  }

  async getByIdAndUser(id: string, userId: string) {
    return await this.monitoredPostModel.findOne({ _id: id, userId }).lean({ virtuals: true }).exec() as any
  }

  async getByIdentity(userId: string, platform: string, accountId: string, postId: string) {
    return await this.monitoredPostModel.findOne({ userId, platform, accountId, postId })
  }
}
