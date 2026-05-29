import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { FilterQuery, Model } from 'mongoose'
import { DB_CONNECTION_NAME } from '../common'
import { Lead, LeadSourceType, LeadStage, LeadStatus } from '../schemas'
import { BaseRepository } from './base.repository'

@Injectable()
export class LeadRepository extends BaseRepository<Lead> {
  constructor(
    @InjectModel(Lead.name, DB_CONNECTION_NAME) private readonly leadModel: Model<Lead>,
  ) {
    super(leadModel)
  }

  private buildListQuery(userId: string, filter: {
    platform?: string
    accountId?: string
    postId?: string
    stage?: string
    status?: string
    assignee?: string
    keyword?: string
  }) {
    const query: FilterQuery<Lead> = { userId }
    if (filter.platform) query.platform = filter.platform
    if (filter.accountId) query.accountId = filter.accountId
    if (filter.postId) query.postId = filter.postId
    if (filter.stage) query.stage = filter.stage
    if (filter.status) query.status = filter.status
    if (filter.assignee !== undefined) query.assignee = filter.assignee
    if (filter.keyword) {
      query.$or = [
        { userName: { $regex: filter.keyword, $options: 'i' } },
        { sourceContent: { $regex: filter.keyword, $options: 'i' } },
      ]
    }

    return query
  }

  async listByUser(userId: string, filter: {
    platform?: string
    accountId?: string
    postId?: string
    stage?: string
    status?: string
    assignee?: string
    keyword?: string
    page: number
    pageSize: number
  }) {
    const query = this.buildListQuery(userId, filter)

    return await this.findWithPagination({
      page: filter.page,
      pageSize: filter.pageSize,
      filter: query,
      options: { sort: { lastFollowUpAt: -1, updatedAt: -1 } },
    })
  }

  async statsByUser(userId: string, filter: {
    platform?: string
    accountId?: string
    postId?: string
    stage?: string
    status?: string
    assignee?: string
    keyword?: string
  }) {
    const baseQuery = this.buildListQuery(userId, filter)
    const [total, pending, inProgress, converted, lost, invalid] = await Promise.all([
      this.leadModel.countDocuments(baseQuery).exec(),
      this.leadModel.countDocuments({ ...baseQuery, status: LeadStatus.Pending }).exec(),
      this.leadModel.countDocuments({ ...baseQuery, status: LeadStatus.InProgress }).exec(),
      this.leadModel.countDocuments({ ...baseQuery, status: LeadStatus.Converted }).exec(),
      this.leadModel.countDocuments({ ...baseQuery, status: LeadStatus.Lost }).exec(),
      this.leadModel.countDocuments({ ...baseQuery, status: LeadStatus.Invalid }).exec(),
    ])

    return {
      total,
      pending,
      in_progress: inProgress,
      converted,
      lost,
      invalid,
    }
  }

  async getByIdAndUser(id: string, userId: string) {
    return await this.findOne({ _id: id, userId } as any)
  }

  async upsertFromComment(input: {
    userId: string
    platform: string
    accountId: string
    postId: string
    commentId: string
    parentCommentId: string
    userName: string
    userAvatar: string
    sourceContent: string
  }): Promise<{ lead: Lead | null; created: boolean }> {
    const identity = {
      userId: input.userId,
      platform: input.platform,
      accountId: input.accountId,
      postId: input.postId,
      commentId: input.commentId,
      parentCommentId: input.parentCommentId || '',
    }

    const result = await this.leadModel.findOneAndUpdate(
      identity,
      {
        $setOnInsert: {
          ...input,
          parentCommentId: input.parentCommentId || '',
          sourceType: LeadSourceType.PublicComment,
          stage: LeadStage.NewComment,
          status: LeadStatus.Pending,
          lastFollowUpAt: new Date(),
        },
        $set: {
          userName: input.userName,
          userAvatar: input.userAvatar,
          sourceContent: input.sourceContent,
        },
      } as any,
      {
        new: true,
        upsert: true,
        includeResultMetadata: true,
      } as any,
    ).exec() as any

    const value = result?.value || null
    const plainValue = value && typeof value.toObject === 'function'
      ? value.toObject({ virtuals: true })
      : value
    const lead = plainValue ? { ...plainValue, id: plainValue.id || String(plainValue._id) } : null

    return {
      lead,
      created: Boolean(result?.lastErrorObject?.upserted),
    }
  }
}
