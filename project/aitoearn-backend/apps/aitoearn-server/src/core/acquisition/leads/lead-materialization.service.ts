import { Injectable } from '@nestjs/common'
import {
  CommentSnapshotRepository,
  LeadActivityLogRepository,
  LeadRepository,
  MonitoredPost,
  MonitoredPostRepository,
} from '@yikart/channel-db'
import { AppException, ResponseCode } from '@yikart/common'
import { MaterializeLeadsDto } from './acquisition-leads.dto'

@Injectable()
export class LeadMaterializationService {
  constructor(
    private readonly monitoredPostRepository: MonitoredPostRepository,
    private readonly commentSnapshotRepository: CommentSnapshotRepository,
    private readonly leadRepository: LeadRepository,
    private readonly leadActivityLogRepository: LeadActivityLogRepository,
  ) {}

  async materialize(userId: string, dto: MaterializeLeadsDto, operatorId: string) {
    let monitoredPosts: Array<MonitoredPost | null> = []

    if (dto.monitoredPostId) {
      const post = await this.monitoredPostRepository.getByIdAndUser(dto.monitoredPostId, userId)
      if (!post) throw new AppException(ResponseCode.MonitoredPostNotFound)
      monitoredPosts = [post]
    }
    else {
      const [posts] = await this.monitoredPostRepository.listWithPagination(userId, {
        ...(dto.platform && { platform: dto.platform }),
        ...(dto.accountId && { accountId: dto.accountId }),
        ...(dto.postId && { postId: dto.postId }),
        monitorStatus: 'active',
      }, 1, dto.postLimit)
      monitoredPosts = posts
    }

    const resolvedMonitoredPosts = monitoredPosts.filter((post): post is MonitoredPost => Boolean(post))
    let createdOrUpdated = 0
    let totalScanned = 0
    let remainingComments = dto.totalCommentLimit

    for (const post of resolvedMonitoredPosts) {
      if (remainingComments <= 0) break

      const comments = await this.commentSnapshotRepository.listForLeadMaterializationByPost({
        platform: post.platform,
        accountId: post.accountId,
        postId: post.postId,
        fetchBatch: dto.fetchBatch,
        limit: Math.min(dto.commentLimit, remainingComments),
      })

      totalScanned += comments.length
      remainingComments -= comments.length

      for (const comment of comments) {
        const result = await this.leadRepository.upsertFromComment({
          userId,
          platform: comment.platform,
          accountId: comment.accountId,
          postId: comment.postId,
          commentId: comment.commentId,
          parentCommentId: comment.parentCommentId || '',
          userName: comment.userName || '',
          userAvatar: comment.userAvatar || '',
          sourceContent: comment.content || '',
        })

        if (result?.lead?.id) {
          createdOrUpdated += 1
          if (result.created) {
            await this.leadActivityLogRepository.append({
              userId,
              leadId: result.lead.id,
              action: 'materialized',
              operatorId,
              note: `Materialized from comment ${comment.commentId}`,
            })
          }
        }
      }
    }

    return { totalScanned, materialized: createdOrUpdated }
  }
}
