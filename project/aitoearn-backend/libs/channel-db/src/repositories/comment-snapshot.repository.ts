import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { CommentSnapshot } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class CommentSnapshotRepository extends BaseRepository<CommentSnapshot> {
  constructor(
    @InjectModel(CommentSnapshot.name, DB_CONNECTION_NAME) private commentSnapshotModel: Model<CommentSnapshot>,
  ) {
    super(commentSnapshotModel)
  }

  async bulkUpsertByCommentId(items: Array<Partial<CommentSnapshot> & {
    platform: string
    accountId: string
    postId: string
    commentId: string
  }>) {
    if (items.length === 0) {
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 }
    }

    const ops = items.map(item => ({
      updateOne: {
        filter: {
          platform: item.platform,
          accountId: item.accountId,
          postId: item.postId,
          commentId: item.commentId,
          parentCommentId: item.parentCommentId || '',
        },
        update: { $set: item },
        upsert: true,
      },
    }))

    return await this.commentSnapshotModel.bulkWrite(ops)
  }

  async listByPost(accountId: string, platform: string, postId: string, limit = 100) {
    return await this.find(
      { accountId, platform, postId },
      { sort: { likeCount: -1, commentedAt: -1 }, limit },
    )
  }

  async listWithPagination(filter: {
    accountId: string
    platform: string
    postId: string
    keyword?: string
    parentCommentId?: string
    dataSource?: string
    fetchBatch?: string
    sortBy?: 'time' | 'like'
    page: number
    pageSize: number
  }): Promise<[CommentSnapshot[], number]> {
    const query: Record<string, unknown> = {
      accountId: filter.accountId,
      platform: filter.platform,
      postId: filter.postId,
    }
    if (filter.keyword) query['content'] = { $regex: filter.keyword, $options: 'i' }
    if (filter.parentCommentId !== undefined) query['parentCommentId'] = filter.parentCommentId
    if (filter.dataSource) query['dataSource'] = filter.dataSource
    if (filter.fetchBatch) query['fetchBatch'] = filter.fetchBatch

    const skip = (filter.page - 1) * filter.pageSize
    const sort = filter.sortBy === 'like'
      ? ({ likeCount: -1, commentedAt: -1 } as const)
      : ({ commentedAt: -1, likeCount: -1 } as const)

    return await Promise.all([
      this.commentSnapshotModel.find(query).sort(sort).skip(skip).limit(filter.pageSize).lean({ virtuals: true }).exec(),
      this.commentSnapshotModel.countDocuments(query).exec(),
    ])
  }

  async listForLeadMaterializationByPost(filter: {
    platform: string
    accountId: string
    postId: string
    fetchBatch?: string
    limit: number
  }) {
    const query: Record<string, unknown> = {
      platform: filter.platform,
      accountId: filter.accountId,
      postId: filter.postId,
    }
    if (filter.fetchBatch) query['fetchBatch'] = filter.fetchBatch
    return await this.find(query, {
      sort: { commentedAt: -1, createdAt: -1 },
      limit: filter.limit,
    })
  }

  async deleteByPost(accountId: string, platform: string, postId: string) {
    await this.deleteMany({ accountId, platform, postId })
  }
}
