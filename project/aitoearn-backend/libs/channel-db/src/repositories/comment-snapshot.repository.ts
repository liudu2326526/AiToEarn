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
}
