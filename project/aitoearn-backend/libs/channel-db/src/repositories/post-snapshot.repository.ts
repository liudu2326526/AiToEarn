import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { PostSnapshot } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class PostSnapshotRepository extends BaseRepository<PostSnapshot> {
  constructor(
    @InjectModel(PostSnapshot.name, DB_CONNECTION_NAME) private postSnapshotModel: Model<PostSnapshot>,
  ) {
    super(postSnapshotModel)
  }

  async createSnapshot(data: Partial<PostSnapshot> & {
    platform: string
    accountId: string
    postId: string
    fetchedAt: Date
    fetchDate: string
  }) {
    return await this.create(data)
  }

  async listByPost(accountId: string, platform: string, postId: string, limit = 20) {
    return await this.find(
      { accountId, platform, postId },
      { sort: { fetchedAt: -1 }, limit },
    )
  }
}
