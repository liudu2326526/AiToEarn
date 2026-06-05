import { Injectable } from '@nestjs/common'
import { LeadActivityLogRepository, LeadRepository, MonitoredPostRepository } from '@yikart/channel-db'
import { AppException, ResponseCode } from '@yikart/common'
import { DouyinCreatorCliService } from '../douyin-creator-automation/douyin-creator-cli.service'
import { AutoSelectLeadReplyStyleDto, LeadListQueryDto, LeadStatsQueryDto, PrivateMessageCapabilityQueryDto } from './acquisition-leads.dto'

const STAGE_STATUS_MAP = {
  new_comment: 'pending',
  replied: 'in_progress',
  messaged: 'in_progress',
  wechat_guided: 'in_progress',
  wechat_added: 'converted',
  lost: 'lost',
} as const

type ReplyStyle = 'auto' | 'friendly' | 'professional' | 'promotion' | 'restrained'
type ResolvedReplyStyle = Exclude<ReplyStyle, 'auto'>

@Injectable()
export class LeadManagementService {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly leadActivityLogRepository: LeadActivityLogRepository,
    private readonly monitoredPostRepository: MonitoredPostRepository,
    private readonly douyinCreatorCliService?: DouyinCreatorCliService,
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
    if (!lead)
      throw new AppException(ResponseCode.LeadNotFound)
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
      if (!lead)
        continue
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

  async updateReplyStyle(userId: string, id: string, replyStyle: ReplyStyle, operatorId: string) {
    const lead = await this.detail(userId, id)
    const updated = await this.leadRepository.updateById(lead.id, {
      replyStyle,
      lastFollowUpAt: new Date(),
    } as any)
    await this.leadActivityLogRepository.append({
      userId,
      leadId: lead.id,
      action: 'reply_style_changed',
      operatorId,
      fromValue: lead.replyStyle || 'auto',
      toValue: replyStyle,
    })
    return updated
  }

  async batchUpdateReplyStyle(userId: string, leadIds: string[], replyStyle: ReplyStyle, operatorId: string) {
    let updated = 0
    for (const id of leadIds) {
      const lead = await this.leadRepository.getByIdAndUser(id, userId)
      if (!lead)
        continue
      await this.leadRepository.updateById(lead.id, {
        replyStyle,
        lastFollowUpAt: new Date(),
      } as any)
      await this.leadActivityLogRepository.append({
        userId,
        leadId: lead.id,
        action: 'batch_reply_style_changed',
        operatorId,
        fromValue: lead.replyStyle || 'auto',
        toValue: replyStyle,
      })
      updated += 1
    }
    return { updated }
  }

  async autoSelectReplyStyles(userId: string, query: AutoSelectLeadReplyStyleDto, operatorId: string) {
    const [list, total] = await this.leadRepository.listByUser(userId, {
      platform: query.platform,
      accountId: query.accountId,
      postId: query.postId,
      stage: query.stage,
      status: query.status,
      sourceType: query.sourceType,
      assignee: query.assignee,
      keyword: query.keyword,
      page: 1,
      pageSize: query.limit || 100,
    })

    const styles: Record<ResolvedReplyStyle, number> = {
      friendly: 0,
      professional: 0,
      promotion: 0,
      restrained: 0,
    }
    let updated = 0
    let skipped = 0

    for (const lead of list as any[]) {
      const fromValue = lead.replyStyle || 'auto'
      if (query.onlyAuto !== false && fromValue !== 'auto') {
        skipped += 1
        continue
      }

      const replyStyle = this.inferReplyStyle(lead.sourceContent || '')
      await this.leadRepository.updateById(lead.id, {
        replyStyle,
        lastFollowUpAt: new Date(),
      } as any)
      await this.leadActivityLogRepository.append({
        userId,
        leadId: lead.id,
        action: 'auto_reply_style_selected',
        operatorId,
        fromValue,
        toValue: replyStyle,
      })
      styles[replyStyle] += 1
      updated += 1
    }

    return {
      total,
      updated,
      skipped,
      styles,
    }
  }

  async changeStage(userId: string, id: string, stage: keyof typeof STAGE_STATUS_MAP, operatorId: string) {
    const lead = await this.detail(userId, id)
    const status = STAGE_STATUS_MAP[stage]
    if (!status)
      throw new AppException(ResponseCode.LeadStageInvalid)
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
    const douyinStatus = platforms.includes('douyin') && this.douyinCreatorCliService
      ? await this.douyinCreatorCliService.getStatus()
      : null
    return {
      list: platforms.map(platform => ({
        platform,
        accountId: query.accountId || '',
        status: platform === 'douyin'
          ? this.resolveDouyinCreatorCapabilityStatus(douyinStatus)
          : platform === 'xhs' ? 'manual_required' : 'not_supported',
        reason: platform === 'douyin'
          ? this.resolveDouyinCreatorCapabilityReason(douyinStatus)
          : platform === 'xhs'
            ? 'XHS private-message ingestion is not implemented in the local bridge yet.'
            : 'Kwai private-message ingestion provider is not implemented yet.',
        metadata: platform === 'douyin' && douyinStatus ? douyinStatus : undefined,
      })),
    }
  }

  private resolveDouyinCreatorCapabilityStatus(status: Record<string, unknown> | null) {
    if (!status?.['configured'])
      return 'not_supported'
    return status['ready'] ? 'ready' : 'manual_required'
  }

  private resolveDouyinCreatorCapabilityReason(status: Record<string, unknown> | null) {
    if (!status?.['configured']) {
      return 'Douyin Creator Center local automation is not configured. Set DOUYIN_CREATOR_TOOLS_DIR and log in with the local Playwright profile.'
    }
    if (status['ready']) {
      return 'Douyin Creator Center local automation has a recent successful probe/import/export. Continue to dry-run replies before confirmed sending.'
    }
    return 'Douyin Creator Center local automation is configured. Run a dry-run reply from the local browser session before confirmed sending.'
  }

  private async enrichPostContext(userId: string, list: any[]) {
    const identities = list
      .filter(item => item?.platform && item?.accountId && item?.postId)
      .map(item => ({
        platform: item.platform,
        accountId: item.accountId,
        postId: item.postId,
      }))
    if (identities.length === 0)
      return list

    const posts = await this.monitoredPostRepository.findByUserPostIdentities(
      userId,
      identities,
    )
    const postMap = new Map(posts.map(post => [`${post.platform}:${post.accountId}:${post.postId}`, post]))
    return list.map((item) => {
      const post = postMap.get(`${item.platform}:${item.accountId}:${item.postId}`)
      if (!post)
        return item
      return {
        ...item,
        postTitle: item.postTitle || post.title || '',
        postUrl: item.postUrl || post.postUrl || '',
        postCover: item.postCover || post.cover || '',
      }
    })
  }

  private inferReplyStyle(content: string): ResolvedReplyStyle {
    const normalized = String(content || '').trim()
    if (/差|贵|不行|不能要|吐槽|无语|垃圾|骗人|踩雷|投诉|失望|退货|不好|假的|质疑|小老头|老头|不爱笑|列宁/.test(normalized)) {
      return 'restrained'
    }
    if (/链接|求链|怎么买|哪里买|下单|同款|橱窗|购买|发链接|有链接|价格|多少钱/.test(normalized)) {
      return 'promotion'
    }
    if (/尺码|大小|身高|体重|适合|面料|材质|版型|长度|颜色|设计|工业|参数|配置|怎么选|推荐码数/.test(normalized)) {
      return 'professional'
    }
    return 'friendly'
  }
}
