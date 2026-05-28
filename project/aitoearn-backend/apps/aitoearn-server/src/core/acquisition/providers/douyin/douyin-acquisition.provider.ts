import { Injectable } from '@nestjs/common'
import { DouyinCommentListItem } from '../../../channel/libs/douyin/common'
import { DouyinApiService } from '../../../channel/libs/douyin/douyin-api.service'
import { DouyinService } from '../../../channel/platforms/douyin/douyin.service'
import { AcquisitionCapabilityStatus, AcquisitionDataSource, AcquisitionPlatform } from '../../acquisition.constants'
import { AcquisitionFetchRequest, AcquisitionFetchResult, NormalizedCommentSnapshot } from '../../acquisition.types'
import { AcquisitionProvider } from '../acquisition-provider.interface'

interface DouyinAuthInfoWithScope {
  access_token?: string
  open_id?: string
  scope?: string
  scopes?: string[]
}

@Injectable()
export class DouyinAcquisitionProvider implements AcquisitionProvider {
  constructor(
    private readonly douyinService: DouyinService,
    private readonly douyinApiService: DouyinApiService,
  ) {}

  async getCapabilityStatus(accountId: string) {
    const auth = await this.getAccountAuthInfo(accountId)
    if (!auth?.access_token || !auth.open_id) {
      return { status: AcquisitionCapabilityStatus.PendingAuthorization, reason: 'Douyin account is not authorized' }
    }
    if (!this.hasCommentScope(auth)) {
      return { status: AcquisitionCapabilityStatus.PermissionRequired, reason: 'Douyin account is missing item.comment scope' }
    }
    return { status: AcquisitionCapabilityStatus.Ready, reason: '' }
  }

  async fetchWorkAndComments(request: AcquisitionFetchRequest): Promise<AcquisitionFetchResult> {
    const capability = await this.getCapabilityStatus(request.accountId)
    if (capability.status !== AcquisitionCapabilityStatus.Ready) {
      return {
        comments: [],
        cursor: request.cursor || '',
        hasMore: false,
        capabilityStatus: capability.status,
        capabilityReason: capability.reason,
      }
    }

    const auth = await this.getAccountAuthInfo(request.accountId)
    if (!auth?.open_id) {
      return {
        comments: [],
        cursor: request.cursor || '',
        hasMore: false,
        capabilityStatus: AcquisitionCapabilityStatus.PendingAuthorization,
        capabilityReason: 'Douyin account is not authorized',
      }
    }

    const accessToken = await this.douyinService.getAccountAccessToken(request.accountId)
    const postId = request.postId || this.extractPostId(request.postUrl)
    const [videoList, commentList] = await Promise.all([
      this.douyinApiService.getUserVideoList(accessToken, { openId: auth.open_id, count: 10 }),
      this.douyinApiService.getItemCommentList(accessToken, {
        openId: auth.open_id,
        itemId: postId,
        cursor: Number(request.cursor || 0),
        count: 50,
      }),
    ])

    const post = videoList.list?.find(item => item.item_id === postId || item.video_id === postId)
    const fetchedAt = new Date()
    return {
      post: {
        platform: AcquisitionPlatform.Douyin,
        accountId: request.accountId,
        postId,
        postUrl: request.postUrl || post?.share_url || '',
        title: post?.title || '',
        cover: '',
        metrics: {
          raw: post ? { post } : {},
          normalized: {},
        },
        fetchedAt,
        fetchDate: fetchedAt.toISOString().slice(0, 10),
        dataSource: AcquisitionDataSource.DouyinOpenApi,
      },
      comments: this.normalizeComments(request, commentList.comments || commentList.list || [], postId),
      cursor: String(commentList.cursor ?? ''),
      hasMore: Boolean(commentList.has_more),
      capabilityStatus: AcquisitionCapabilityStatus.Ready,
      capabilityReason: '',
    }
  }

  private async getAccountAuthInfo(accountId: string) {
    return await this.douyinService.getAccountAuthInfo(accountId) as DouyinAuthInfoWithScope | null
  }

  private hasCommentScope(auth: DouyinAuthInfoWithScope) {
    const scopes = Array.isArray(auth.scopes)
      ? auth.scopes
      : String(auth.scope || '').split(',').map(scope => scope.trim()).filter(Boolean)
    return scopes.includes('item.comment')
  }

  private normalizeComments(
    request: AcquisitionFetchRequest,
    comments: DouyinCommentListItem[],
    postId: string,
  ): NormalizedCommentSnapshot[] {
    return comments.map((comment, index) => ({
      platform: AcquisitionPlatform.Douyin,
      accountId: request.accountId,
      postId,
      commentId: comment.comment_id || `${postId}:${index}`,
      parentCommentId: '',
      userName: comment.user?.nickname || '',
      userAvatar: comment.user?.avatar || '',
      content: comment.content || '',
      likeCount: Number(comment.digg_count || 0),
      ipLocation: '',
      xsecToken: '',
      commentedAt: comment.create_time ? new Date(comment.create_time * 1000) : undefined,
      fetchBatch: request.fetchBatch || '',
      dataSource: AcquisitionDataSource.DouyinOpenApi,
    })).filter(comment => comment.content)
  }

  private extractPostId(postUrl: string) {
    const urlMatch = postUrl.match(/(?:video|note)\/([^/?#]+)/)
    if (urlMatch?.[1]) return urlMatch[1]
    const queryMatch = postUrl.match(/[?&](?:item_id|video_id)=([^&#]+)/)
    return queryMatch?.[1] || postUrl
  }
}
