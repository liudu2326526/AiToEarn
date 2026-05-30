import { Injectable } from '@nestjs/common'
import { LeadActivityLogRepository, LeadRepository, MonitoredPostRepository } from '@yikart/channel-db'
import { AppException, ResponseCode } from '@yikart/common'
import { LeadListQueryDto, LeadStatsQueryDto, PrivateMessageCapabilityQueryDto } from './acquisition-leads.dto'

const STAGE_STATUS_MAP = {
  new_comment: 'pending',
  replied: 'in_progress',
  messaged: 'in_progress',
  wechat_guided: 'in_progress',
  wechat_added: 'converted',
  lost: 'lost',
} as const

@Injectable()
export class LeadManagementService {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly leadActivityLogRepository: LeadActivityLogRepository,
    private readonly monitoredPostRepository: MonitoredPostRepository,
  ) {}

  async list(userId: string, query: LeadListQueryDto) {
    const [list, total] = await this.leadRepository.listByUser(userId, query)
    return [await this.enrichPostContext(userId, list as any[]), total] as const
  }

  async stats(userId: string, query: LeadStatsQueryDto) {
    return await this.leadRepository.statsByUser(userId, query)
  }

  async detail(userId: string, id: string) {
    const lead = await this.leadRepository.getByIdAndUser(id, userId)
    if (!lead) throw new AppException(ResponseCode.LeadNotFound)
    const [enriched] = await this.enrichPostContext(userId, [lead] as any[])
    return enriched || lead
  }

  async timeline(userId: string, id: string) {
    const lead = await this.detail(userId, id)
    return await this.leadActivityLogRepository.listByLeadId(userId, lead.id)
  }

  async assign(userId: string, id: string, assignee: string, operatorId: string) {
    const lead = await this.detail(userId, id)
    const action = !lead.assignee && assignee === operatorId ? 'claimed' : lead.assignee && lead.assignee !== assignee ? 'transferred' : 'assigned'
    const updated = await this.leadRepository.updateById(lead.id, {
      assignee,
      lastFollowUpAt: new Date(),
    } as any)
    await this.leadActivityLogRepository.append({
      userId,
      leadId: lead.id,
      action,
      operatorId,
      fromValue: lead.assignee || '',
      toValue: assignee,
    })
    return updated
  }

  async batchAssign(userId: string, leadIds: string[], assignee: string, operatorId: string) {
    let updated = 0
    for (const id of leadIds) {
      const lead = await this.leadRepository.getByIdAndUser(id, userId)
      if (!lead) continue
      await this.leadRepository.updateById(lead.id, {
        assignee,
        lastFollowUpAt: new Date(),
      } as any)
      await this.leadActivityLogRepository.append({
        userId,
        leadId: lead.id,
        action: 'batch_assigned',
        operatorId,
        fromValue: lead.assignee || '',
        toValue: assignee,
      })
      updated += 1
    }
    return { updated }
  }

  async changeStage(userId: string, id: string, stage: keyof typeof STAGE_STATUS_MAP, operatorId: string) {
    const lead = await this.detail(userId, id)
    const status = STAGE_STATUS_MAP[stage]
    if (!status) throw new AppException(ResponseCode.LeadStageInvalid)
    const updated = await this.leadRepository.updateById(lead.id, {
      stage,
      status,
      lastFollowUpAt: new Date(),
    } as any)
    await this.leadActivityLogRepository.append({
      userId,
      leadId: lead.id,
      action: 'stage_changed',
      operatorId,
      fromValue: lead.stage,
      toValue: stage,
    })
    return updated
  }

  async addNote(userId: string, id: string, note: string, operatorId: string) {
    const lead = await this.detail(userId, id)
    return await this.leadActivityLogRepository.append({
      userId,
      leadId: lead.id,
      action: 'note_added',
      operatorId,
      note,
    })
  }

  async privateMessageCapability(userId: string, query: PrivateMessageCapabilityQueryDto) {
    void userId
    const platforms = query.platform ? [query.platform] : ['xhs', 'douyin', 'kwai']
    return {
      list: platforms.map(platform => ({
        platform,
        accountId: query.accountId || '',
        status: platform === 'douyin' ? 'permission_required' : platform === 'xhs' ? 'manual_required' : 'not_supported',
        reason: platform === 'douyin'
          ? 'Douyin private-message ingestion requires confirmed Open Platform IM scope and callback support.'
          : platform === 'xhs'
            ? 'XHS private-message ingestion is not implemented in the local bridge yet.'
            : 'Kwai private-message ingestion provider is not implemented yet.',
      })),
    }
  }

  private async enrichPostContext(userId: string, list: any[]) {
    const identities = list
      .filter(item => item?.platform && item?.accountId && item?.postId)
      .map(item => ({
        platform: item.platform,
        accountId: item.accountId,
        postId: item.postId,
      }))
    if (identities.length === 0) return list

    const posts = await this.monitoredPostRepository.findByUserPostIdentities(
      userId,
      identities,
    )
    const postMap = new Map(posts.map(post => [`${post.platform}:${post.accountId}:${post.postId}`, post]))
    return list.map(item => {
      const post = postMap.get(`${item.platform}:${item.accountId}:${item.postId}`)
      if (!post) return item
      return {
        ...item,
        postTitle: item.postTitle || post.title || '',
        postUrl: item.postUrl || post.postUrl || '',
        postCover: item.postCover || post.cover || '',
      }
    })
  }
}
